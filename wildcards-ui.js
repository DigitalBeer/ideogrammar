/* wildcards-ui.js — style templates and wildcard lists for the Ideogrammar editor.
 *
 * Loaded after the main inline script, so it can use its globals (state,
 * render, proposeChange, …). The engine is wildcards.js (window.WC); the
 * starter pack is wildcards-data.js.
 *
 *  • Fields: any text field (high-level, style, background, element desc / text /
 *    font / style fields) may contain wildcard syntax. Rolling resolves it; the
 *    source text is kept (state.wild.src / el.wild.src) so the field stays live.
 *  • Roll all = new seed (locked picks stay). Roll selected / one field / one
 *    pick = bump a salt, so every other pick stays the same.
 *  • Storage: built-in lists/templates/rules overlaid by user edits in
 *    localStorage, optionally synced with a wildcards/ folder via comfy_proxy.py.
 */
"use strict";

/* ------------------------------------------------------------------ */
/*  Small helpers                                                     */
/* ------------------------------------------------------------------ */
function wcEl(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "html") e.innerHTML = v;
    else if (k in e && typeof v !== "string") e[k] = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k.nodeType ? k : String(k));
  return e;
}
const wcStop = e => e.stopPropagation();   // keep canvas shortcuts out of text inputs
function wcLoad(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (_) { return def; } }
function wcSave(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); return true; }
  catch (err) { toast("Browser storage is full — export your wildcards or sync them to a folder (" + (err.name || "error") + ")", "bad"); return false; }
}
// Escape plain text so wildcard syntax inside it is kept literally.
function wcEsc(s) { return String(s || "").replace(/[{}|\\]/g, "\\$&").replace(/\$\{/g, "\\${").replace(/__/g, "\\__"); }
function wcShort(s, n = 80) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function wcDownloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ------------------------------------------------------------------ */
/*  Store: built-ins + user overlay                                   */
/* ------------------------------------------------------------------ */
const WCS_LISTS_KEY = "ideogrammar.wildcards";        // { name: { text, opts, updatedAt, deleted? } }
const WCS_TPL_KEY = "ideogrammar.styleTemplates";     // { id: { ...template, updatedAt } | { deleted, updatedAt } }
const WCS_RULES_KEY = "ideogrammar.wcRules";          // { rules: [...], updatedAt }
const WCS_SYNC_KEY = "ideogrammar.wcSync";            // { auto, lastSync, known: { path: mtime } }
const WCS_AUTOROLL_KEY = "ideogrammar.wcAutoRoll";
const WCS_GENTPL_KEY = "ideogrammar.genStyleTpl";
const WCS_LISTCATS_KEY = "ideogrammar.listCategories";   // list categories made by hand (kept even while empty)
const WCS_LISTCOLLAPSE_KEY = "ideogrammar.listCollapsed"; // folded categories in the list manager
const WCS_TPLCATS_KEY = "ideogrammar.tplCategories";      // template categories made by hand (kept even while empty)

let wcListOverlay = wcLoad(WCS_LISTS_KEY, {});
let wcTplOverlay = wcLoad(WCS_TPL_KEY, {});
let wcRulesStore = wcLoad(WCS_RULES_KEY, null);
let wcAutoRoll = wcLoad(WCS_AUTOROLL_KEY, true) !== false;
const WCS_PALFOLLOW_KEY = "ideogrammar.wcPaletteFollow";
let wcPaletteFollow = wcLoad(WCS_PALFOLLOW_KEY, true) !== false;
// The palette of the starting example: replaced when a template is applied, so it can't tint every render.
const WC_DEMO_PALETTES = ['["#F5F5F5","#1A1A1A","#6366F1"]', '["#6366F1","#FFFFFF"]', '["#1A1A1A"]'];
let _wcEngineLists = null;

function wcAllLists() {
  const out = {};
  for (const [name, text] of Object.entries(WC_BUILTIN_LISTS)) out[name] = { text, opts: {}, builtin: true, modified: false, updatedAt: 0 };
  for (const [name, o] of Object.entries(wcListOverlay)) {
    if (!o) continue;
    if (o.deleted) { delete out[name]; continue; }
    out[name] = { text: o.text || "", opts: o.opts || {}, builtin: name in WC_BUILTIN_LISTS, modified: true, updatedAt: o.updatedAt || 0, pack: o.pack || (o.opts && o.opts.pack) };
  }
  return out;
}
function wcEngineLists() {
  if (!_wcEngineLists) {
    const m = {};
    for (const [n, o] of Object.entries(wcAllLists())) m[n] = { text: o.text, opts: o.opts };
    _wcEngineLists = WC.normLists(m);
  }
  return _wcEngineLists;
}
function wcListsChanged() { _wcEngineLists = null; wcSave(WCS_LISTS_KEY, wcListOverlay); wcRefreshListPickers(); }
function wcSetList(name, text, opts) {
  name = WC.normName(name);
  if (!name) return false;
  wcListOverlay[name] = { text: String(text || ""), opts: opts || {}, updatedAt: Date.now() };
  wcListsChanged();
  return name;
}
function wcDeleteList(name) {
  if (name in WC_BUILTIN_LISTS) wcListOverlay[name] = { deleted: true, updatedAt: Date.now() };
  else wcListOverlay[name] = { deleted: true, updatedAt: Date.now() };   // tombstone, so folder sync removes the file too
  wcListsChanged();
}
function wcRestoreList(name) { delete wcListOverlay[name]; wcListsChanged(); }

function wcAllTemplates() {
  const out = [], seen = new Set();
  for (const t of WC_BUILTIN_TEMPLATES) {
    const o = wcTplOverlay[t.id];
    seen.add(t.id);
    if (o && o.deleted) continue;
    out.push(o ? { ...o, builtin: true, modified: true } : { ...t, builtin: true, modified: false });
  }
  for (const [id, o] of Object.entries(wcTplOverlay)) if (!seen.has(id) && o && !o.deleted) out.push({ ...o, id, builtin: false, modified: true });
  return out;
}
function wcGetTemplate(id) { return id ? wcAllTemplates().find(t => t.id === id) || null : null; }
function wcSaveTemplate(t) {
  const clean = JSON.parse(JSON.stringify(t));
  delete clean.builtin; delete clean.modified;
  clean.updatedAt = Date.now();
  wcTplOverlay[clean.id] = clean;
  wcSave(WCS_TPL_KEY, wcTplOverlay);
}
function wcDeleteTemplate(id) { wcTplOverlay[id] = { deleted: true, updatedAt: Date.now() }; wcSave(WCS_TPL_KEY, wcTplOverlay); }
function wcRestoreTemplate(id) { delete wcTplOverlay[id]; wcSave(WCS_TPL_KEY, wcTplOverlay); }

function wcGlobalRules() { return wcRulesStore && Array.isArray(wcRulesStore.rules) ? wcRulesStore.rules : WC_BUILTIN_RULES; }
function wcSetGlobalRules(rules) { wcRulesStore = { rules, updatedAt: Date.now() }; wcSave(WCS_RULES_KEY, wcRulesStore); }

/* ------------------------------------------------------------------ */
/*  Fields                                                            */
/* ------------------------------------------------------------------ */
const WC_GLOBAL_FIELDS = [
  { path: "hld", label: "High-level description", input: "hld", get: s => s.high_level_description, set: (s, v) => { s.high_level_description = v; } },
  ...[["aesthetics", "Aesthetics", "st-aesthetics"], ["lighting", "Lighting", "st-lighting"], ["photo", "Camera / lens", "st-photo"], ["medium", "Medium", "st-medium"], ["art_style", "Art style", "st-artstyle"]]
    .map(([k, label, input]) => ({ path: "style." + k, label, input, get: s => s.style_description[k] || "", set: (s, v) => { s.style_description[k] = v; } })),
  { path: "background", label: "Background", input: "bg", get: s => s.background, set: (s, v) => { s.background = v; } },
];
const WC_EL_FIELDS = [
  { key: "desc", label: "Description", get: e => e.desc || "", set: (e, v) => { e.desc = v; } },
  { key: "text", label: "Text", get: e => e.text || "", set: (e, v) => { e.text = v; } },
  { key: "font", label: "Typography", get: e => e.font || "", set: (e, v) => { e.font = v; } },
  ...ELEMENT_STYLE_FIELDS.map(([k, label]) => ({
    key: "style." + k, label, styleKey: k,
    get: e => (e.style && e.style[k]) || "",
    set: (e, v) => { e.style = e.style || {}; if (v) e.style[k] = v; else delete e.style[k]; }
  })),
];
const WC_STYLE_HINTS = {
  lighting: "e.g. __lighting/setups__", camera: "e.g. __camera/shots__, __camera/angles__", lens: "e.g. __camera/lenses__ at __camera/apertures__",
  wardrobe: "e.g. __clothes/outfit__", pose: "e.g. __people/poses__", environment: "e.g. __places__ at __time-of-day__",
  mood: "e.g. __moods__", extra: "anything else, e.g. {40%? holding __props__}"
};
const wcElPath = (el, key) => "e:" + el.wild.key + "." + key;
function wcPathLabel(path, st) {
  st = st || state;
  const g = WC_GLOBAL_FIELDS.find(f => f.path === path);
  if (g) return g.label;
  const m = /^e:([^.]+)\.(.+)$/.exec(path);
  if (m) {
    const i = st.elements.findIndex(e => e.wild && e.wild.key === m[1]);
    const f = WC_EL_FIELDS.find(f => f.key === m[2]);
    const el = st.elements[i];
    return `Element ${i + 1}${el ? " (" + el.type + ")" : ""} · ${f ? f.label.toLowerCase() : m[2]}`;
  }
  if (path.startsWith("var:")) return "Variable " + path.slice(4);
  return path;
}

/* ------------------------------------------------------------------ */
/*  Rolling                                                           */
/* ------------------------------------------------------------------ */
function wcTemplateFor(fmtTpl, fmt) {
  // Merge per-format overrides (formats.moss / formats.ideogram) into the template.
  const t = fmtTpl, f = t && t.formats && t.formats[fmt];
  if (!f) return t;
  return { ...t, global: { ...(t.global || {}), ...(f.global || {}) }, element: { ...(t.element || {}), ...(f.element || {}) } };
}
function wcTemplateContext(st) {
  const ids = [st.wild && st.wild.templateId, ...st.elements.map(e => e.wild && e.wild.templateId)].filter(Boolean);
  const varDefs = {}, rules = [], notes = [], names = [];
  for (const id of Array.from(new Set(ids))) {
    const t = wcGetTemplate(id);
    if (!t) continue;
    names.push(t.name);
    Object.assign(varDefs, t.vars || {});
    if (Array.isArray(t.rules)) rules.push(...t.rules);
    if (t.llmNotes) notes.push(t.name + ": " + t.llmNotes);
  }
  return { varDefs, rules, notes, names };
}

// Roll the wildcard fields of st (mutated). Options:
//   newSeed      new random seed (locked picks stay)
//   global       include the image-level fields (default true)
//   elementKeys  Set of el.wild.key to include (default: all)
//   onlyPaths    Set of field paths to write (overrides the two above)
//   bump         re-salt the written fields so only they get new picks
//   onlyUnresolved  only fields whose current text still has wildcard syntax
// Fields outside the scope are still evaluated (for variables and rules) but not written.
function wcRollInto(st, opt = {}) {
  st.wild = st.wild || normWild();
  if (opt.newSeed) st.wild.seed = WC.newSeed();
  const fields = [], writers = {};
  const inScopeGlobal = path => opt.onlyPaths ? opt.onlyPaths.has(path) : opt.global !== false;
  const inScopeEl = (el, path) => opt.onlyPaths ? opt.onlyPaths.has(path) : (!opt.elementKeys || opt.elementKeys.has(el.wild.key));
  const consider = (path, cur, srcObj, srcKey, write, inScope) => {
    const curLive = WC.hasSyntax(cur);
    const src = curLive ? cur : srcObj[srcKey];
    if (!src || !WC.hasSyntax(src)) return;
    if (opt.onlyUnresolved && !curLive) inScope = false;
    if (inScope && curLive) srcObj[srcKey] = cur;   // text typed with syntax becomes the field's live source
    fields.push({ path, text: src });
    if (inScope) writers[path] = write;
  };
  for (const f of WC_GLOBAL_FIELDS) consider(f.path, f.get(st), st.wild.src, f.path, v => f.set(st, v), inScopeGlobal(f.path));
  for (const el of st.elements) {
    if (el.enabled === false) continue;
    el.wild = el.wild || normElWild();
    for (const f of WC_EL_FIELDS) {
      const path = wcElPath(el, f.key);
      consider(path, f.get(el), el.wild.src, f.key, v => f.set(el, v), inScopeEl(el, path));
    }
  }
  if (opt.bump) for (const p of Object.keys(writers)) st.wild.salts["@" + p] = (st.wild.salts["@" + p] || 0) + 1;
  const tc = wcTemplateContext(st);
  const r = WC.resolveFields(fields, {
    lists: wcEngineLists(), rules: [...wcGlobalRules(), ...tc.rules], varDefs: tc.varDefs,
    seed: st.wild.seed, locks: st.wild.locks, salts: st.wild.salts
  });
  for (const [p, w] of Object.entries(writers)) w(r.values[p]);
  if (wcPaletteFollow) wcApplyRolledPalettes(st, r, Object.keys(writers));
  r.written = Object.keys(writers);
  r.fieldCount = fields.length;
  return r;
}
// Colours picked from a colour list become the palette of the element (or the
// image) they were picked for. Without this, an element's old palette (sent as
// hex codes, which Moss and Ideogram follow closely) overrides the rolled words —
// "scarlet tee" comes out in the palette's lavender.
function wcColourHex(name) {
  const n = String(name || "").trim().toLowerCase();
  if (typeof WC_COLOUR_HEX === "object" && WC_COLOUR_HEX[n]) return WC_COLOUR_HEX[n];
  try {   // other colour words the browser knows (CSS names like "navy", "darkgreen")
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = "#010203"; c.fillStyle = n.replace(/\s+/g, "");
    return c.fillStyle !== "#010203" && /^#[0-9a-f]{6}$/i.test(c.fillStyle) ? c.fillStyle.toUpperCase() : null;
  } catch (_) { return null; }
}
function wcApplyRolledPalettes(st, r, written) {
  const hexBy = {};
  for (const t of r.trace) {
    if (!t.list || !/(^|\/)colou?rs$/.test(t.list)) continue;
    const hex = wcColourHex(t.value);
    if (!hex) continue;
    const f = wcFieldOfSlot(t.id, st);
    (hexBy[f] = hexBy[f] || []).push(hex);
  }
  const collect = test => Array.from(new Set(Object.entries(hexBy).filter(([f]) => test(f)).flatMap(([, h]) => h)));
  for (const el of st.elements) {
    const pre = "e:" + (el.wild && el.wild.key) + ".";
    if (!written.some(p => p.startsWith(pre))) continue;
    const hex = collect(f => f.startsWith(pre));
    if (hex.length) { el.color_palette = hex.slice(0, 4); el.wild.palRolled = JSON.stringify(el.color_palette); }
    else if (wcIsLeftoverPalette(el.color_palette, el.wild.palRolled)) { el.color_palette = []; delete el.wild.palRolled; }   // an old roll's or the example's palette would tint it
  }
  const globalWritten = written.filter(p => !p.startsWith("e:"));
  const tpl = wcGetTemplate(st.wild && st.wild.templateId);
  if (globalWritten.length && !(tpl && tpl.global && Array.isArray(tpl.global.color_palette) && tpl.global.color_palette.length)) {
    const hex = collect(f => !f.startsWith("e:"));
    if (hex.length) { st.style_description.color_palette = hex.slice(0, 5); if (st.wild) st.wild.palRolled = JSON.stringify(st.style_description.color_palette); }
    else if (wcIsLeftoverPalette(st.style_description.color_palette, st.wild && st.wild.palRolled)) { st.style_description.color_palette = []; if (st.wild) delete st.wild.palRolled; }
  }
}
// A palette nobody chose by hand: the starting example's, one an earlier roll
// set (remembered in palRolled, or — for rolls made before that was tracked —
// made only of starter colour-list hex codes). A roll that picks no colour for
// that element clears it, so last roll's magenta doesn't dress every new roll.
function wcIsLeftoverPalette(pal, rolled) {
  if (!Array.isArray(pal) || !pal.length) return false;
  const j = JSON.stringify(pal);
  if (WC_DEMO_PALETTES.includes(j) || (rolled && rolled === j)) return true;
  if (typeof WC_COLOUR_HEX !== "object") return false;
  const known = new Set(Object.values(WC_COLOUR_HEX).map(h => String(h).toUpperCase()));
  return pal.every(h => known.has(String(h).toUpperCase()));
}
// Deterministic re-run without writing: the trace of the current state's picks.
function wcCurrentTrace() {
  const st = cloneState(state);
  return wcRollInto(st, { onlyPaths: new Set() });
}
function wcHasUnresolved(st) {
  st = st || state;
  if (WC_GLOBAL_FIELDS.some(f => WC.hasSyntax(f.get(st)))) return true;
  return st.elements.some(el => el.enabled !== false && WC_EL_FIELDS.some(f => WC.hasSyntax(f.get(el))));
}

// Apply a new state as one undo step, keeping the selection (unlike commitState).
function wcCommit(next, label) {
  undoStack.push({ label, state: cloneState(state) });
  if (undoStack.length > 15) undoStack.shift();
  const sel = new Set(selectedIds), selId = selectedId;
  state = next;
  selectedIds.clear();
  for (const id of sel) if (state.elements.some(e => e._id === id)) selectedIds.add(id);
  selectedId = state.elements.some(e => e._id === selId) ? selId : null;
  render(); syncUndoBtn();
}
function wcReport(r, what) {
  if (r.errors && r.errors.length) toast("Wildcards: " + r.errors.slice(0, 2).join(" · ") + (r.errors.length > 2 ? ` (+${r.errors.length - 2} more)` : ""), "bad");
  else if (what) toast(what, "ok");
}
const WC_NOTHING = "Nothing to roll — put wildcards like __colours__ or {a|b} in a field, or apply a style template.";

function wcRollAll() {
  const next = cloneState(state);
  const r = wcRollInto(next, { newSeed: true });
  if (!r.fieldCount) { toast(WC_NOTHING, "bad"); return; }
  wcCommit(next, "Roll wildcards");
  wcReport(r, `🎲 Rolled ${r.written.length} field${r.written.length === 1 ? "" : "s"}`);
}
function wcSelectedKeys() {
  const ids = selectedIds.size ? selectedIds : (selectedId != null ? new Set([selectedId]) : new Set());
  return new Set(state.elements.filter(e => ids.has(e._id)).map(e => e.wild.key));
}
function wcRollSelected() {
  const keys = wcSelectedKeys();
  if (!keys.size) { toast("Select one or more elements first (click, or Ctrl-click on the canvas).", "bad"); return; }
  wcRollElements(keys, "Roll selected elements");
}
function wcRollElements(keys, label) {
  const next = cloneState(state);
  const r = wcRollInto(next, { global: false, elementKeys: keys, bump: true });
  if (!r.written.length) { toast("Those elements have no wildcard fields. " + WC_NOTHING, "bad"); return; }
  wcCommit(next, label);
  wcReport(r, `🎲 Rolled ${r.written.length} field${r.written.length === 1 ? "" : "s"}`);
}
function wcRollPaths(paths, label) {
  const next = cloneState(state);
  const r = wcRollInto(next, { onlyPaths: new Set(paths), bump: true });
  wcCommit(next, label || "Roll field");
  wcReport(r);
}
function wcRerollPick(id, fieldPath) {
  const next = cloneState(state);
  next.wild.salts[id] = (next.wild.salts[id] || 0) + 1;
  delete next.wild.locks[id];
  const r = wcRollInto(next, { onlyPaths: new Set([fieldPath]) });
  wcCommit(next, "Re-roll one pick");
  wcReport(r);
}
// A template variable changed: every wildcard field is re-evaluated (locked picks stay).
function wcRerollVar(id) {
  const next = cloneState(state);
  next.wild.salts[id] = (next.wild.salts[id] || 0) + 1;
  delete next.wild.locks[id];
  const r = wcRollInto(next, {});
  wcCommit(next, "Re-roll variable");
  wcReport(r);
}
function wcToggleLock(id, value) {
  if (Object.prototype.hasOwnProperty.call(state.wild.locks, id)) delete state.wild.locks[id];
  else state.wild.locks[id] = value;
  scheduleSaveState(); wcSyncMenu();
}
function wcClearLocks() {
  const n = Object.keys(state.wild.locks || {}).length;
  state.wild.locks = {}; scheduleSaveState(); wcSyncMenu();
  toast(n ? `Cleared ${n} lock${n === 1 ? "" : "s"}` : "No locked picks", "ok");
}
// Before copy / download / render: no raw wildcard syntax may reach the prompt.
function wcEnsureRolled() {
  if (!wcHasUnresolved()) return;
  if (!wcAutoRoll) { toast("Some fields still contain wildcard syntax — roll them (🎲) or turn on auto-roll.", "bad"); return; }
  const next = cloneState(state);
  const r = wcRollInto(next, { onlyUnresolved: true });
  wcCommit(next, "Auto-roll wildcards");
  wcReport(r, `🎲 Rolled ${r.written.length} wildcard field${r.written.length === 1 ? "" : "s"} first`);
}
// Render queue: fresh picks every iteration (no undo entry; locked picks stay).
function wcRollForQueue() {
  const next = cloneState(state);
  const r = wcRollInto(next, { newSeed: true });
  if (!r.fieldCount) return;
  state = next; render();
  if (r.errors.length) wcReport(r);
}
// Wildcards in free text (the Generate description): new picks every call.
function wcResolveText(text) {
  if (!WC.hasSyntax(text)) return text;
  const tc = wcTemplateContext(state);
  const r = WC.resolve(text, { lists: wcEngineLists(), rules: [...wcGlobalRules(), ...tc.rules], seed: WC.newSeed(), path: "gen" });
  wcReport(r);
  return r.text;
}
async function wcRollBatchPick(n) {
  n = Math.max(2, Math.min(8, n | 0 || 4));
  if (!wcCurrentTrace().fieldCount) { toast(WC_NOTHING, "bad"); return; }
  await proposeChange({ label: `Roll ×${n}`, detail: `${n} rolls with different seeds — pick one.`, builds: Array.from({ length: n }, () => () => { wcRollInto(state, { newSeed: true }); }) });
}

/* ------------------------------------------------------------------ */
/*  Batch download (ZIP of N rolled prompts in the current format)    */
/* ------------------------------------------------------------------ */
async function wcBatchDownload(n) {
  n = Math.max(1, Math.min(200, n | 0 || 10));
  if (!wcCurrentTrace().fieldCount) { toast(WC_NOTHING, "bad"); return; }
  const fmt = jsonFormat, saved = state, files = [];
  try {
    for (let i = 0; i < n; i++) {
      const st = cloneState(saved);
      const r = wcRollInto(st, { newSeed: true });
      state = st;
      const num = String(i + 1).padStart(String(n).length, "0");
      if (fmt === "moss") {
        const v = buildMossJSON();
        files.push({ name: `moss-${num}-${st.wild.seed}.${typeof v === "string" ? "txt" : "json"}`, data: stringifyPrompt(v) });
      } else files.push({ name: `ideogram-${num}-${st.wild.seed}.json`, data: stringifyPrompt(buildIdeogramDownload()) });
      if (i === 0 && r.errors.length) wcReport(r);
    }
  } finally { state = saved; }
  wcDownloadBlob(wcZip(files), `${fmt}-batch-${n}.zip`);
  toast(`Downloaded ${n} rolled ${fmt === "moss" ? "Moss Image" : "Ideogram"} prompts ✓`, "ok");
}

/* ------------------------------------------------------------------ */
/*  AI polish: turn the picks into one coherent prompt                */
/* ------------------------------------------------------------------ */
const WC_POLISH_PROMPT = SYSTEM_PROMPT + `

You will receive a CURRENT SETUP whose fields were filled in by random wildcard picks and style templates, and the list of PICKED INGREDIENTS. Rewrite the setup into one coherent, natural prompt:
- Keep every element: the same number, order, types, bboxes and literal "text". Do not add or remove elements.
- Every picked ingredient must still be there (rephrase freely). When two picks contradict each other, keep the more specific one and adapt the other so the scene makes sense.
- Keep each element's "style" object (tidy its wording if needed) and make the desc agree with it.
- Make high_level_description, style_description and background agree with each other and with the elements.
- Return the full JSON setup only.`;
function wcIngredients(st, trace) {
  const byField = {};
  for (const t of trace || []) {
    if (t.depth !== 0) continue;
    const path = wcFieldOfSlot(t.id, st);
    (byField[path] = byField[path] || []).push(String(t.value).trim() + (t.list ? ` (from ${t.list})` : ""));
  }
  const lines = Object.entries(byField).map(([p, v]) => `- ${wcPathLabel(p, st)}: ${v.filter(Boolean).join("; ")}`);
  return lines.join("\n");
}
function wcFieldOfSlot(id, st) {
  const paths = [...WC_GLOBAL_FIELDS.map(f => f.path), ...st.elements.flatMap(el => WC_EL_FIELDS.map(f => wcElPath(el, f.key)))];
  return paths.filter(p => id.startsWith(p + ".")).sort((a, b) => b.length - a.length)[0] || id.split(".")[0];
}
async function wcPolish({ roll }) {
  let cfgOk;
  try { cfgOk = llmSetup(); } catch (err) { toast(err.message, "bad"); openSettings(); return; }
  const { cfg, headers } = cfgOk;
  const base = cloneState(state);
  const r = roll ? wcRollInto(base, { newSeed: true }) : wcRollInto(cloneState(base), { onlyPaths: new Set() });
  const saved = state;
  let layout, lockText;
  state = base;   // llmLayoutWithLocks / lockDirective read the global state
  try { const x = llmLayoutWithLocks(); layout = x.layout; lockText = lockDirective(x.locked); } finally { state = saved; }
  const tc = wcTemplateContext(base);
  const ing = wcIngredients(base, r.trace);
  const userMsg = "Current setup:\n" + JSON.stringify(layout, null, 2) + lockText +
    (ing ? "\n\nPICKED INGREDIENTS (keep all of them):\n" + ing : "") +
    (tc.notes.length ? "\n\nSTYLE TEMPLATE NOTES:\n- " + tc.notes.join("\n- ") : "") +
    "\n\nRewrite this into one coherent prompt.";
  const body = { model: cfg.model, temperature: cfg.temperature, response_format: { type: "json_object" },
    messages: [{ role: "system", content: WC_POLISH_PROMPT + targetDirective() }, { role: "user", content: userMsg }] };
  toast("✨ Polishing with AI…", "");
  try {
    const results = await llmLayouts(cfg, headers, body, aiVariations);
    if (!results.length) { toast("The model's reply wasn't a usable layout.", "bad"); return; }
    await proposeChange({
      label: roll ? "Roll + AI polish" : "AI polish", detail: ing ? "Ingredients:\n" + ing : "Polish the current setup",
      builds: results.map(parsed => () => { state = cloneState(base); applyLLMLayout(parsed, base, true); })
    });
  } catch (err) { toast(netError(err, cfg).message || String(err), "bad"); }
}

/* ------------------------------------------------------------------ */
/*  Style templates: apply                                            */
/* ------------------------------------------------------------------ */
const WC_TPL_GLOBAL_KEYS = ["aesthetics", "lighting", "photo", "medium", "art_style"];
function wcApplyTemplateTo(st, tpl, { image = true, elementKeys = null } = {}) {
  const T = wcTemplateFor(tpl, aiTarget());
  const G = T.global || {}, E = T.element || {};
  st.wild = st.wild || normWild();
  const setGlobal = (path, apply) => { delete st.wild.src[path]; apply(); };
  if (image) {
    for (const k of WC_TPL_GLOBAL_KEYS) if (G[k] !== undefined) setGlobal("style." + k, () => { st.style_description[k] = G[k]; });
    if (G.background !== undefined) setGlobal("background", () => { st.background = G.background; });
    if (Array.isArray(G.color_palette) && G.color_palette.length) st.style_description.color_palette = G.color_palette.map(c => String(c).toUpperCase());
    else if (wcIsLeftoverPalette(st.style_description.color_palette, st.wild && st.wild.palRolled)) { st.style_description.color_palette = []; if (st.wild) delete st.wild.palRolled; }   // drop the example's or an old roll's palette
    if (G.hld_suffix || typeof st.wild.hldBase === "string") {
      const baseText = typeof st.wild.hldBase === "string" ? st.wild.hldBase : st.high_level_description;
      delete st.wild.src.hld;
      if (G.hld_suffix) {
        st.wild.hldBase = baseText;
        const b = String(baseText || "").trim().replace(/[\s.]+$/, "");
        st.high_level_description = (b ? wcEsc(b) + ", " : "") + G.hld_suffix + (b ? "." : "");
      } else { st.high_level_description = baseText; delete st.wild.hldBase; }
    }
    st.wild.templateId = tpl.id;
  }
  let targets = [];
  if (elementKeys) targets = st.elements.filter(e => elementKeys.has(e.wild.key));
  else if (image && tpl.scope !== "global") {
    const types = Array.isArray(tpl.appliesTo) && tpl.appliesTo.length ? tpl.appliesTo : ["subject"];
    targets = st.elements.filter(e => e.enabled !== false && types.includes(e.type));
  }
  for (const el of targets) {
    el.wild = el.wild || normElWild();
    // Switching templates: drop the fields the previous template filled in.
    const prevT = el.wild.templateId && el.wild.templateId !== tpl.id ? wcGetTemplate(el.wild.templateId) : null;
    if (prevT) for (const k of ELEMENT_STYLE_KEYS) if (prevT.element && prevT.element[k]) { delete el.style[k]; delete el.wild.src["style." + k]; }
    el.wild.templateId = tpl.id;
    if (wcIsLeftoverPalette(el.color_palette, el.wild.palRolled)) { el.color_palette = []; delete el.wild.palRolled; }   // drop the example's or an old roll's palette
    for (const k of ELEMENT_STYLE_KEYS) {
      if (E[k] == null || E[k] === "") continue;
      el.style[k] = E[k];
      delete el.wild.src["style." + k];
    }
    if (E.desc_prefix || E.desc_suffix || typeof el.wild.descBase === "string") {
      const baseText = typeof el.wild.descBase === "string" ? el.wild.descBase : el.desc;
      delete el.wild.src.desc;
      if (E.desc_prefix || E.desc_suffix) {
        el.wild.descBase = baseText;
        const b = String(baseText || "").trim();
        el.desc = (E.desc_prefix ? E.desc_prefix + " " : "") + wcEsc(b) + (E.desc_suffix ? (b ? (/[.!?]$/.test(b) ? " " : ", ") : "") + E.desc_suffix : "");
      } else { el.desc = baseText; delete el.wild.descBase; }
    }
  }
  return wcRollInto(st, { global: image, elementKeys: new Set(targets.map(e => e.wild.key)) });
}
async function wcApplyTemplateReview(tpl, where) {
  const keys = where === "selected" ? wcSelectedKeys() : null;
  if (where === "selected" && !keys.size) { toast("Select one or more elements first.", "bad"); return; }
  wcCloseModal("wcTplOverlay");
  let errs = [];
  await proposeChange({
    label: `Apply template “${tpl.name}”` + (where === "selected" ? " to selected" : ""),
    detail: wcTemplateSummary(tpl),
    build: () => { errs = wcApplyTemplateTo(state, tpl, where === "selected" ? { image: false, elementKeys: keys } : { image: true }).errors; }
  });
  if (errs.length) wcReport({ errors: errs });
}
function wcApplyTemplateToElement(el, id) {
  const next = cloneState(state);
  const nel = next.elements.find(e => e.wild.key === el.wild.key);
  if (!nel) return;
  if (!id) { nel.wild.templateId = ""; wcCommit(next, "Remove element template"); return; }
  const tpl = wcGetTemplate(id);
  if (!tpl) return;
  const r = wcApplyTemplateTo(next, tpl, { image: false, elementKeys: new Set([nel.wild.key]) });
  wcCommit(next, "Template on element: " + tpl.name);
  wcReport(r, "🎭 " + tpl.name + " applied to the element");
}
function wcTemplateSummary(t) {
  const G = t.global || {}, E = t.element || {}, out = [];
  for (const k of [...WC_TPL_GLOBAL_KEYS, "background", "hld_suffix"]) if (G[k]) out.push(k.replace("_", " ") + ": " + G[k]);
  const el = ELEMENT_STYLE_KEYS.filter(k => E[k]).map(k => k + ": " + E[k]);
  if (el.length) out.push("elements → " + el.join("; "));
  if (t.vars && Object.keys(t.vars).length) out.push("vars: " + Object.entries(t.vars).map(([k, v]) => k + "=" + v).join(", "));
  return out.join("\n");
}
// Generate modal: the chosen template, rolled, as extra requirements.
function wcGenerateIngredients() {
  // The new setup gets linked to this template and rolled after the model
  // answers (wcLinkGenerated), so the model must leave the template's parts
  // out of its text — otherwise "wearing jeans" in a description fights the
  // rolled "maxi skirt" and the picture gets both.
  const tpl = wcGenTemplate();
  if (!tpl) return "";
  const T = wcTemplateFor(tpl, aiTarget()), G = T.global || {};
  const fields = [];
  for (const k of ["aesthetics", "medium", "art_style", "hld_suffix"]) if (G[k]) fields.push({ path: "g." + k, text: G[k] });
  const r = WC.resolveFields(fields, { lists: wcEngineLists(), rules: [...wcGlobalRules(), ...(tpl.rules || [])], varDefs: tpl.vars || {}, seed: WC.newSeed() });
  const feel = ["aesthetics", "medium", "art_style", "hld_suffix"].map(k => r.values["g." + k]).filter(Boolean);
  const aspects = wcTemplateAspects(tpl);
  let s = `Follow the “${tpl.name}” style template` + (feel.length ? ` (${feel.join("; ")})` : "") + ".";
  if (aspects.length) s += ` The template fills in ${aspects.join(", ")} by itself on every render. Do NOT describe any of those anywhere — not in high_level_description, not in background, not in any element's desc, and leave the elements' "style" objects out. In particular never say what anyone is wearing. Each element's desc says only who or what it is, what it is doing, and what it holds.`;
  if (tpl.llmNotes) s += " " + tpl.llmNotes;
  return s;
}

/* ------------------------------------------------------------------ */
/*  The AI and templates: who decides what                            */
/* ------------------------------------------------------------------ */
// The template is in charge of the "how" (light, camera, clothes, place...) and
// re-rolls it; the AI model is in charge of the "what" (who, doing what, where
// in the frame). These keep the AI from baking the how into fixed text.

// The style template chosen in Generate (resolving "the image's current template").
function wcGenTemplate() {
  const sel = document.getElementById("genStyleTpl");
  const v = sel ? sel.value : wcLoad(WCS_GENTPL_KEY, "@current");
  return wcGetTemplate(v === "@current" ? (state.wild && state.wild.templateId) : v);
}
// Plain-words list of what a template rolls, for telling the AI to leave it out.
const WC_TPL_ASPECTS = {
  aesthetics: "the visual style", medium: "the medium (photo, painting...)", art_style: "the art style", lighting: "the lighting",
  photo: "camera, lens and framing technique", background: "the setting, location, time of day and weather",
  camera: "camera angle and shot type", lens: "lens", wardrobe: "clothing, outfit colours and accessories", pose: "the pose",
  environment: "the surroundings", mood: "the mood and expression", extra: "props and small extras",
};
function wcTemplateAspects(tpl) {
  if (!tpl) return [];
  const T = wcTemplateFor(tpl, aiTarget()), G = T.global || {}, E = T.element || {};
  const keys = [...Object.keys(G).filter(k => G[k] && WC_TPL_ASPECTS[k]), ...Object.keys(E).filter(k => E[k] && WC_TPL_ASPECTS[k])];
  const out = Array.from(new Set(keys.map(k => WC_TPL_ASPECTS[k])));
  if ((G.color_palette && G.color_palette.length) || E.wardrobe) out.push("colour palette");
  return Array.from(new Set(out));
}
// ✍ Improve description, when a template is chosen: write only the what.
function wcImproveDirective() {
  const tpl = wcGenTemplate();
  const aspects = wcTemplateAspects(tpl);
  if (!tpl || !aspects.length) return "";
  return `\n\nIMPORTANT: the “${tpl.name}” style template decides — and re-rolls on every render — ${aspects.join(", ")}. Do NOT mention any of those. Describe ONLY: who or what is in the picture (how many, age range, hair, build), what each is doing, their expression only if the template doesn't set the mood, where each sits in the frame (left/right/centre, near/far, full body or close-up), any props they hold, and any words the image must show, in double quotes. 2 to 4 sentences.`;
}
// Generate: link the new setup to the chosen template, so 🎲 Roll and queue
// re-rolls keep varying it. The template's fields replace the model's fixed
// wording of them and are rolled right away.
// Safety net for models that describe clothes anyway: drop "wearing ..." /
// "dressed in ..." phrases when the template supplies the outfit.
function wcStripWearing(text) {
  if (!text) return text;
  const verbs = "is|are|was|were|who|while|as|stands?|sits?|captured|holding|holds|punch\\w*|kick\\w*|ride\\w*|riding|skat\\w*|look\\w*|with\\s+(?:a|an|her|his|their)\\b";
  const re = new RegExp(",?\\s*\\b(?:wearing|dressed in|clad in|clothed in)\\b[^.;]*?(?=(?:,\\s*|\\s+)(?:" + verbs + ")\\b|[.;]|$)", "gi");
  return String(text).replace(re, "").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/,(\s*(?:is|are|was|were)\b)/gi, "$1").replace(/\s{2,}/g, " ").trim();
}
function wcLinkGenerated(st) {
  if (st.wild) { delete st.wild.hldBase; if (st.wild.src) delete st.wild.src.hld; }   // the old setup's description text isn't the new one's
  const tpl = wcGenTemplate();
  if (!tpl) return false;
  const E = wcTemplateFor(tpl, aiTarget()).element || {};
  if (E.wardrobe) {
    st.high_level_description = wcStripWearing(st.high_level_description);
    for (const el of st.elements) if (el.type === "subject" && el.desc) el.desc = wcStripWearing(el.desc);
  }
  wcApplyTemplateTo(st, tpl);
  wcRollInto(st, { newSeed: true, onlyUnresolved: true });
  return true;
}
// Refine: tell the model which fields the template rolls.
function wcTemplateFieldsOf(st) {
  const g = WC_GLOBAL_FIELDS.filter(f => st.wild && st.wild.src && st.wild.src[f.path] && f.path !== "hld").map(f => f.path === "background" ? "background" : "style_description." + f.path.slice(6));
  const e = new Set();
  for (const el of st.elements) for (const k of ELEMENT_STYLE_KEYS) if (el.wild && el.wild.src && el.wild.src["style." + k]) e.add(k);
  return { g, e: Array.from(e) };
}
function wcRefineDirective(st) {
  const { g, e } = wcTemplateFieldsOf(st || state);
  if (!g.length && !e.length) return "";
  const parts = [...g, ...e.map(k => `the elements' "style.${k}"`)];
  return `\n\nThese fields come from a style template that re-rolls them automatically: ${parts.join(", ")}. Return them EXACTLY as given unless the change request is specifically about them.`;
}
// Words that show a change request is about a field. Used after Refine: a
// template field the model changed is kept (and stops rolling) only when the
// request is about it; otherwise the rolled value comes back.
const WC_FIELD_WORDS = {
  lighting: "light|lit|shadow|dark|bright|sun|glow|neon|night|dusk|dawn|golden|moody|silhouette|flash",
  photo: "camera|lens|angle|shot|close|wide|zoom|focus|telephoto|mm\\b|aperture|depth|bokeh|blur",
  camera: "camera|angle|shot|close|wide|zoom|overhead|low angle|high angle|framing",
  lens: "lens|mm\\b|aperture|focus|bokeh|telephoto|wide|fisheye|depth",
  aesthetics: "style|look|aesthetic|grade|vibe|retro|vintage|cinematic|gritty|clean|minimal",
  medium: "medium|photo|painting|illustration|render|drawing|anime|cartoon|sketch|film|3d",
  art_style: "style|painting|illustration|anime|cartoon|sketch|art",
  background: "background|setting|location|place|scene|behind|weather|rain|snow|fog|city|street|indoor|outdoor|park|beach|sky|room|studio|forest|night|day|sunset",
  environment: "background|setting|surround|location|place|scene|behind|weather|indoor|outdoor",
  wardrobe: "outfit|cloth|wear|dress|shirt|top|hoodie|jacket|coat|trousers|jeans|shorts|skirt|shoe|trainer|sneaker|boot|hat|cap|uniform|colou?r",
  pose: "pose|stand|sit|jump|run|arm|hand|kneel|crouch|lean|action|move|ollie|trick|walk",
  mood: "mood|expression|smil|angry|happy|sad|serious|feel|emotion|face",
  extra: "hold|prop|accessor|extra|carry|add",
};
function wcRequestIsAbout(key, instruction) {
  const words = WC_FIELD_WORDS[key];
  if (!words) return false;
  let re = words;
  if (key === "wardrobe" && typeof WC_COLOUR_HEX === "object") re += "|" + Object.keys(WC_COLOUR_HEX).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp("\\b(" + re + ")", "i").test(String(instruction || ""));
}
// After Refine: for each template-rolled field the model changed, either keep the
// change (request was about it — the field stops rolling) or put the rolled value back.
function wcAfterRefine(prev, st, instruction) {
  const kept = [], restored = [];
  if (st.wild && st.wild.src) for (const f of WC_GLOBAL_FIELDS) {
    if (f.path === "hld" || !st.wild.src[f.path]) continue;
    const before = f.get(prev), now = f.get(st);
    if (before === now) continue;
    const key = f.path === "background" ? "background" : f.path.slice(6);
    if (wcRequestIsAbout(key, instruction)) { delete st.wild.src[f.path]; kept.push(f.label); }
    else { f.set(st, before); restored.push(f.label); }
  }
  for (const el of st.elements) {
    const src = el.wild && el.wild.src;
    if (!src) continue;
    const old = prev.elements.find(p => p.wild && p.wild.key === el.wild.key);
    if (!old) continue;
    for (const k of ELEMENT_STYLE_KEYS) {
      if (!src["style." + k]) continue;
      const before = (old.style && old.style[k]) || "", now = (el.style && el.style[k]) || "";
      if (before === now) continue;
      if (wcRequestIsAbout(k, instruction)) {
        delete src["style." + k]; kept.push(k);
        // the rolled colour's palette would tint the new outfit — unless the model chose a new one
        if (k === "wardrobe" && el.wild.palRolled && JSON.stringify(el.color_palette) === el.wild.palRolled) { el.color_palette = []; delete el.wild.palRolled; }
      }
      else { el.style = el.style || {}; if (before) el.style[k] = before; else delete el.style[k]; restored.push(k); }
    }
  }
  return { kept, restored };
}

/* ------------------------------------------------------------------ */
/*  Modal plumbing (same look as the app's own modals)                */
/* ------------------------------------------------------------------ */
function wcModal(id, title, maxWidth) {
  let ov = document.getElementById(id);
  if (ov) return ov._wc;
  ov = wcEl("div", { class: "overlay", id });
  const status = wcEl("span", { class: "status", style: { flex: "1" } });
  const body = wcEl("div", { class: "modal-body" });
  const foot = wcEl("div", { class: "modal-foot" }, status);
  const h2 = wcEl("h2", {}, title);
  const modal = wcEl("div", { class: "modal", style: { maxWidth: maxWidth || "760px" } },
    wcEl("div", { class: "modal-head" }, h2, wcEl("button", { class: "close", onclick: () => wcCloseModal(id) }, "×")), body, foot);
  ov.append(modal);
  let pressedSelf = false;
  ov.addEventListener("mousedown", e => { pressedSelf = e.target === ov; });
  ov.addEventListener("click", e => { if (e.target === ov && pressedSelf) wcCloseModal(id); });
  document.body.append(ov);
  ov._wc = { ov, modal, body, foot, status, h2, setStatus: (msg, cls) => { status.innerHTML = msg || ""; status.className = "status " + (cls || ""); } };
  return ov._wc;
}
function wcOpenModal(id) { document.getElementById(id).classList.add("show"); if (typeof wcSyncSplit === "function") wcSyncSplit(); }
function wcCloseModal(id) { const o = document.getElementById(id); if (o) o.classList.remove("show"); if (typeof wcSyncSplit === "function") wcSyncSplit(); }
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (wcPopEl && wcPopEl.style.display !== "none") { wcClosePop(); e.stopPropagation(); return; }
  if (wcMenuEl && wcMenuEl.style.display !== "none") { wcCloseMenu(); return; }
  const open = Array.from(document.querySelectorAll(".overlay.show")).filter(o => o.id.startsWith("wc"));
  if (open.length) wcCloseModal(open[open.length - 1].id);
}, true);

/* ------------------------------------------------------------------ */
/*  Field badges + picks popover                                      */
/* ------------------------------------------------------------------ */
let wcPopEl = null;
function wcFieldInfo(path) {
  const g = WC_GLOBAL_FIELDS.find(f => f.path === path);
  if (g) return { path, label: g.label, cur: g.get(state), src: state.wild.src[path] || "", setSrc: v => { if (v) state.wild.src[path] = v; else delete state.wild.src[path]; } };
  const m = /^e:([^.]+)\.(.+)$/.exec(path);
  const el = m && state.elements.find(e => e.wild && e.wild.key === m[1]);
  const f = m && WC_EL_FIELDS.find(f => f.key === m[2]);
  if (!el || !f) return null;
  return { path, label: wcPathLabel(path), cur: f.get(el), src: el.wild.src[f.key] || "", setSrc: v => { if (v) el.wild.src[f.key] = v; else delete el.wild.src[f.key]; } };
}
function wcBadgeFor(path) {
  const info = wcFieldInfo(path);
  if (!info) return null;
  const live = WC.hasSyntax(info.cur), hasSrc = !!info.src;
  if (!live && !hasSrc) return null;
  const b = wcEl("button", {
    class: "wc-badge" + (live ? " unresolved" : ""), type: "button",
    title: live ? "Wildcards not rolled yet — click to roll / see picks" : "Rolled from wildcards — click to see picks, lock or re-roll",
    onclick: e => { e.stopPropagation(); wcOpenPop(b, path); }
  }, live ? "🎲 roll" : "🎲");
  b.dataset.path = path;
  return b;
}
function wcDecorateForm() {
  if (!state.wild) state.wild = normWild();
  for (const f of WC_GLOBAL_FIELDS) {
    const input = document.getElementById(f.input);
    if (!input) continue;
    const old = input.parentNode.querySelector(`.wc-badge[data-path="${f.path}"]`);
    if (old) old.remove();
    const b = wcBadgeFor(f.path);
    if (b) input.insertAdjacentElement("afterend", b);
  }
}
function wcClosePop() { if (wcPopEl) wcPopEl.style.display = "none"; }
function wcOpenPop(anchor, path) {
  if (!wcPopEl) {
    wcPopEl = wcEl("div", { class: "wc-pop" });
    document.body.append(wcPopEl);
    document.addEventListener("mousedown", e => { if (wcPopEl.style.display !== "none" && !wcPopEl.contains(e.target) && !e.target.closest(".wc-badge")) wcClosePop(); });
  }
  const info = wcFieldInfo(path);
  if (!info) return;
  const tr = wcCurrentTrace();
  // this field's picks, then the template variables (shared by every field)
  const picks = tr.trace.filter(t => wcFieldOfSlot(t.id, state) === path)
    .concat(tr.trace.filter(t => t.id.startsWith("var:") && t.depth === 0).map(t => ({ ...t, token: "${" + t.id.slice(4).replace(/\.\d+$/, "") + "} = " + t.token, isVar: true })));
  const srcTa = wcEl("textarea", { rows: 3, onkeydown: wcStop, spellcheck: false }, );
  srcTa.value = info.src || (WC.hasSyntax(info.cur) ? info.cur : "");
  const rows = picks.length ? picks.map(t => {
    const locked = Object.prototype.hasOwnProperty.call(state.wild.locks, t.id);
    return wcEl("div", { class: "wc-pick" + (t.depth ? " nested" : ""), style: { paddingLeft: (t.depth * 14) + "px" } },
      wcEl("code", { title: t.id }, wcShort(t.token, 40)),
      wcEl("span", { class: "wc-pick-val" }, String(t.value).trim() || "(nothing)"),
      wcEl("button", { class: "iconbtn" + (locked ? " on" : ""), title: locked ? "Unlock this pick" : "Lock this pick — it stays when you roll again", onclick: () => { wcToggleLock(t.id, t.value); wcOpenPop(anchor, path); } }, locked ? "🔒" : "🔓"),
      wcEl("button", { class: "iconbtn", title: t.isVar ? "Re-roll this variable (every field that uses it follows)" : "Re-roll only this pick",
        onclick: () => { if (t.isVar) wcRerollVar(t.id); else wcRerollPick(t.id, path); wcReopenPop(path); } }, "↻"));
  }) : [wcEl("div", { class: "hint" }, WC.hasSyntax(info.cur) ? "Not rolled yet." : "No picks.")];
  const errs = tr.errors.length ? wcEl("div", { class: "status err" }, tr.errors.join(" · ")) : null;
  wcPopEl.replaceChildren(
    wcEl("div", { class: "wc-pop-head" }, wcEl("b", {}, info.label), wcEl("button", { class: "iconbtn", onclick: wcClosePop }, "×")),
    wcEl("label", {}, "Wildcard source"), srcTa,
    wcEl("div", { class: "wc-pop-row" },
      wcEl("button", { class: "primary", onclick: () => { info.setSrc(srcTa.value.trim()); wcRollPaths([path], "Roll " + info.label); wcReopenPop(path); } }, "🎲 Roll this field"),
      wcEl("button", { onclick: () => { info.setSrc(""); scheduleSaveState(); render(); wcClosePop(); toast("Detached — the field keeps its text and won't re-roll", "ok"); }, title: "Forget the wildcard source; keep the current text" }, "Detach")),
    wcEl("label", {}, "Picks"), wcEl("div", { class: "wc-picks" }, rows), ...(errs ? [errs] : []));
  wcPopEl.style.display = "block";
  const r = anchor.getBoundingClientRect(), pw = Math.min(420, window.innerWidth - 16);
  wcPopEl.style.width = pw + "px";
  wcPopEl.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.right - pw)) + "px";
  const below = r.bottom + 6, h = wcPopEl.offsetHeight;
  wcPopEl.style.top = (below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : below) + "px";
}
function wcReopenPop(path) {
  setTimeout(() => { const b = document.querySelector(`.wc-badge[data-path="${CSS.escape(path)}"]`); if (b) wcOpenPop(b, path); else wcClosePop(); }, 0);
}

/* ------------------------------------------------------------------ */
/*  Element card: Style & wildcards section                           */
/* ------------------------------------------------------------------ */
const wcOpenStyle = new Set();   // element keys whose Style section is expanded
let wcLastFocus = null;          // last text field focused inside an element card (for "insert wildcard")
function wcListOptions(sel, placeholder) {
  sel.replaceChildren(wcEl("option", { value: "" }, placeholder));
  const names = Object.keys(wcAllLists()).sort();
  const groups = {};
  for (const n of names) { const g = n.includes("/") ? n.split("/")[0] : "(top level)"; (groups[g] = groups[g] || []).push(n); }
  for (const [g, ns] of Object.entries(groups)) sel.append(wcEl("optgroup", { label: g }, ns.map(n => wcEl("option", { value: n }, "__" + n + "__"))));
}
function wcRefreshListPickers() { document.querySelectorAll("select.wc-insert").forEach(s => wcListOptions(s, s.dataset.ph || "+ wildcard")); }
function wcInsertAtCursor(field, text) {
  if (!field) return false;
  const s = field.selectionStart ?? field.value.length, e = field.selectionEnd ?? field.value.length;
  const pre = field.value.slice(0, s), post = field.value.slice(e);
  const pad = pre && !/\s$/.test(pre) ? " " : "";
  field.value = pre + pad + text + post;
  const pos = (pre + pad + text).length;
  field.focus(); field.setSelectionRange(pos, pos);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}
function wcTemplateSelect(value, onChange, { elementOnly } = {}) {
  const sel = wcEl("select", { class: "ai-target-sel", onchange: () => onChange(sel.value) });
  sel.append(wcEl("option", { value: "" }, "— no template —"));
  const cats = {};
  for (const t of wcAllTemplates()) {
    if (elementOnly && t.scope === "global") continue;
    (cats[t.category || "Other"] = cats[t.category || "Other"] || []).push(t);
  }
  for (const [c, ts] of Object.entries(cats)) sel.append(wcEl("optgroup", { label: c }, ts.map(t => wcEl("option", { value: t.id }, t.name))));
  sel.value = value || "";
  return sel;
}
function wcElementStyleSection(el, refs) {
  el.wild = el.wild || normElWild();
  el.style = el.style || {};
  const key = el.wild.key;
  const filled = ELEMENT_STYLE_KEYS.filter(k => el.style[k]).length;
  const tpl = wcGetTemplate(el.wild.templateId);
  const det = wcEl("details", { class: "wc-style", open: wcOpenStyle.has(key) || undefined });
  det.addEventListener("toggle", () => { if (det.open) wcOpenStyle.add(key); else wcOpenStyle.delete(key); });
  det.append(wcEl("summary", {}, "🎭 Style & wildcards",
    wcEl("span", { class: "wc-sum" }, [tpl ? tpl.name : "", filled ? filled + " field" + (filled > 1 ? "s" : "") : ""].filter(Boolean).join(" · "))));
  // template + actions
  const tplSel = wcTemplateSelect(el.wild.templateId, id => wcApplyTemplateToElement(el, id), { elementOnly: true });
  tplSel.title = "Apply a style template to this element (lighting, camera, wardrobe…)";
  const ins = wcEl("select", { class: "ai-target-sel wc-insert", title: "Insert a wildcard into the last text field you clicked in this element" });
  ins.dataset.ph = "+ wildcard";
  wcListOptions(ins, "+ wildcard");
  ins.addEventListener("change", () => {
    if (!ins.value) return;
    const target = wcLastFocus && card.contains(wcLastFocus) ? wcLastFocus : refs.desc;
    wcInsertAtCursor(target, "__" + ins.value + "__");
    ins.value = "";
  });
  const card = refs.desc.closest(".element") || refs.desc.parentNode;
  det.append(wcEl("div", { class: "wc-row" }, tplSel,
    wcEl("button", { class: "ghost", title: "New picks for this element's wildcards (others stay)", onclick: () => wcRollElements(new Set([key]), "Roll element") }, "🎲 Roll"),
    ins,
    wcEl("button", { class: "ghost", title: "Clear this element's style fields", onclick: () => {
      const next = cloneState(state), n = next.elements.find(e => e.wild.key === key);
      n.style = {}; Object.keys(n.wild.src).filter(k => k.startsWith("style.")).forEach(k => delete n.wild.src[k]); n.wild.templateId = "";
      wcCommit(next, "Clear element style");
    } }, "Clear")));
  // the style fields
  const grid = wcEl("div", { class: "wc-style-grid" });
  for (const [k, label] of ELEMENT_STYLE_FIELDS) {
    const path = wcElPath(el, "style." + k);
    const inp = wcEl("input", { type: "text", placeholder: WC_STYLE_HINTS[k] || "", onkeydown: wcStop });
    inp.value = el.style[k] || "";
    inp.addEventListener("focus", () => { wcLastFocus = inp; });
    inp.addEventListener("input", () => { if (inp.value.trim()) el.style[k] = inp.value; else delete el.style[k]; renderJSON(); });
    const lab = wcEl("label", {}, label);
    const b = wcBadgeFor(path);
    grid.append(wcEl("div", { class: "wc-field" }, lab, wcEl("div", { class: "wc-in" }, inp, b)));
  }
  det.append(grid);
  det.append(wcEl("div", { class: "hint" }, "These are added to the prompt as labelled sentences (“Lighting: …”). Any field — including the description — can use wildcards: ",
    wcEl("code", {}, "__colours__"), ", ", wcEl("code", {}, "{a|b}"), ", ", wcEl("code", {}, "{2$$__clothes/hats__}"), "."));
  // badge + focus tracking for the element's own text fields
  setTimeout(() => {
    refs.desc.addEventListener("focus", () => { wcLastFocus = refs.desc; });
    card.querySelectorAll("input[type=text], textarea").forEach(f => { if (!det.contains(f)) f.addEventListener("focus", () => { wcLastFocus = f; }); });
    const b = wcBadgeFor(wcElPath(el, "desc"));
    if (b) refs.desc.insertAdjacentElement("afterend", b);
    const note = wcExampleDescNote(el, refs, card);
    if (note) refs.desc.insertAdjacentElement("beforebegin", note);
  }, 0);
  return det;
}

// The starting example's subject text ("The main product…") is easy to miss and
// then ends up in every prompt. Flag it and offer to replace it.
const WC_EXAMPLE_DESCS = ["The main product, centered in the frame and sharply in focus."];
function wcExampleDescNote(el, refs, card) {
  if (!WC_EXAMPLE_DESCS.includes(String(el.desc || "").trim())) return null;
  const hld = String(state.high_level_description || "").trim();
  const setDesc = v => { el.desc = v; refs.desc.value = v; if (refs.title) refs.title.textContent = v; renderCanvas(); renderJSON(); note.remove(); };
  const ai = () => {
    const ui = { desc: refs.desc, title: refs.title, btn: card.querySelector(".refine-row button"), input: card.querySelector(".refine-row input"), status: card.querySelector(".refine-status") };
    if (!ui.btn || !ui.input || !ui.status) { toast("Use ✨ Refine in this element's card", "bad"); return; }
    note.remove();
    refineElement(el, `Replace this placeholder with a description of the ${el.type === "subject" ? "main subject (person or animal)" : "main object"} of the overall scene, as it appears in this box: who or what it is, appearance and pose, in one or two sentences. Do not mention the box or its position.`, ui);
  };
  const note = wcEl("div", { class: "wc-example-note" },
    wcEl("span", {}, "⚠ This is still the example text, so every prompt says “the main product”. Describe this element instead:"),
    wcEl("div", { class: "wc-row", style: { marginTop: "6px" } },
      hld ? wcEl("button", { title: "Copy the high-level description into this element", onclick: () => setDesc(hld.charAt(0).toUpperCase() + hld.slice(1).replace(/[.\s]*$/, ".")) }, "Use “" + wcShort(hld, 40) + "”") : null,
      wcEl("button", { title: "Have your AI model write it from the high-level description", onclick: ai }, "✨ Write it with AI"),
      wcEl("button", { class: "ghost", onclick: () => { setDesc(""); refs.desc.focus(); } }, "Clear it")));
  return note;
}

/* ------------------------------------------------------------------ */
/*  Header button + menu                                              */
/* ------------------------------------------------------------------ */
let wcMenuEl = null;
function wcCloseMenu() { if (wcMenuEl) wcMenuEl.style.display = "none"; }
function wcSyncMenu() {
  const n = Object.keys((state.wild && state.wild.locks) || {}).length;
  const b = document.getElementById("wcLocksItem");
  if (b) b.textContent = `🔓 Clear locked picks (${n})`;
  const s = document.getElementById("wcSeed");
  if (s && document.activeElement !== s) s.value = state.wild ? state.wild.seed : "";
}
function wcBuildMenu() {
  const num = (id, v, min, max) => { const i = wcEl("input", { type: "number", id, min, max, value: v, class: "wc-num", onkeydown: wcStop, onclick: wcStop }); return i; };
  const item = (label, title, fn, extra) => wcEl("div", { class: "wc-mi" }, wcEl("button", { class: "ghost", title, onclick: () => { wcCloseMenu(); fn(); } }, label), extra || null);
  const nPick = num("wcNPick", 4, 2, 8), nBatch = num("wcNBatch", 10, 1, 200);
  const seed = wcEl("input", { type: "number", id: "wcSeed", class: "wc-num wide", title: "Wildcard seed — the same seed and locks give the same picks", onkeydown: e => { e.stopPropagation(); if (e.key === "Enter") seed.blur(); },
    onchange: () => { const v = +seed.value; if (Number.isFinite(v)) { const next = cloneState(state); next.wild.seed = v; wcRollInto(next, {}); wcCommit(next, "Set wildcard seed"); } } });
  const auto = wcEl("input", { type: "checkbox", checked: wcAutoRoll, onchange: () => { wcAutoRoll = auto.checked; wcSave(WCS_AUTOROLL_KEY, wcAutoRoll); } });
  wcMenuEl = wcEl("div", { class: "wc-menu" },
    item("🎲 Roll all", "New picks for every wildcard field (locked picks stay)", wcRollAll),
    item("🎯 Roll selected elements", "New picks only for the selected elements", wcRollSelected),
    item("🔁 Roll ×N and pick", "Roll N times and choose one", () => wcRollBatchPick(+nPick.value), nPick),
    item("✨ Roll + polish with AI", "Roll, then have your AI model turn the picks into one coherent prompt", () => wcPolish({ roll: true })),
    item("✨ Polish current with AI", "Keep the current picks; have your AI model make them read as one coherent prompt", () => wcPolish({ roll: false })),
    item("📦 Download batch (ZIP)", "N rolled prompts in the format the JSON tile shows", () => wcBatchDownload(+nBatch.value), nBatch),
    wcEl("hr"),
    wcEl("div", { class: "wc-mi" }, wcEl("span", { class: "wc-ml" }, "Seed"), seed,
      wcEl("button", { class: "ghost", title: "New random seed and roll", onclick: () => { wcCloseMenu(); wcRollAll(); } }, "🎲")),
    wcEl("label", { class: "toggle wc-mi" }, auto, " Auto-roll before copy / download / render"),
    wcEl("label", { class: "toggle wc-mi", title: "When a roll picks a colour (e.g. __colours__ in the clothes), that element's palette becomes those colours, so an old palette can't override the words" },
      (() => { const c = wcEl("input", { type: "checkbox", checked: wcPaletteFollow, onchange: () => { wcPaletteFollow = c.checked; wcSave(WCS_PALFOLLOW_KEY, wcPaletteFollow); } }); return c; })(),
      " Palettes follow rolled colours"),
    item("🔓 Clear locked picks", "Unlock every locked pick", wcClearLocks),
    wcEl("hr"),
    item("📚 Wildcard lists & rules…", "Edit, import, export and sync wildcard lists", () => wcOpenManager()),
    item("🎭 Style templates…", "Pick, apply and edit style templates", () => wcOpenTemplates()));
  wcMenuEl.querySelectorAll("button").forEach(b => { if (b.textContent.startsWith("🔓 Clear")) b.id = "wcLocksItem"; });
  wcMenuEl.style.display = "none";
  document.body.append(wcMenuEl);
  document.addEventListener("mousedown", e => { if (wcMenuEl.style.display !== "none" && !wcMenuEl.contains(e.target) && !e.target.closest("#wcMenuBtn")) wcCloseMenu(); });
}
function wcToggleMenu(anchor) {
  if (!wcMenuEl) wcBuildMenu();
  if (wcMenuEl.style.display !== "none") { wcCloseMenu(); return; }
  wcSyncMenu();
  wcMenuEl.style.display = "block";
  const r = anchor.getBoundingClientRect(), w = wcMenuEl.offsetWidth;
  wcMenuEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + "px";
  wcMenuEl.style.top = (r.bottom + 6) + "px";
}
function wcInstallHeader() {
  const after = document.getElementById("refineBtn");
  if (!after || document.getElementById("wcRollBtn")) return;
  const roll = wcEl("button", { class: "has-label", id: "wcRollBtn", title: "Roll wildcards: new picks for every 🎲 field (locked picks stay)", "aria-label": "Roll wildcards", onclick: wcRollAll }, wcEl("span", { class: "bico" }, "🎲"), wcEl("span", {}, "Roll"));
  const menu = wcEl("button", { id: "wcMenuBtn", title: "Wildcard options: roll selected, roll ×N, AI polish, batch, seed, lists", "aria-label": "Wildcard menu", onclick: e => wcToggleMenu(e.currentTarget) }, "▾");
  const tpl = wcEl("button", { class: "has-label", id: "wcTplBtn", title: "Style templates (magazine, sports game, cinematic…)", "aria-label": "Style templates", onclick: () => wcOpenTemplates() }, wcEl("span", { class: "bico" }, "🎭"), wcEl("span", {}, "Templates"));
  const lists = wcEl("button", { class: "has-label", id: "wcListsBtn", title: "Wildcard lists & rules: edit, add lists and categories, import, sync", "aria-label": "Wildcard lists", onclick: () => wcOpenManager("lists") }, wcEl("span", { class: "bico" }, "📚"), wcEl("span", {}, "Lists"));
  const help = wcEl("button", { id: "wcHelpBtn", title: "Help: step-by-step guide, templates, wildcards and rolling", "aria-label": "Help", onclick: () => wcOpenHelp() }, "?");
  after.insertAdjacentElement("afterend", help);
  after.insertAdjacentElement("afterend", lists);
  after.insertAdjacentElement("afterend", tpl);
  after.insertAdjacentElement("afterend", menu);
  after.insertAdjacentElement("afterend", roll);
}

/* ------------------------------------------------------------------ */
/*  Style templates modal                                             */
/* ------------------------------------------------------------------ */
let wcTplCat = "All";
function wcOpenTemplates() {
  const m = wcModal("wcTplOverlay", "🎭 Style templates", "980px");
  if (!m.built) {
    m.built = true;
    m.search = wcEl("input", { type: "text", placeholder: "Search templates…", onkeydown: wcStop, oninput: () => wcRenderTemplates() });
    m.cats = wcEl("div", { class: "chip-group" });
    m.grid = wcEl("div", { class: "var-grid" });
    m.body.append(wcEl("div", { class: "hint", style: { marginTop: 0, marginBottom: "10px" } },
      "A template fills the image style (aesthetics, lighting, camera, medium, background) and the per-element style of people — any value can use wildcards, so every roll gives a new variation. ",
      "“Apply to image” also styles subject elements; “Apply to selected” styles just the selected elements."),
      m.search, m.cats, wcEl("div", { style: { height: "10px" } }), m.grid);
    m.foot.append(
      wcEl("button", { title: "How templates, lists and rolling work", onclick: () => wcOpenHelp("templates") }, "📖 Help"),
      wcEl("button", { onclick: () => wcOpenManager("lists") }, "📚 Wildcard lists"),
      wcEl("button", { title: "Build a template step by step from the wildcard lists", onclick: () => wcOpenWizard() }, "🧭 Template wizard"),
      wcEl("button", { onclick: () => wcOpenTemplateEditor(null) }, "＋ New template"),
      wcEl("button", { class: "primary", onclick: () => wcCloseModal("wcTplOverlay") }, "Close"));
  }
  wcRenderTemplates();
  wcOpenModal("wcTplOverlay");
  setTimeout(() => m.search.focus(), 30);
}
// Template categories: the ones templates use plus empty ones made by hand.
function wcTemplateCategories() {
  return Array.from(new Set([...wcLoad(WCS_TPLCATS_KEY, []), ...wcAllTemplates().map(t => t.category || "").filter(Boolean)])).sort((a, b) => a.localeCompare(b));
}
function wcAskTplCategory() {
  const c = (prompt("Name of the new template category:", "") || "").trim();
  if (!c) return null;
  wcSave(WCS_TPLCATS_KEY, Array.from(new Set([...wcLoad(WCS_TPLCATS_KEY, []), c])));
  return c;
}
// Category picker for a template: existing categories, none, or a new one.
function wcTplCatSelect(value, onPick) {
  const sel = wcEl("select", { class: "wc-tplcat", onkeydown: wcStop, title: "Category" });
  const fill = v => {
    const all = Array.from(new Set([...wcTemplateCategories(), ...(v ? [v] : [])])).sort((a, b) => a.localeCompare(b));
    sel.replaceChildren(wcEl("option", { value: "" }, "(no category)"), ...all.map(c => wcEl("option", { value: c }, c)), wcEl("option", { value: "@new" }, "＋ New category…"));
    sel.value = v || "";
  };
  fill(value);
  let prev = sel.value;
  sel.addEventListener("change", () => {
    if (sel.value === "@new") { const c = wcAskTplCategory(); fill(c === null ? prev : c); }
    prev = sel.value;
    if (onPick) onPick(sel.value);
  });
  return sel;
}
function wcSetTemplateCategory(t, cat) {
  const c = JSON.parse(JSON.stringify(t));
  delete c.builtin; delete c.modified;
  c.category = cat;
  wcSaveTemplate(c);
}
function wcRenderTemplates() {
  const m = document.getElementById("wcTplOverlay")._wc;
  const all = wcAllTemplates();
  const used = new Set(all.map(t => t.category || ""));
  const cats = ["All", ...wcTemplateCategories(), ...(used.has("") ? [""] : [])];
  if (!cats.includes(wcTplCat)) wcTplCat = "All";
  const own = new Set(wcLoad(WCS_TPLCATS_KEY, []));
  m.cats.replaceChildren(...cats.map(c => wcEl("button", { class: "chip" + (c === wcTplCat ? " on" : ""), onclick: () => { wcTplCat = c; wcRenderTemplates(); } },
      c === "" ? "No category" : c,
      c && c !== "All" && own.has(c) && !used.has(c) ? wcEl("span", { class: "wc-chip-x", title: "Remove this empty category", onclick: e => { e.stopPropagation(); wcSave(WCS_TPLCATS_KEY, wcLoad(WCS_TPLCATS_KEY, []).filter(x => x !== c)); if (wcTplCat === c) wcTplCat = "All"; wcRenderTemplates(); } }, " ✕") : null)),
    wcEl("button", { class: "chip", title: "Make a new template category", onclick: () => { const c = wcAskTplCategory(); if (c) { wcTplCat = c; wcRenderTemplates(); } } }, "＋ Category"));
  const q = m.search.value.trim().toLowerCase();
  const list = all.filter(t => (wcTplCat === "All" || (t.category || "") === wcTplCat) && (!q || JSON.stringify(t).toLowerCase().includes(q)));
  const hasSel = wcSelectedKeys().size > 0;
  const active = state.wild && state.wild.templateId;
  m.grid.replaceChildren(...list.map(t => wcEl("div", { class: "var-card" + (t.id === active ? " wc-active" : "") },
    wcTemplateThumb(t),
    wcEl("div", { class: "var-head" }, t.name, t.id === active ? wcEl("span", { class: "wc-tag" }, "in use") : null, t.modified ? wcEl("span", { class: "wc-tag" }, t.builtin ? "edited" : "yours") : null),
    wcEl("div", { class: "var-meta wc-row", style: { margin: "2px 0" } }, wcTplCatSelect(t.category || "", c => { wcSetTemplateCategory(t, c); wcRenderTemplates(); }),
      wcEl("span", {}, ({ global: "image only", element: "elements only", both: "image + elements" }[t.scope || "both"]))),
    wcEl("div", { class: "var-desc" }, wcShort((t.global && (t.global.aesthetics || t.global.lighting)) || Object.values(t.element || {})[0] || "", 150)),
    wcListChips(t),
    wcEl("div", { class: "wc-row" },
      t.scope !== "element" ? wcEl("button", { class: "primary", onclick: () => wcApplyTemplateReview(t, "image") }, "Apply to image") : null,
      t.scope !== "global" ? wcEl("button", { disabled: !hasSel, title: hasSel ? "" : "Select elements on the canvas first", onclick: () => wcApplyTemplateReview(t, "selected") }, "Apply to selected") : null),
    wcEl("div", { class: "wc-row" },
      wcEl("button", { class: "ghost", onclick: () => wcSampleTemplate(t) }, "Sample"),
      wcEl("button", { class: "ghost", onclick: () => wcOpenTemplateEditor(t) }, "Edit"),
      wcEl("button", { class: "ghost", title: "Set a preview image for this template", onclick: e => wcPreviewMenu(t, e.currentTarget) }, "🖼"),
      wcEl("button", { class: "ghost", onclick: () => { const c = JSON.parse(JSON.stringify(t)); c.id = wcNewId(t.name + "-copy"); c.name = t.name + " (copy)"; wcSaveTemplate(c); wcRenderTemplates(); } }, "Duplicate"),
      t.builtin ? (t.modified ? wcEl("button", { class: "ghost", onclick: () => { if (confirm(`Reset “${t.name}” to the built-in version?`)) { wcRestoreTemplate(t.id); wcRenderTemplates(); } } }, "Reset") : null)
        : wcEl("button", { class: "ghost", onclick: () => { if (confirm(`Delete the template “${t.name}”?`)) { wcDeleteTemplate(t.id); wcRenderTemplates(); } } }, "Delete"))
  )));
  if (!list.length) m.grid.append(wcEl("div", { class: "hint" }, wcTplCat !== "All" && !q ? "No templates in this category yet. Pick it in a template's category menu (on its card, or in Edit) to add one." : "No templates match."));
}
function wcNewId(name) { return String(name || "template").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + Math.random().toString(36).slice(2, 6); }
function wcSampleTemplate(t, outEl) {
  const T = wcTemplateFor(t, aiTarget()), G = T.global || {}, E = T.element || {};
  const lines = [];
  for (let i = 0; i < 3; i++) {
    const fields = [];
    for (const k of [...WC_TPL_GLOBAL_KEYS, "background", "hld_suffix"]) if (G[k]) fields.push({ path: k, text: G[k] });
    for (const k of [...ELEMENT_STYLE_KEYS, "desc_prefix", "desc_suffix"]) if (E[k]) fields.push({ path: "element " + k, text: E[k] });
    const r = WC.resolveFields(fields, { lists: wcEngineLists(), rules: [...wcGlobalRules(), ...(t.rules || [])], varDefs: t.vars || {}, seed: WC.newSeed() });
    lines.push(`— Sample ${i + 1} —\n` + fields.map(f => `${f.path}: ${r.values[f.path]}`).join("\n") + (r.errors.length ? "\n⚠ " + r.errors.join("; ") : ""));
  }
  const text = lines.join("\n\n");
  if (outEl) { outEl.textContent = text; outEl.style.display = "block"; return; }
  const m = wcModal("wcSampleOverlay", "Sample rolls", "680px");
  if (!m.built) { m.built = true; m.pre = wcEl("pre", { class: "wc-pre" }); m.body.append(m.pre); m.foot.append(wcEl("button", { class: "primary", onclick: () => wcCloseModal("wcSampleOverlay") }, "Close")); }
  m.h2.textContent = "Sample rolls · " + t.name;
  m.pre.textContent = text;
  wcOpenModal("wcSampleOverlay");
}

/* ------------------------------------------------------------------ */
/*  Template editor                                                   */
/* ------------------------------------------------------------------ */
function wcOpenTemplateEditor(t) {
  const isNew = !t;
  t = t ? JSON.parse(JSON.stringify(t)) : { id: "", name: "", category: (typeof wcTplCat === "string" && wcTplCat !== "All") ? wcTplCat : "", scope: "both", appliesTo: ["subject"], global: {}, element: {}, vars: {}, rules: [], llmNotes: "" };
  const m = wcModal("wcTplEditOverlay", "", "860px");
  m.draft = true;
  m.h2.textContent = isNew ? "＋ New style template" : "Edit template · " + t.name;
  const ta = (v, rows = 2, ph = "") => { const x = wcEl("textarea", { rows, placeholder: ph, onkeydown: wcStop, spellcheck: false }); x.value = v || ""; return x; };
  const inp = (v, ph = "") => { const x = wcEl("input", { type: "text", placeholder: ph, onkeydown: wcStop }); x.value = v || ""; return x; };
  const name = inp(t.name, "e.g. Retro tennis poster"), cat = wcTplCatSelect(t.category || "");
  const scope = wcEl("select", {}, wcEl("option", { value: "both" }, "Image + elements"), wcEl("option", { value: "global" }, "Image only"), wcEl("option", { value: "element" }, "Elements only"));
  scope.value = t.scope || "both";
  const types = ["subject", "obj", "text", "logo", "bg"];
  const applies = types.map(ty => { const c = wcEl("input", { type: "checkbox", checked: (t.appliesTo || ["subject"]).includes(ty) }); c.dataset.t = ty; return c; });
  const G = t.global || {}, E = t.element || {};
  const gInputs = {}, eInputs = {};
  const gDefs = [["aesthetics", "Aesthetics"], ["lighting", "Lighting"], ["photo", "Camera / lens"], ["medium", "Medium"], ["art_style", "Art style (non-photo)"], ["background", "Background"], ["hld_suffix", "Add to the high-level description"]];
  for (const [k] of gDefs) gInputs[k] = ta(G[k]);
  const pal = inp(Array.isArray(G.color_palette) ? G.color_palette.join(", ") : "", "#RRGGBB, #RRGGBB … (optional)");
  for (const [k] of ELEMENT_STYLE_FIELDS) eInputs[k] = ta(E[k], 1, WC_STYLE_HINTS[k]);
  eInputs.desc_prefix = ta(E.desc_prefix, 1, "text put before the description");
  eInputs.desc_suffix = ta(E.desc_suffix, 1, "text put after the description");
  const vars = ta(Object.entries(t.vars || {}).map(([k, v]) => `${k} = ${v}`).join("\n"), 3, "one per line: sport = __sports__");
  const notes = ta(t.llmNotes, 2, "extra direction for AI polish and Generate");
  const fmts = ta(t.formats ? JSON.stringify(t.formats, null, 2) : "", 3, '{"moss": {"global": {"aesthetics": "…"}}}');
  const rulesBox = wcEl("div");
  let rules = JSON.parse(JSON.stringify(t.rules || []));
  wcRulesEditor(rulesBox, rules, r => { rules = r; });
  const sampleOut = wcEl("pre", { class: "wc-pre", style: { display: "none" } });
  const insert = wcEl("select", { class: "ai-target-sel wc-insert" }); insert.dataset.ph = "+ insert wildcard"; wcListOptions(insert, "+ insert wildcard");
  let lastTa = gInputs.aesthetics;
  insert.addEventListener("change", () => { if (insert.value) wcInsertAtCursor(lastTa, "__" + insert.value + "__"); insert.value = ""; });
  const row = (label, el) => wcEl("div", { class: "wc-field" }, wcEl("label", {}, label), el);
  m.body.replaceChildren(
    wcEl("div", { class: "wc-2col" }, row("Name", name), row("Category", cat)),
    wcEl("div", { class: "wc-2col" }, row("Applies to", scope), row("Element types styled by “Apply to image”", wcEl("div", { class: "wc-row" }, applies.map(c => wcEl("label", { class: "toggle" }, c, " " + c.dataset.t))))),
    wcEl("div", { class: "wc-row", style: { margin: "10px 0 4px" } }, wcEl("b", {}, "Image"), insert, wcEl("span", { class: "hint", style: { margin: 0 } }, "Wildcards work everywhere: __list__, {a|b}, {2$$a|b|c}, ${var}")),
    wcEl("div", { class: "wc-2col" }, gDefs.map(([k, l]) => row(l, gInputs[k])), row("Colour palette", pal)),
    wcEl("div", { style: { margin: "12px 0 4px" } }, wcEl("b", {}, "Per element")),
    wcEl("div", { class: "wc-2col" }, ELEMENT_STYLE_FIELDS.map(([k, l]) => row(l, eInputs[k])), row("Description prefix", eInputs.desc_prefix), row("Description suffix", eInputs.desc_suffix)),
    wcEl("details", { class: "gen-options", open: !!(Object.keys(t.vars || {}).length || (t.rules || []).length) || undefined },
      wcEl("summary", {}, "Variables, rules, AI notes, per-format overrides"),
      row("Variables (set once per roll, use as ${name} — also usable in guards like [sport=tennis])", vars),
      wcEl("label", {}, "Rules (only while this template is in use)"), rulesBox,
      row("Notes for AI polish / Generate", notes),
      row("Per-format overrides (JSON, optional): {\"moss\": {\"global\": {…}, \"element\": {…}}, \"ideogram\": {…}}", fmts)),
    sampleOut);
  m.body.querySelectorAll("textarea").forEach(x => x.addEventListener("focus", () => { lastTa = x; }));
  const collect = () => {
    const out = { ...t, name: name.value.trim() || "Untitled", category: cat.value === "@new" ? "" : cat.value, scope: scope.value,
      appliesTo: applies.filter(c => c.checked).map(c => c.dataset.t), global: {}, element: {}, vars: {}, rules, llmNotes: notes.value.trim() };
    for (const [k] of gDefs) if (gInputs[k].value.trim()) out.global[k] = gInputs[k].value.trim();
    if (G.photo === "" && !gInputs.photo.value.trim()) out.global.photo = "";   // keep "no camera" for art templates
    const pc = pal.value.split(/[\s,]+/).map(s => s.trim()).filter(s => /^#?[0-9a-f]{6}$/i.test(s)).map(s => (s[0] === "#" ? s : "#" + s).toUpperCase());
    if (pc.length) out.global.color_palette = pc;
    for (const k of Object.keys(eInputs)) if (eInputs[k].value.trim()) out.element[k] = eInputs[k].value.trim();
    for (const line of vars.value.split(/\n/)) { const mm = /^\s*([A-Za-z_][\w.\-]*)\s*=\s*(.*)$/.exec(line); if (mm) out.vars[mm[1]] = mm[2].trim(); }
    if (fmts.value.trim()) { try { out.formats = JSON.parse(fmts.value); } catch (err) { throw new Error("Per-format overrides aren't valid JSON: " + err.message); } }
    else delete out.formats;
    if (!out.id) out.id = wcNewId(out.name);
    return out;
  };
  m.foot.replaceChildren(m.status,
    wcEl("button", { onclick: () => { try { wcSampleTemplate(collect(), sampleOut); m.setStatus(""); } catch (err) { m.setStatus(err.message, "err"); } } }, "🎲 Sample"),
    typeof wcSplitButton === "function" ? wcSplitButton("lists") : null,
    wcEl("button", { onclick: () => { m.draft = false; wcCloseModal("wcTplEditOverlay"); } }, "Cancel"),
    wcEl("button", { class: "primary", onclick: () => {
      try { const out = collect(); wcSaveTemplate(out); m.draft = false; wcCloseModal("wcTplEditOverlay"); if (document.getElementById("wcTplOverlay")) wcRenderTemplates(); toast("Template saved ✓", "ok"); render(); }
      catch (err) { m.setStatus(err.message, "err"); }
    } }, "Save template"));
  m.setStatus("");
  wcOpenModal("wcTplEditOverlay");
}

/* ------------------------------------------------------------------ */
/*  Rules editor (global rules and template rules)                    */
/* ------------------------------------------------------------------ */
function wcRulesEditor(box, rules, onChange) {
  const draw = () => {
    box.replaceChildren();
    const table = wcEl("div", { class: "wc-rules" });
    rules.forEach((r, i) => {
      r.when = r.when || {}; r.then = r.then || {};
      const whenKind = wcEl("select", {}, wcEl("option", { value: "list" }, "a pick from list"), wcEl("option", { value: "var" }, "variable"), wcEl("option", { value: "always" }, "always"));
      whenKind.value = r.when.var ? "var" : r.when.list ? "list" : "always";
      const whenKey = wcEl("input", { type: "text", placeholder: "time-of-day", onkeydown: wcStop }); whenKey.value = r.when.var || r.when.list || "";
      const whenOp = wcEl("select", {}, wcEl("option", { value: "is" }, "is"), wcEl("option", { value: "isNot" }, "is not"));
      whenOp.value = r.when.isNot ? "isNot" : "is";
      const whenVals = wcEl("input", { type: "text", placeholder: "night, dusk (comma-separated, * = any)", onkeydown: wcStop });
      whenVals.value = [].concat(r.when.is || r.when.isNot || []).join(", ");
      const thenList = wcEl("input", { type: "text", placeholder: "lighting/natural", onkeydown: wcStop }); thenList.value = r.then.list || "";
      const thenOp = wcEl("select", {}, wcEl("option", { value: "exclude" }, "never pick"), wcEl("option", { value: "only" }, "only pick"), wcEl("option", { value: "force" }, "always pick"));
      thenOp.value = r.then.force ? "force" : r.then.only ? "only" : "exclude";
      const thenVals = wcEl("input", { type: "text", placeholder: "golden hour sunlight, *sun* …", onkeydown: wcStop });
      thenVals.value = [].concat(r.then.force || r.then.only || r.then.exclude || []).join(", ");
      const on = wcEl("input", { type: "checkbox", checked: r.enabled !== false, title: "Rule on/off" });
      const nm = wcEl("input", { type: "text", placeholder: "rule name", onkeydown: wcStop }); nm.value = r.name || "";
      const split = s => s.split(",").map(x => x.trim()).filter(Boolean);
      const save = () => {
        const w = {};
        if (whenKind.value !== "always" && whenKey.value.trim()) { w[whenKind.value] = whenKey.value.trim(); if (split(whenVals.value).length) w[whenOp.value] = split(whenVals.value); }
        const th = { list: thenList.value.trim() };
        if (thenOp.value === "force") th.force = split(thenVals.value)[0] || ""; else th[thenOp.value] = split(thenVals.value);
        rules[i] = { name: nm.value.trim(), enabled: on.checked, when: w, then: th };
        onChange(rules);
      };
      [whenKind, whenKey, whenOp, whenVals, thenList, thenOp, thenVals, on, nm].forEach(x => x.addEventListener("change", save));
      whenKind.addEventListener("change", () => { whenKey.disabled = whenOp.disabled = whenVals.disabled = whenKind.value === "always"; });
      whenKey.disabled = whenOp.disabled = whenVals.disabled = whenKind.value === "always";
      table.append(wcEl("div", { class: "wc-rule" },
        wcEl("div", { class: "wc-row" }, on, nm, wcEl("button", { class: "iconbtn del", title: "Delete rule", onclick: () => { rules.splice(i, 1); onChange(rules); draw(); } }, "✕")),
        wcEl("div", { class: "wc-row" }, wcEl("span", { class: "wc-ml" }, "When"), whenKind, whenKey, whenOp, whenVals),
        wcEl("div", { class: "wc-row" }, wcEl("span", { class: "wc-ml" }, "then from"), thenList, thenOp, thenVals)));
    });
    box.append(table, wcEl("button", { class: "ghost", onclick: () => { rules.push({ name: "", when: { list: "", is: [] }, then: { list: "", exclude: [] } }); onChange(rules); draw(); } }, "＋ Add rule"));
  };
  draw();
}

/* ------------------------------------------------------------------ */
/*  Wildcard manager                                                  */
/* ------------------------------------------------------------------ */
let wcMgrSel = null, wcMgrTab = "lists";
function wcOpenManager(tab) {
  const m = wcModal("wcMgrOverlay", "📚 Wildcard lists & rules", "1060px");
  if (!m.built) {
    m.built = true;
    m.tabs = wcEl("div", { class: "seg" });
    m.content = wcEl("div");
    m.file = wcEl("input", { type: "file", multiple: true, accept: ".txt,.yaml,.yml,.json,.zip", style: { display: "none" }, onchange: () => { wcImportFiles(Array.from(m.file.files)); m.file.value = ""; } });
    m.body.append(m.tabs, wcEl("div", { style: { height: "12px" } }), m.content, m.file);
    m.foot.append(
      wcEl("button", { title: "Import .txt lists, .yaml/.json packs or a .zip of a wildcards folder (Dynamic Prompts layout)", onclick: () => m.file.click() }, "⬆ Import"),
      wcEl("button", { title: "Everything (lists, rules, templates) as one JSON file", onclick: wcExportJSON }, "⬇ Export JSON"),
      wcEl("button", { title: "A wildcards folder as a ZIP: one .txt per list, plus _templates/", onclick: wcExportZip }, "⬇ Export ZIP"),
      wcEl("button", { title: "Sync with the wildcards/ folder next to comfy_proxy.py", onclick: () => wcSyncFolder({ interactive: true }) }, "⇅ Sync with folder"),
      wcEl("button", { title: "How lists, syntax and rules work", onclick: () => wcOpenHelp("lists") }, "📖 Help"),
      typeof wcSplitButton === "function" ? wcSplitButton("template") : null,
      wcEl("button", { class: "primary", onclick: () => wcCloseModal("wcMgrOverlay") }, "Close"));
  }
  if (tab) wcMgrTab = tab;
  wcRenderManager();
  wcOpenModal("wcMgrOverlay");
}
function wcMgrStatus(msg, cls) { const o = document.getElementById("wcMgrOverlay"); if (o) o._wc.setStatus(msg, cls); }
function wcRenderManager() {
  const m = document.getElementById("wcMgrOverlay")._wc;
  m.tabs.replaceChildren(...[["lists", "Lists"], ["rules", "Rules"], ["syntax", "Syntax"]].map(([k, l]) =>
    wcEl("button", { class: k === wcMgrTab ? "active" : "", onclick: () => { wcMgrTab = k; wcRenderManager(); } }, l)));
  if (wcMgrTab === "rules") return wcRenderRulesTab(m.content);
  if (wcMgrTab === "syntax") return m.content.replaceChildren(wcSyntaxHelp());
  // Lists tab
  const lists = wcAllLists();
  const search = wcEl("input", { type: "text", placeholder: "Filter lists…", onkeydown: wcStop });
  search.value = m._q || "";
  const tree = wcEl("div", { class: "wc-tree" });
  const groupOf = n => n.includes("/") ? n.slice(0, n.lastIndexOf("/")) : "";
  const cats = wcListCategories(lists, [...wcLoad(WCS_LISTCATS_KEY, []), ...(m._extraCats || [])]);
  m._collapsed = m._collapsed || new Set(wcLoad(WCS_LISTCOLLAPSE_KEY, []));
  const saveCollapsed = () => wcSave(WCS_LISTCOLLAPSE_KEY, Array.from(m._collapsed));
  const drawTree = () => {
    m._q = search.value;
    const q = search.value.trim().toLowerCase();
    const names = Object.keys(lists).filter(n => !q || n.includes(q) || lists[n].text.toLowerCase().includes(q)).sort();
    // Build the folder tree: categories, subcategories, lists.
    const root = { lists: [], kids: new Map() };
    const node = path => { let nd = root; if (!path) return nd; for (const seg of path.split("/")) { if (!nd.kids.has(seg)) nd.kids.set(seg, { lists: [], kids: new Map() }); nd = nd.kids.get(seg); } return nd; };
    if (!q) for (const c of cats) node(c);   // empty categories show too
    for (const n of names) node(groupOf(n)).lists.push(n);
    const countIn = nd => nd.lists.length + Array.from(nd.kids.values()).reduce((a, k) => a + countIn(k), 0);
    const pad = depth => ({ paddingLeft: (8 + depth * 14) + "px" });
    tree.replaceChildren();
    const item = (n, depth) => {
      const g = groupOf(n), count = WC.parseList(lists[n].text).length;
      tree.append(wcEl("button", { class: "wc-tree-i" + (n === wcMgrSel ? " on" : ""), style: pad(depth), onclick: () => { delete m._new; wcMgrSel = n; wcRenderManager(); } },
        wcEl("span", {}, g ? n.slice(g.length + 1) : n), wcEl("em", {}, String(count) + (lists[n].modified ? (lists[n].builtin ? " ✎" : " ★") : ""))));
    };
    const head = (path, label, depth, nd) => {
      const key = path || "@root", open = !!q || !m._collapsed.has(key);
      const toggle = () => { if (m._collapsed.has(key)) m._collapsed.delete(key); else m._collapsed.add(key); saveCollapsed(); drawTree(); };
      tree.append(wcEl("div", { class: "wc-tree-g", style: { paddingLeft: (4 + depth * 14) + "px" } },
        wcEl("span", { class: "wc-tree-lbl", title: open ? "Collapse" : "Expand", onclick: toggle }, (open ? "▾ " : "▸ ") + label, wcEl("em", {}, " " + countIn(nd))),
        wcEl("span", {},
          path ? wcEl("button", { class: "wc-tree-add", title: `New subcategory inside ${path}/`, onclick: () => { const c = wcAskCategory(m, path); if (c !== null) { m._collapsed.delete(path); saveCollapsed(); wcMgrNew(c); } } }, "⊞") : null,
          wcEl("button", { class: "wc-tree-add", title: path ? `New list in ${path}/` : "New list without a category", onclick: () => wcMgrNew(path) }, "＋"))));
      return open;
    };
    if (root.lists.length && head("", "No category", 0, root)) root.lists.forEach(n => item(n, 1));
    const walk = (nd, path, depth) => {
      for (const seg of Array.from(nd.kids.keys()).sort()) {
        const k = nd.kids.get(seg), pth = path ? path + "/" + seg : seg;
        if (q && !countIn(k)) continue;
        if (head(pth, seg + "/", depth, k)) { k.lists.forEach(n => item(n, depth + 1)); walk(k, pth, depth + 1); }
      }
    };
    walk(root, "", 0);
    if (!names.length) tree.append(wcEl("div", { class: "hint" }, q ? "No lists match." : "No lists yet."));
  };
  search.addEventListener("input", drawTree);
  drawTree();
  if (wcMgrSel && !lists[wcMgrSel]) wcMgrSel = null;
  const editor = wcEl("div", { class: "wc-editor" });
  if (!wcMgrSel && m._new !== undefined) {
    // New list form: pick (or make) a category, name it.
    const catSel = wcCatSelect(cats, m._new, m);
    const nameIn = wcEl("input", { type: "text", placeholder: "e.g. hairstyles", onkeydown: e => { wcStop(e); if (e.key === "Enter") create(); } });
    const create = () => {
      const leaf = WC.normName(nameIn.value).replace(/\//g, "-");
      if (!leaf) { wcMgrStatus("Give the list a name.", "err"); nameIn.focus(); return; }
      const full = (catSel.value ? catSel.value + "/" : "") + leaf;
      if (lists[full]) { wcMgrStatus(`“${full}” already exists — opened it.`, ""); }
      else wcSetList(full, "");
      delete m._new; wcMgrSel = full; wcRenderManager();
      if (!lists[full]) wcMgrStatus(`Created __${full}__ — add one item per line, then Save.`, "ok");
    };
    editor.append(wcEl("h3", { style: { margin: "0 0 10px" } }, "New list"),
      wcEl("div", { class: "wc-row" }, wcEl("span", { class: "wc-ml" }, "Category"), catSel),
      wcEl("div", { class: "wc-row" }, wcEl("span", { class: "wc-ml" }, "Name"), nameIn),
      wcEl("div", { class: "hint" }, "A category is a folder of lists, used as ", wcEl("code", {}, "__category/name__"), ". It appears once it has a list in it."),
      wcEl("div", { class: "wc-row" }, wcEl("button", { class: "primary", onclick: create }, "Create list"), wcEl("button", { class: "ghost", onclick: () => { delete m._new; wcRenderManager(); } }, "Cancel")));
    setTimeout(() => nameIn.focus(), 30);
  } else if (!wcMgrSel) {
    editor.append(wcEl("div", { class: "hint", style: { marginTop: 0 } },
      "Pick a list to edit, or make a new one. A list is one item per line; ", wcEl("code", {}, "2::item"), " doubles its chance; ", wcEl("code", {}, "# comment"), " lines are skipped; items can contain wildcards themselves. ",
      "Use a list anywhere as ", wcEl("code", {}, "__name__"), " (folders: ", wcEl("code", {}, "__clothes/hats__"), ", or just ", wcEl("code", {}, "__hats__"), ")."));
  } else {
    const L = lists[wcMgrSel];
    const selGroup = groupOf(wcMgrSel);
    const catSel = wcCatSelect(cats, selGroup, m);
    const nameIn = wcEl("input", { type: "text", onkeydown: wcStop }); nameIn.value = selGroup ? wcMgrSel.slice(selGroup.length + 1) : wcMgrSel;
    const ta = wcEl("textarea", { rows: 18, spellcheck: false, onkeydown: wcStop, class: "wc-mono" }); ta.value = L.text;
    const uniq = wcEl("input", { type: "checkbox", checked: !!(L.opts && L.opts.unique) });
    const out = wcEl("pre", { class: "wc-pre", style: { display: "none" } });
    editor.append(
      wcEl("div", { class: "wc-row" }, wcEl("span", { class: "wc-ml" }, "Category"), catSel),
      wcEl("div", { class: "wc-row" }, wcEl("span", { class: "wc-ml" }, "Name"), nameIn, wcEl("code", { class: "wc-token", title: "Click to copy", onclick: () => copyText("__" + wcMgrSel + "__").then(() => toast("Copied __" + wcMgrSel + "__", "ok")) }, "__" + wcMgrSel + "__")),
      ta,
      wcUsedBy(wcMgrSel),
      wcEl("div", { class: "wc-row" },
        wcEl("label", { class: "toggle" }, uniq, " Unique — never repeat an item within one roll"),
        (L.pack || (L.opts && L.opts.from)) ? wcEl("span", { class: "hint", style: { margin: 0 } }, L.pack ? "read from " + L.pack + " in the folder (sync never writes it back)" : "imported from " + L.opts.from) : null),
      wcEl("div", { class: "wc-row" },
        wcEl("button", { class: "primary", onclick: () => {
          const leaf = WC.normName(nameIn.value).replace(/\//g, "-");
          const newName = leaf ? (catSel.value ? catSel.value + "/" : "") + leaf : "";
          if (!newName) { wcMgrStatus("Give the list a name.", "err"); return; }
          if (newName !== wcMgrSel && lists[newName] && !confirm(`A list called “${newName}” exists. Replace it?`)) return;
          if (newName !== wcMgrSel) wcDeleteList(wcMgrSel);
          wcSetList(newName, ta.value, { ...(L.opts || {}), unique: uniq.checked });
          wcMgrSel = newName; wcRenderManager(); wcMgrStatus("Saved ✓", "ok");
        } }, "Save"),
        wcEl("button", { onclick: () => {
          const items = WC.parseList(ta.value);
          const r = Array.from({ length: 10 }, () => WC.resolve("__" + wcMgrSel + "__", { lists: { ...wcEngineListsRaw(), [wcMgrSel]: { text: ta.value, opts: { unique: uniq.checked } } }, rules: wcGlobalRules(), seed: WC.newSeed() }));
          // Under each sample, which list gave which word — shows where every pick came from.
          const picks = x => (x.trace || []).filter(t => t.list && t.list !== wcMgrSel).map(t => `${t.list}: ${t.value}`);
          out.textContent = `${items.length} items · 10 samples (↳ = what each list picked):\n` + r.map(x => "• " + x.text + (x.errors.length ? "   ⚠ " + x.errors.join("; ") : "") + (picks(x).length ? "\n    ↳ " + picks(x).join(" · ") : "")).join("\n");
          out.style.display = "block";
        } }, "🎲 Sample 10"),
        L.builtin ? (L.modified ? wcEl("button", { class: "ghost", onclick: () => { if (confirm("Restore the built-in version of this list?")) { wcRestoreList(wcMgrSel); wcRenderManager(); } } }, "Restore built-in") : null) : null,
        wcEl("button", { class: "ghost", onclick: () => { if (confirm(`Delete the list “${wcMgrSel}”?`)) { wcDeleteList(wcMgrSel); wcMgrSel = null; wcRenderManager(); } } }, "Delete")),
      out);
  }
  m.content.replaceChildren(wcEl("div", { class: "wc-mgr" },
    wcEl("div", { class: "wc-side" }, wcEl("div", { class: "wc-row" }, search),
      wcEl("div", { class: "wc-row" },
        wcEl("button", { title: "New list (in the selected list's category)", onclick: () => wcMgrNew(wcMgrSel ? groupOf(wcMgrSel) : "") }, "＋ List"),
        wcEl("button", { title: "New category (a folder of lists)", onclick: () => { const c = wcAskCategory(m); if (c !== null) wcMgrNew(c); } }, "＋ Category")),
      tree),
    editor));
}
// Every category (folder) that has a list, including parents of nested ones.
function wcListCategories(lists, extra) {
  const out = new Set(extra || []);
  for (const n of Object.keys(lists)) {
    const parts = n.split("/");
    for (let i = 1; i < parts.length; i++) out.add(parts.slice(0, i).join("/"));
  }
  return Array.from(out).sort();
}
function wcAskCategory(m, parent) {
  const raw = prompt(parent ? `Name of the new subcategory inside ${parent}/ :` : "Name of the new category (a folder of lists, e.g. hair). Use / for a subcategory, e.g. clothes/sport:", "");
  if (raw === null) return null;
  const leaf = WC.normName(raw).replace(/\s+/g, "-");
  if (!leaf) return null;
  const c = parent ? parent + "/" + leaf : leaf;
  m._extraCats = Array.from(new Set([...(m._extraCats || []), c]));
  wcSave(WCS_LISTCATS_KEY, Array.from(new Set([...wcLoad(WCS_LISTCATS_KEY, []), c])));
  return c;
}
function wcCatSelect(cats, value, m) {
  const sel = wcEl("select", { onkeydown: wcStop });
  const fill = v => {
    const all = Array.from(new Set([...cats, ...(m._extraCats || []), ...(v ? [v] : [])])).sort();
    sel.replaceChildren(wcEl("option", { value: "" }, "(no category)"), ...all.map(c => wcEl("option", { value: c }, "\u00a0\u00a0".repeat(c.split("/").length - 1) + c.split("/").pop() + "/")),
      wcEl("option", { value: "@new" }, "＋ New category…"), ...(v ? [wcEl("option", { value: "@sub" }, `＋ New subcategory in ${v}/…`)] : []));
    sel.value = v || "";
  };
  fill(value);
  let prev = sel.value;
  sel.addEventListener("change", () => {
    if (sel.value !== "@new" && sel.value !== "@sub") { prev = sel.value; fill(prev); return; }
    const c = wcAskCategory(m, sel.value === "@sub" ? prev : "");
    fill(c === null ? prev : c); prev = sel.value;
  });
  return sel;
}
function wcMgrNew(cat) {
  const o = document.getElementById("wcMgrOverlay");
  if (!o) return;
  o._wc._new = cat || "";
  wcMgrSel = null; wcMgrTab = "lists";
  wcRenderManager();
}
function wcEngineListsRaw() { const m = {}; for (const [n, o] of Object.entries(wcAllLists())) m[n] = { text: o.text, opts: o.opts }; return m; }
function wcRenderRulesTab(box) {
  let rules = JSON.parse(JSON.stringify(wcGlobalRules()));
  const inner = wcEl("div");
  wcRulesEditor(inner, rules, r => { rules = r; });
  box.replaceChildren(
    wcEl("div", { class: "hint", style: { marginTop: 0, marginBottom: "10px" } },
      "Rules apply to every roll. “When a pick from list time-of-day is night, then from lighting/natural never pick golden hour sunlight.” ",
      "Conditions see picks made earlier in the roll (the image fields roll first, then the elements in order). Values are matched whole and case-insensitively; use * for “contains”, e.g. *sun*. ",
      "For one-off conditions inside a field, use a guard: ", wcEl("code", {}, "{[time=night] neon|[time!=night] sunlight}"), "."),
    inner,
    wcEl("div", { class: "wc-row", style: { marginTop: "10px" } },
      wcEl("button", { class: "primary", onclick: () => { wcSetGlobalRules(rules.filter(r => r.then && r.then.list)); wcMgrStatus("Rules saved ✓", "ok"); } }, "Save rules"),
      wcEl("button", { class: "ghost", onclick: () => { if (confirm("Replace your rules with the built-in ones?")) { wcRulesStore = null; localStorage.removeItem(WCS_RULES_KEY); wcRenderManager(); } } }, "Restore built-in rules")));
}
function wcSyntaxHelp() {
  const rows = [
    ["{a|b|c}", "one of the options"], ["{2$$a|b|c}", "two different options, joined with “, ”"], ["{1-3$$a|b|c}", "one to three"],
    ["{2$$ and $$a|b|c}", "custom separator"], ["{3::a|1::b}", "weights — a is three times as likely"], ["{40%? a cap}", "40% chance of “a cap”, otherwise nothing"],
    ["__colours__", "a random line from the colours list"], ["__clothes/hats__  or  __hats__", "a list in a folder"], ["__clothes/*__", "any list in the folder"],
    ["{2$$__colours__}", "two different colours"], ["${c=!__colours__}", "pick once and keep it as c"], ["${c}  ${c:red}", "use c (or red if it isn't set)"],
    ["${v=__moods__}", "v is re-rolled every time it's used"], ["{[time=night] neon|[time!=night] sun}", "guards: the option is only possible when the condition holds (var or list pick; = != ~contains; a=x,y; join with &)"],
    ["[season=winter] snowfall", "a guard at the start of a list line"],
    ["${a=!{1|2|3}} {[a=1] __x__|[a=2] __y__|[a=3] __x__ and __y__}", "if / else: pick a once, then choose by its value (a=3 gives one from x and one from y)"], ["\\{  \\}  \\|  \\_", "escape a special character"],
  ];
  return wcEl("div", {},
    wcEl("table", { class: "wc-syntax" }, rows.map(([a, b]) => wcEl("tr", {}, wcEl("td", {}, wcEl("code", {}, a)), wcEl("td", {}, b)))),
    wcEl("div", { class: "hint" }, "Compatible with Dynamic Prompts (sd-dynamic-prompts) wildcard files and syntax; guards, chance and rules are Ideogrammar extras. ",
      "Rolling keeps the field's wildcard source so you can roll again; 🔒 a pick to keep it, ↻ to re-roll just that pick. The same seed with the same locks always gives the same result."));
}

/* ------------------------------------------------------------------ */
/*  Import / export                                                   */
/* ------------------------------------------------------------------ */
async function wcImportFiles(files) {
  let lists = 0, tpls = 0, rules = 0;
  const addPack = (obj, label) => { for (const [n, items] of Object.entries(WC.parsePack(obj))) { const nm = wcSetListQuiet(n, items.join("\n"), { from: label }); if (nm) lists++; } };
  const handle = async (name, text) => {
    const lower = name.toLowerCase(), base = name.replace(/\\/g, "/").replace(/^\/+/, "");
    if (lower.endsWith(".txt")) { if (wcSetListQuiet(base.replace(/\.txt$/i, ""), text)) lists++; return; }
    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) { addPack(WC.parseYaml(text) || {}, base); return; }
    if (lower.endsWith(".json")) {
      const obj = JSON.parse(text);
      if (obj && obj.format === "ideogrammar-wildcards") {
        for (const [n, o] of Object.entries(obj.lists || {})) { if (wcSetListQuiet(n, o.text != null ? o.text : o, o.opts)) lists++; }
        if (Array.isArray(obj.rules)) { wcSetGlobalRules(obj.rules); rules = obj.rules.length; }
        for (const t of obj.templates || []) { if (t && t.id) { wcSaveTemplate(t); tpls++; } }
        for (const [id, d] of Object.entries(obj.previews || {})) if (typeof d === "string" && d.startsWith("data:image/")) wcSetPreview(id, d, true);
      } else if (/(^|\/)_templates\//.test(base) || (obj && obj.global && obj.name)) {
        if (obj && obj.id) { wcSaveTemplate(obj); tpls++; }
      } else if (/(^|\/)_rules\.json$/.test(base) && Array.isArray(obj)) { wcSetGlobalRules(obj); rules = obj.length; }
      else addPack(obj, base);
    }
  };
  try {
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) {
        const entries = await wcUnzip(await f.arrayBuffer());
        const root = wcCommonRoot(entries.map(e => e.name));
        for (const e of entries) await handle(e.name.slice(root.length), new TextDecoder().decode(e.data));
      } else await handle(f.name, await f.text());
    }
    _wcEngineLists = null; wcSave(WCS_LISTS_KEY, wcListOverlay); wcRefreshListPickers();
    wcRenderManager();
    const msg = `Imported ${lists} list${lists === 1 ? "" : "s"}` + (tpls ? `, ${tpls} template${tpls === 1 ? "" : "s"}` : "") + (rules ? `, ${rules} rules` : "") + " ✓";
    wcMgrStatus(msg, "ok"); toast(msg, "ok");
  } catch (err) { wcMgrStatus("Import failed: " + (err.message || err), "err"); }
}
function wcSetListQuiet(name, text, opts) {
  name = WC.normName(name);
  if (!name) return null;
  wcListOverlay[name] = { text: String(text || ""), opts: opts || {}, updatedAt: Date.now() };
  return name;
}
// Strip a single top-level folder that wraps a whole zip ("wildcards/…").
function wcCommonRoot(names) {
  const first = names[0] && names[0].includes("/") ? names[0].slice(0, names[0].indexOf("/") + 1) : "";
  return first && names.every(n => n.startsWith(first)) && first.toLowerCase().startsWith("wildcard") ? first : "";
}
function wcExportBundle() {
  const lists = {};
  for (const [n, o] of Object.entries(wcAllLists())) lists[n] = { text: o.text, opts: o.opts };
  return { format: "ideogrammar-wildcards", version: 1, lists, rules: wcGlobalRules(), previews: wcPreviewMap(), templates: wcAllTemplates().map(t => { const c = { ...t }; delete c.builtin; delete c.modified; return c; }) };
}
function wcExportJSON() {
  wcDownloadBlob(new Blob([JSON.stringify(wcExportBundle(), null, 2)], { type: "application/json" }), "ideogrammar-wildcards.json");
}
function wcExportZip() {
  const b = wcExportBundle(), files = [];
  for (const [n, o] of Object.entries(b.lists)) files.push({ name: "wildcards/" + n + ".txt", data: o.text });
  for (const t of b.templates) files.push({ name: "wildcards/_templates/" + t.id + ".json", data: JSON.stringify(t, null, 2) });
  files.push({ name: "wildcards/_templates/_rules.json", data: JSON.stringify(b.rules, null, 2) });
  wcDownloadBlob(wcZip(files), "ideogrammar-wildcards.zip");
}

/* ------------------------------------------------------------------ */
/*  ZIP: store-only writer, deflate reader (DecompressionStream)      */
/* ------------------------------------------------------------------ */
const WC_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function wcCrc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = WC_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function wcZip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  const d = new Date(), dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = wcCrc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, p) => a + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}
async function wcUnzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a ZIP file");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = [], dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), loff = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (name.endsWith("/") || /(^|\/)(__MACOSX|\.)/.test(name)) continue;
    if (!/\.(txt|ya?ml|json)$/i.test(name)) continue;
    const start = loff + 30 + dv.getUint16(loff + 26, true) + dv.getUint16(loff + 28, true);
    const raw = u8.subarray(start, start + csize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) {
      if (typeof DecompressionStream === "undefined") throw new Error("this browser can't unzip; extract the ZIP and import the files");
      data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    } else continue;
    out.push({ name, data });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Folder sync through comfy_proxy.py                                */
/*    GET  /ideogrammar/wildcards            -> { root, files: [{path, mtime, size}] }
 *    GET|PUT|DELETE /ideogrammar/wildcards/<path>     raw text
 *    GET  /ideogrammar/templates            -> { root, files: [...] }
 *    GET|PUT|DELETE /ideogrammar/templates/<name>.json                       */
/* ------------------------------------------------------------------ */
let wcSyncCfg = wcLoad(WCS_SYNC_KEY, { auto: false, lastSync: 0, known: {} });
async function wcFetch(path, opt) {
  const base = dbBase();
  if (!base) throw new Error("no proxy address");
  const r = await fetch(base + path, opt);
  if (!r.ok) { const t = await r.text().catch(() => ""); const e = new Error(`${r.status} ${t.slice(0, 120)}`); e.status = r.status; throw e; }
  return r;
}
const wcEncPath = p => p.split("/").map(encodeURIComponent).join("/");
async function wcSyncFolder({ interactive } = {}) {
  const status = (m, c) => { wcMgrStatus(m, c); if (interactive && c) toast(m, c === "err" ? "bad" : c); };
  let listing, tlisting;
  try {
    listing = await (await wcFetch("/ideogrammar/wildcards")).json();
    tlisting = await (await wcFetch("/ideogrammar/templates")).json().catch(() => ({ files: [] }));
  } catch (err) {
    if (interactive) status("Folder sync needs comfy_proxy.py running with wildcard support (" + (err.message || err) + "). Open the editor through the proxy, or set the ComfyUI/proxy URL in ⚙ Settings.", "err");
    return false;
  }
  status('<span class="spinner"></span>Syncing…', "");
  const known = wcSyncCfg.known || {}, last = wcSyncCfg.lastSync || 0, now = Date.now();
  const newKnown = {}, conflicts = [];
  let pulled = 0, pushed = 0, removed = 0;
  // ---- lists
  const remote = {};
  for (const f of listing.files || []) {
    if (!/\.txt$/i.test(f.path)) { if (/\.(ya?ml|json)$/i.test(f.path)) remote["pack:" + f.path] = f; continue; }
    remote[WC.normName(f.path)] = f;
  }
  const local = wcAllLists();
  const tomb = Object.entries(wcListOverlay).filter(([, o]) => o && o.deleted).map(([n]) => n);
  const names = new Set([...Object.keys(local), ...Object.keys(remote).filter(k => !k.startsWith("pack:")), ...tomb]);
  const packFiles = new Set(Object.keys(remote).filter(k => k.startsWith("pack:")).map(k => k.slice(5)));
  for (const n of names) {
    const r = remote[n], l = local[n], path = n + ".txt";
    // Lists read from a .yaml/.json pack in the folder are never written back as .txt;
    // they go away when their pack file does.
    if (l && l.pack && !r) {
      if (/\.(ya?ml|json)$/i.test(l.pack) && !packFiles.has(l.pack) && known[l.pack]) { delete wcListOverlay[n]; removed++; }
      continue;
    }
    const kPath = r ? r.path : path;
    const remoteChanged = r && r.mtime > (known[kPath] || 0);
    const localChanged = (wcListOverlay[n] && (wcListOverlay[n].updatedAt || 0) > last);
    if (r && l) {
      const text = remoteChanged || !known[kPath] ? await (await wcFetch("/ideogrammar/wildcards/" + wcEncPath(r.path))).text() : null;
      if (text != null && text.replace(/\r\n/g, "\n").trimEnd() === l.text.replace(/\r\n/g, "\n").trimEnd()) { newKnown[r.path] = r.mtime; continue; }
      if (remoteChanged && localChanged) { conflicts.push({ kind: "list", n, r, text, l }); continue; }
      if (remoteChanged) { wcSetListQuiet(n, text, l.opts); wcListOverlay[n].updatedAt = last; pulled++; newKnown[r.path] = r.mtime; }
      else if (localChanged || text != null) { const res = await (await wcFetch("/ideogrammar/wildcards/" + wcEncPath(r.path), { method: "PUT", body: l.text })).json(); pushed++; newKnown[r.path] = res.mtime || now; }
      else newKnown[r.path] = r.mtime;
    } else if (r && !l) {
      const tombAt = wcListOverlay[n] && wcListOverlay[n].deleted ? wcListOverlay[n].updatedAt || 0 : 0;
      if (tombAt > last && known[r.path]) { await wcFetch("/ideogrammar/wildcards/" + wcEncPath(r.path), { method: "DELETE" }); removed++; }
      else { const text = await (await wcFetch("/ideogrammar/wildcards/" + wcEncPath(r.path))).text(); wcSetListQuiet(n, text); wcListOverlay[n].updatedAt = last; pulled++; newKnown[r.path] = r.mtime; }
    } else if (!r && l) {
      if (known[path] && !localChanged) { wcListOverlay[n] = { deleted: true, updatedAt: last }; removed++; }   // deleted in the folder
      else { const res = await (await wcFetch("/ideogrammar/wildcards/" + wcEncPath(path), { method: "PUT", body: l.text })).json(); pushed++; newKnown[path] = res.mtime || now; }
    }
  }
  // .yaml / .json packs in the folder are read (never written back)
  for (const [k, f] of Object.entries(remote)) {
    if (!k.startsWith("pack:")) continue;
    if (f.mtime <= (known[f.path] || 0)) { newKnown[f.path] = known[f.path]; continue; }
    try {
      const text = await (await wcFetch("/ideogrammar/wildcards/" + wcEncPath(f.path))).text();
      const obj = /\.json$/i.test(f.path) ? JSON.parse(text) : WC.parseYaml(text);
      for (const [n, items] of Object.entries(WC.parsePack(obj || {}))) { wcSetListQuiet(n, items.join("\n"), { pack: f.path }); wcListOverlay[WC.normName(n)].updatedAt = last; pulled++; }
      newKnown[f.path] = f.mtime;
    } catch (err) { status(`Couldn't read ${f.path}: ${err.message}`, "err"); }
  }
  // ---- templates (+ _rules.json)
  const tRemote = {};
  for (const f of tlisting.files || []) if (/\.json$/i.test(f.path)) tRemote[f.path.replace(/\.json$/i, "")] = f;
  const tLocal = {};
  for (const t of wcAllTemplates()) tLocal[t.id] = t;
  const tIds = new Set([...Object.keys(tLocal), ...Object.keys(tRemote).filter(k => k !== "_rules"), ...Object.entries(wcTplOverlay).filter(([, o]) => o && o.deleted).map(([id]) => id)]);
  const tKey = id => "tpl:" + id + ".json";
  const tplJSON = t => { const c = { ...t }; delete c.builtin; delete c.modified; delete c.updatedAt; const pv = wcGetPreview(t.id); if (pv) c.preview = pv; else delete c.preview; return JSON.stringify(c, null, 2); };
  const takeTpl = (id, t) => { if (t.preview) { wcSetPreview(id, t.preview, true, last); delete t.preview; } wcTplOverlay[id] = { ...t, id, updatedAt: last }; };
  for (const id of tIds) {
    const r = tRemote[id], l = tLocal[id], o = wcTplOverlay[id];
    const remoteChanged = r && r.mtime > (known[tKey(id)] || 0);
    const localChanged = (o && (o.updatedAt || 0) > last) || wcPreviewTime(id) > last;
    const url = "/ideogrammar/templates/" + encodeURIComponent(id) + ".json";
    if (r && l) {
      const text = remoteChanged || !known[tKey(id)] ? await (await wcFetch(url)).text() : null;
      if (text != null && JSON.stringify(JSON.parse(text)) === JSON.stringify(JSON.parse(tplJSON(l)))) { newKnown[tKey(id)] = r.mtime; continue; }
      if (remoteChanged && localChanged) { conflicts.push({ kind: "tpl", n: id, r, text, l }); continue; }
      if (remoteChanged) { takeTpl(id, JSON.parse(text)); pulled++; newKnown[tKey(id)] = r.mtime; }
      else { const res = await (await wcFetch(url, { method: "PUT", body: tplJSON(l) })).json(); pushed++; newKnown[tKey(id)] = res.mtime || now; }
    } else if (r && !l) {
      if (o && o.deleted && (o.updatedAt || 0) > last && known[tKey(id)]) { await wcFetch(url, { method: "DELETE" }); removed++; }
      else { takeTpl(id, JSON.parse(await (await wcFetch(url)).text())); pulled++; newKnown[tKey(id)] = r.mtime; }
    } else if (!r && l) {
      if (known[tKey(id)] && !localChanged) { wcTplOverlay[id] = { deleted: true, updatedAt: last }; removed++; }
      else { const res = await (await wcFetch(url, { method: "PUT", body: tplJSON(l) })).json(); pushed++; newKnown[tKey(id)] = res.mtime || now; }
    }
  }
  {
    const r = tRemote._rules, url = "/ideogrammar/templates/_rules.json";
    const localChanged = wcRulesStore && (wcRulesStore.updatedAt || 0) > last;
    if (r && r.mtime > (known["tpl:_rules.json"] || 0) && !localChanged) { const arr = JSON.parse(await (await wcFetch(url)).text()); if (Array.isArray(arr)) { wcRulesStore = { rules: arr, updatedAt: last }; wcSave(WCS_RULES_KEY, wcRulesStore); pulled++; } newKnown["tpl:_rules.json"] = r.mtime; }
    else if (!r || localChanged) { const res = await (await wcFetch(url, { method: "PUT", body: JSON.stringify(wcGlobalRules(), null, 2) })).json(); pushed++; newKnown["tpl:_rules.json"] = res.mtime || now; }
    else newKnown["tpl:_rules.json"] = r.mtime;
  }
  // ---- conflicts: ask once for all
  if (conflicts.length) {
    const keepFolder = confirm(`${conflicts.length} item${conflicts.length === 1 ? " was" : "s were"} changed both here and in the folder since the last sync:\n\n` +
      conflicts.slice(0, 12).map(c => (c.kind === "tpl" ? "template " : "list ") + c.n).join("\n") + (conflicts.length > 12 ? "\n…" : "") +
      "\n\nOK = keep the FOLDER versions\nCancel = keep the versions in this BROWSER");
    for (const c of conflicts) {
      if (c.kind === "list") {
        if (keepFolder) { wcSetListQuiet(c.n, c.text, c.l.opts); wcListOverlay[c.n].updatedAt = last; newKnown[c.r.path] = c.r.mtime; pulled++; }
        else { const res = await (await wcFetch("/ideogrammar/wildcards/" + wcEncPath(c.r.path), { method: "PUT", body: c.l.text })).json(); newKnown[c.r.path] = res.mtime || now; pushed++; }
      } else {
        const url = "/ideogrammar/templates/" + encodeURIComponent(c.n) + ".json";
        if (keepFolder) { takeTpl(c.n, JSON.parse(c.text)); newKnown[tKey(c.n)] = c.r.mtime; pulled++; }
        else { const res = await (await wcFetch(url, { method: "PUT", body: tplJSON(c.l) })).json(); newKnown[tKey(c.n)] = res.mtime || now; pushed++; }
      }
    }
  }
  // tombstones that were applied can go
  for (const [n, o] of Object.entries(wcListOverlay)) if (o && o.deleted && !(n in WC_BUILTIN_LISTS) && !Object.keys(newKnown).some(p => WC.normName(p) === n)) delete wcListOverlay[n];
  wcSyncCfg = { auto: true, lastSync: Date.now(), known: newKnown, root: listing.root };
  wcSave(WCS_SYNC_KEY, wcSyncCfg);
  _wcEngineLists = null; wcSave(WCS_LISTS_KEY, wcListOverlay); wcSave(WCS_TPL_KEY, wcTplOverlay); wcRefreshListPickers();
  if (document.getElementById("wcMgrOverlay")?.classList.contains("show")) wcRenderManager();
  status(`Synced with ${listing.root || "the wildcards folder"} ✓ · ${pulled} in, ${pushed} out${removed ? ", " + removed + " removed" : ""}`, "ok");
  return true;
}

/* ------------------------------------------------------------------ */
/*  Generate modal: style template picker                             */
/* ------------------------------------------------------------------ */
function wcInstallGenerateOption() {
  const grid = document.querySelector("#genOverlay .gen-opt-grid");
  if (!grid || document.getElementById("genStyleTpl")) return;
  const sel = wcEl("select", { id: "genStyleTpl", title: "Roll a style template and ask the model to follow it" });
  const fill = () => {
    const v = sel.value || wcLoad(WCS_GENTPL_KEY, "@current");   // default: follow the image's template
    const cur = wcGetTemplate(state.wild && state.wild.templateId);
    sel.replaceChildren(wcEl("option", { value: "" }, "None"), wcEl("option", { value: "@current" }, "The image's current template" + (cur ? " (" + cur.name + ")" : " (none yet)")));
    const cats = {};
    for (const t of wcAllTemplates()) if (t.scope !== "element") (cats[t.category || "Other"] = cats[t.category || "Other"] || []).push(t);
    for (const [c, ts] of Object.entries(cats)) sel.append(wcEl("optgroup", { label: c }, ts.map(t => wcEl("option", { value: t.id }, t.name))));
    sel.value = v;
    if (sel.value !== v) sel.value = "";
  };
  fill();
  sel.addEventListener("focus", fill);
  sel.addEventListener("change", () => wcSave(WCS_GENTPL_KEY, sel.value));
  grid.append(wcEl("div", {}, wcEl("label", {}, "Style template 🎭"), sel));
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */
function wcInstallCSS() {
  if (document.getElementById("wcCSS")) return;
  document.head.append(wcEl("style", { id: "wcCSS" }, `
  .wc-example-note { border: 1px solid #f59e0b; background: rgba(245,158,11,.1); border-radius: 6px; padding: 7px 9px; margin: 4px 0 6px; font-size: 12px; color: #fbbf24; }
  .wc-example-note button { padding: 4px 9px; font-size: 11.5px; }
  .wc-badge { margin: 4px 0 0; padding: 2px 8px; font-size: 11px; line-height: 1.4; border-radius: 999px; background: rgba(99,102,241,.14); border: 1px solid rgba(99,102,241,.55); color: var(--text); }
  .wc-badge.unresolved { background: rgba(245,158,11,.16); border-color: #f59e0b; }
  .wc-badge:hover { transform: none; }
  .wc-pop { position: fixed; z-index: 300; display: none; background: var(--panel-2); border: 1px solid var(--border-strong); border-radius: var(--r-lg); padding: 10px 12px 12px; box-shadow: 0 20px 60px -15px rgba(0,0,0,.85); max-height: 70vh; overflow: auto; }
  .wc-pop label { margin-top: 8px; }
  .wc-pop-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .wc-pop-row, .wc-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }
  .wc-row > input[type=text] { flex: 1; min-width: 120px; width: auto; }
  .wc-picks { border: 1px solid var(--border); border-radius: 6px; margin-top: 4px; }
  .wc-pick { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) auto auto; gap: 6px; align-items: center; padding: 4px 6px; border-bottom: 1px solid var(--border); font-size: 12px; }
  .wc-pick:last-child { border-bottom: 0; }
  .wc-pick code { color: var(--faint); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wc-pick.nested { opacity: .8; }
  .wc-pick-val { word-break: break-word; }
  .wc-style { margin-top: 12px; border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px 10px; }
  .wc-style summary { cursor: pointer; font-size: 12px; font-weight: 600; padding: 4px 0; }
  .wc-sum { font-weight: 400; color: var(--faint); margin-left: 8px; }
  .wc-style-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 4px 10px; margin-top: 6px; }
  .wc-field label { margin-top: 6px; }
  .wc-in { display: flex; gap: 4px; align-items: center; } .wc-in input { flex: 1; min-width: 0; } .wc-in .wc-badge { margin: 0; }
  .wc-menu { position: fixed; z-index: 250; min-width: 280px; background: var(--panel-2); border: 1px solid var(--border-strong); border-radius: var(--r-lg); padding: 6px; box-shadow: 0 20px 60px -15px rgba(0,0,0,.85); }
  .wc-menu hr { border: 0; border-top: 1px solid var(--border); margin: 6px 0; }
  .wc-mi { display: flex; align-items: center; gap: 6px; padding: 1px 0; }
  .wc-mi > button { flex: 1; text-align: left; border: 0; padding: 7px 10px; }
  .wc-mi.toggle { padding: 6px 10px; font-size: 12px; margin: 0; }
  .wc-ml { font-size: 12px; color: var(--muted); padding-left: 10px; min-width: 40px; }
  .wc-num { width: 64px !important; padding: 4px 6px; } .wc-num.wide { width: 140px !important; flex: 1; }
  .wc-tag { font-size: 10px; font-weight: 500; color: var(--muted); border: 1px solid var(--border-strong); border-radius: 999px; padding: 0 6px; margin-left: 6px; }
  .var-card.wc-active { border-color: var(--accent); }
  .wc-pre { white-space: pre-wrap; word-break: break-word; font-size: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; max-height: 320px; overflow: auto; margin-top: 10px; }
  .wc-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
  @media (max-width: 700px) { .wc-2col { grid-template-columns: 1fr; } .wc-mgr { grid-template-columns: 1fr !important; } }
  .wc-mgr { display: grid; grid-template-columns: 280px 1fr; gap: 14px; min-height: 420px; }
  .wc-side { display: flex; flex-direction: column; min-height: 0; }
  .wc-tree { flex: 1; overflow: auto; max-height: 56vh; border: 1px solid var(--border); border-radius: 6px; margin-top: 8px; padding: 4px; }
  .wc-tree-g { font-size: 11px; color: var(--faint); padding: 6px 6px 2px; display: flex; justify-content: space-between; align-items: center; }
  .wc-tree-add { border: 0; background: transparent; color: var(--faint); padding: 0 6px; font-size: 13px; line-height: 1.2; }
  .wc-tree-lbl { cursor: pointer; user-select: none; flex: 1; min-width: 0; }
  .wc-tree-lbl em { font-style: normal; opacity: .7; }
  .wc-tplcat { font-size: 11.5px; padding: 2px 6px; max-width: 170px; }
  .wc-chip-x { opacity: .7; }
  .wc-tree-add:hover { color: var(--text, #e5e7eb); transform: none; }
  .wc-tree-i { display: flex; width: 100%; justify-content: space-between; gap: 8px; border: 0; background: transparent; padding: 4px 8px; font-size: 12.5px; text-align: left; }
  .wc-tree-i.in { padding-left: 18px; } .wc-tree-i.on { background: rgba(243,36,70,.16); } .wc-tree-i em { color: var(--faint); font-style: normal; font-size: 11px; }
  .wc-tree-i:hover { transform: none; }
  .wc-editor textarea { margin-top: 8px; }
  .wc-mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12.5px; }
  .wc-token { cursor: pointer; font-size: 12px; color: var(--accent-2); }
  .wc-rules { display: flex; flex-direction: column; gap: 8px; margin: 6px 0; }
  .wc-rule { border: 1px solid var(--border); border-radius: 6px; padding: 2px 8px 8px; }
  .wc-rule select { width: auto; } .wc-rule input[type=checkbox] { width: auto; }
  .wc-syntax { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .wc-syntax td { padding: 5px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
  .wc-syntax td:first-child { white-space: nowrap; }
  `));
}

/* ------------------------------------------------------------------ */
/*  Boot                                                              */
/* ------------------------------------------------------------------ */
(function wcBoot() {
  wcInstallCSS();
  wcInstallHeader();
  wcInstallGenerateOption();
  if (!state.wild) state.wild = normWild();
  render();   // first paint happened before this script loaded: add the Style sections and badges
  if (wcSyncCfg.auto && dbBase()) wcSyncFolder({ interactive: false }).catch(() => {});
})();
