/* comfy-workflows.js — render with your own ComfyUI workflows.
 *
 * Export a workflow from ComfyUI once (Workflow → Export (API)), drop it here,
 * and Ideogrammar only fills in what it owns: the prompt (Ideogram or Moss
 * JSON), the image size (aspect ratio + megapixels), the seed. Models, sampler,
 * steps, LoRAs… stay exactly as they are in the workflow.
 *
 * Loaded after the main inline script; uses its globals (comfyCfg, state, …).
 */
"use strict";

const CW_KEY = "ideogrammar.comfyWorkflows";
const CW_TEXT_KEYS = /^(text|prompt|text_g|string|caption|positive_prompt|prompt_text|value)$/i;
let cwList = (() => { try { const a = JSON.parse(localStorage.getItem(CW_KEY)); return Array.isArray(a) ? a : []; } catch (_) { return []; } })();
function cwSave() {
  try { localStorage.setItem(CW_KEY, JSON.stringify(cwList)); return true; }
  catch (err) { toast("Couldn't store the workflow in the browser (" + (err.name || "error") + ")", "bad"); return false; }
}
const cwIsLink = v => Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "number";
const cwTitle = (wf, id) => { const n = wf[id] || {}; return (n._meta && n._meta.title) || n.class_type || id; };

// ---- reading a workflow file ---------------------------------------------
function cwParse(text) {
  let j;
  try { j = JSON.parse(text); } catch (err) { throw new Error("That isn't a JSON file."); }
  if (j && Array.isArray(j.nodes) && Array.isArray(j.links))
    throw new Error("This is ComfyUI's normal workflow file. In ComfyUI, open the workflow and use Workflow → Export (API) instead, then drop that file here.");
  if (j && j.prompt && typeof j.prompt === "object" && !Array.isArray(j.prompt)) j = j.prompt;   // {prompt: {...}} wrapper
  const nodes = j && typeof j === "object" ? Object.entries(j).filter(([, n]) => n && typeof n === "object" && n.class_type && n.inputs) : [];
  if (!nodes.length) throw new Error("No ComfyUI nodes found. Use Workflow → Export (API) in ComfyUI.");
  return Object.fromEntries(nodes);
}

// ---- finding what to fill in ---------------------------------------------
// The prompt: follow every sampler's / guider's "positive" input back to the
// node that turns text into conditioning, and take its text input.
function cwPromptCandidates(wf) {
  const out = [];
  for (const [id, n] of Object.entries(wf))
    for (const [k, v] of Object.entries(n.inputs))
      if (CW_TEXT_KEYS.test(k) && (typeof v === "string" || cwIsLink(v))) out.push({ node: id, input: k });
  return out;
}
function cwDetectPrompt(wf) {
  const cands = cwPromptCandidates(wf);
  const isCand = (id, k) => cands.some(c => c.node === id && c.input === k);
  const seen = new Set();
  let frontier = [];
  for (const n of Object.values(wf)) for (const k of ["positive", "conditioning", "cond"]) if (cwIsLink(n.inputs[k])) frontier.push(n.inputs[k][0]);
  for (let depth = 0; depth < 6 && frontier.length; depth++) {
    const next = [];
    for (const id of frontier) {
      if (seen.has(id) || !wf[id]) continue;
      seen.add(id);
      const n = wf[id];
      const keys = Object.keys(n.inputs).filter(k => isCand(id, k));
      if (keys.length) {
        // prefer the input that is fed by another text node, then the longest string
        keys.sort((a, b) => (cwIsLink(n.inputs[b]) - cwIsLink(n.inputs[a])) || String(n.inputs[b]).length - String(n.inputs[a]).length);
        return { node: id, input: keys[0] };
      }
      for (const v of Object.values(n.inputs)) if (cwIsLink(v)) next.push(v[0]);
    }
    frontier = next;
  }
  // no sampler path found: the longest literal text
  const lit = cands.filter(c => typeof wf[c.node].inputs[c.input] === "string").sort((a, b) => wf[b.node].inputs[b.input].length - wf[a.node].inputs[a.input].length);
  return lit[0] || cands[0] || null;
}
// Size: every node with a width and height gets the exact pixel size — typed-in
// numbers or links from a resolution node alike (a link is replaced by the
// number). Resolution pickers (aspect_ratio + megapixels, e.g. ResolutionSelector)
// also get the editor's ratio, so anything else they feed agrees.
const cwIsNumOrLink = v => typeof v === "number" || cwIsLink(v);
function cwDetectSize(wf) {
  const size = [], res = [];
  for (const [id, n] of Object.entries(wf)) {
    const i = n.inputs;
    if (cwIsNumOrLink(i.width) && cwIsNumOrLink(i.height)) size.push(id);
    if (typeof i.aspect_ratio === "string" && "megapixels" in i) res.push(id);
  }
  return { size, res };
}
function cwDetect(wf) {
  const seed = [];
  for (const [id, n] of Object.entries(wf))
    for (const k of ["seed", "noise_seed"]) if (typeof n.inputs[k] === "number") seed.push({ node: id, input: k });
  const text = JSON.stringify(wf).toLowerCase();
  return { prompt: cwDetectPrompt(wf), ...cwDetectSize(wf), seed, format: /moss/.test(text) ? "moss" : "ideogram" };
}

// ---- building the workflow for a render ----------------------------------
function cwCurrent() {
  const id = String(comfyCfg.source || "");
  return id.startsWith("user:") ? cwList.find(w => w.id === id.slice(5)) || null : null;
}
function cwPromptFor(fmt) {
  return fmt === "moss" ? promptString("moss") : buildPromptText(buildLayoutJSON());
}
// Used by comfyRender: the user's workflow when one is selected, else the built-in one.
function cwBuildRenderWorkflow() {
  const w = cwCurrent();
  if (!w) return buildWorkflow(buildLayoutJSON());
  const wf = JSON.parse(JSON.stringify(w.wf));
  if (!w.map.prompt || !wf[w.map.prompt.node]) throw new Error(`Ideogrammar doesn't know where the prompt goes in “${w.name}”. Pick the prompt node in the ComfyUI render panel.`);
  wf[w.map.prompt.node].inputs[w.map.prompt.input] = cwPromptFor(w.format);
  const { width, height } = computeDims();
  const { size, res } = cwDetectSize(w.wf);   // detected fresh, so workflows added earlier benefit too
  for (const id of size) { wf[id].inputs.width = width; wf[id].inputs.height = height; }
  for (const id of res) {
    if (!isMossOnlyAspect(comfyCfg.aspect_ratio)) wf[id].inputs.aspect_ratio = comfyCfg.aspect_ratio;   // Moss-only ratios aren't in its list; the exact size above still applies
    if (typeof wf[id].inputs.megapixels === "number") wf[id].inputs.megapixels = comfyCfg.megapixels;
  }
  for (const s of w.map.seed || []) if (wf[s.node]) wf[s.node].inputs[s.input] = comfyCfg.seed;
  return wf;
}

// ---- UI --------------------------------------------------------------------
function cwSelectValue() { return cwCurrent() ? comfyCfg.source : "builtin"; }
function cwRenderPanel() {
  const sel = document.getElementById("cf-source"), info = document.getElementById("cf-srcInfo");
  if (!sel) return;
  sel.replaceChildren(
    new Option("Built-in: Ideogram 4", "builtin"),
    ...cwList.map(w => new Option(w.name + (w.format === "moss" ? " · Moss" : " · Ideogram"), "user:" + w.id)),
    new Option("＋ Add a workflow from ComfyUI…", "__add"));
  sel.value = cwSelectValue();
  const w = cwCurrent();
  document.body.classList.toggle("cw-user", !!w);
  if (!w) {
    info.innerHTML = "Ideogrammar's own Ideogram 4 workflow — its settings are below. To render with <b>your</b> ComfyUI workflow (e.g. Moss Image) and its own models and settings, choose <i>＋ Add a workflow from ComfyUI…</i>.";
    return;
  }
  const wf = w.wf;
  const pOpts = cwPromptCandidates(wf);
  const psel = document.createElement("select");
  psel.className = "ai-target-sel";
  psel.append(...pOpts.map(c => new Option(`${cwTitle(wf, c.node)} → ${c.input}${cwIsLink(wf[c.node].inputs[c.input]) ? " (linked)" : ""}`, c.node + "|" + c.input)));
  if (w.map.prompt) psel.value = w.map.prompt.node + "|" + w.map.prompt.input;
  psel.addEventListener("change", () => { const [node, input] = psel.value.split("|"); w.map.prompt = { node, input }; cwSave(); });
  const fsel = document.createElement("select");
  fsel.className = "ai-target-sel";
  fsel.append(new Option("Moss Image JSON", "moss"), new Option("Ideogram JSON", "ideogram"));
  fsel.value = w.format;
  fsel.addEventListener("change", () => { w.format = fsel.value; cwSave(); cwRenderPanel(); });
  const d = computeDims();
  const row = (label, ...kids) => { const r = document.createElement("div"); r.className = "cw-row"; const b = document.createElement("span"); b.textContent = label; r.append(b, ...kids); return r; };
  const txt = s => document.createTextNode(s);
  const btn = (label, title, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "ghost"; b.textContent = label; b.title = title; b.addEventListener("click", fn); return b; };
  info.replaceChildren(
    row("Prompt goes into", psel),
    row("Prompt format", fsel),
    (() => { const z = cwDetectSize(wf), all = [...new Set([...z.res, ...z.size])];
      return row("Size", txt(all.length ? `${d.width}×${d.height} · ${aspectInfo().ratio} (aspect ratio + megapixels below) → ${all.map(id => cwTitle(wf, id)).join(", ")}`
        : "⚠ no width/height found — the workflow renders at its own size, so set the editor's aspect ratio to match it")); })(),
    row("Seed", txt(w.map.seed.length ? `the seed below → ${w.map.seed.map(s => cwTitle(wf, s.node)).join(", ")}` : "the workflow's own")),
    row("Everything else", txt("models, sampler, steps, LoRAs… exactly as in the workflow. Change them in ComfyUI and export again.")),
    (() => { const r = row("", btn("↻ Replace file", "Load an updated export of this workflow (keeps its name)", () => cwPick(w)), btn("✎ Rename", "", () => { const n = prompt("Name for this workflow:", w.name); if (n && n.trim()) { w.name = n.trim(); cwSave(); cwRenderPanel(); } }),
      btn("✕ Remove", "", () => { if (confirm(`Remove “${w.name}” from Ideogrammar? (Nothing changes in ComfyUI.)`)) { cwList = cwList.filter(x => x !== w); comfyCfg.source = "builtin"; saveComfyCfg(); cwSave(); cwRenderPanel(); } })); return r; })());
  if (!w.map.prompt) info.prepend(row("", txt("⚠ No prompt input found — pick it above.")));
}
let cwPickTarget = null;
function cwPick(replace) {
  cwPickTarget = replace || null;
  document.getElementById("cf-sourceFile").click();
}
async function cwAddFile(file, replace) {
  try {
    const wf = cwParse(await file.text());
    const det = cwDetect(wf);
    if (replace) { replace.wf = wf; replace.map = { prompt: det.prompt, size: det.size, seed: det.seed }; cwSave(); comfyCfg.source = "user:" + replace.id; }
    else {
      const name = file.name.replace(/\.json$/i, "").replace(/[_-]?api$/i, "").trim() || "My workflow";
      const w = { id: Math.random().toString(36).slice(2, 10), name, wf, format: det.format, map: { prompt: det.prompt, size: det.size, seed: det.seed } };
      cwList.push(w); cwSave(); comfyCfg.source = "user:" + w.id;
    }
    saveComfyCfg(); cwRenderPanel();
    const w = cwCurrent();
    toast(`Workflow “${w.name}” ready ✓ — sends the ${w.format === "moss" ? "Moss Image" : "Ideogram"} prompt` + (det.prompt ? "" : " (pick the prompt node)"), det.prompt ? "ok" : "bad");
  } catch (err) { toast(err.message, "bad"); }
}
function cwInstall() {
  const panel = document.getElementById("comfyPanel");
  const body = panel && panel.querySelector(".panel-body");
  const anchor = document.getElementById("cf-target");
  if (!body || !anchor || document.getElementById("cf-source")) return;
  const wrap = document.createElement("div");
  wrap.className = "cw-wrap";
  wrap.innerHTML = `<label>Workflow</label><select id="cf-source" title="Which ComfyUI workflow renders the image"></select>
    <input type="file" id="cf-sourceFile" accept=".json,application/json" style="display:none">
    <div class="hint cw-info" id="cf-srcInfo"></div>`;
  anchor.insertAdjacentElement("afterend", wrap);
  const sel = wrap.querySelector("#cf-source"), file = wrap.querySelector("#cf-sourceFile");
  sel.addEventListener("change", () => {
    if (sel.value === "__add") { sel.value = cwSelectValue(); cwHowTo(); return; }
    comfyCfg.source = sel.value; saveComfyCfg(); cwRenderPanel();
  });
  file.addEventListener("change", () => { const f = file.files[0]; if (f) cwAddFile(f, cwPickTarget); file.value = ""; });
  // drop an exported workflow anywhere on the panel
  panel.addEventListener("dragover", e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) { e.preventDefault(); panel.classList.add("cw-drop"); } });
  panel.addEventListener("dragleave", () => panel.classList.remove("cw-drop"));
  panel.addEventListener("drop", e => { panel.classList.remove("cw-drop"); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f && /\.json$/i.test(f.name)) { e.preventDefault(); cwAddFile(f); } });
  ["cf-aspect", "cf-megapixels", "canvasAspect", "canvasMegapixels"].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener("change", () => setTimeout(cwRenderPanel, 0)); });
  const style = document.createElement("style");
  style.textContent = `
    body.cw-user .cf-builtin { display: none !important; }
    .cw-info { margin-top: 6px; }
    .cw-row { margin-top: 6px; font-size: 11.5px; line-height: 1.45; }
    .cw-row > span:first-child { display: block; color: var(--muted); font-weight: 600; }
    .cw-row > span:first-child:empty { display: none; }
    .cw-row select { width: 100%; padding: 3px 6px; }
    .cw-row button { padding: 3px 8px; font-size: 11.5px; margin-right: 4px; }
    #comfyPanel.cw-drop { outline: 2px dashed var(--accent); outline-offset: -4px; }
    .cw-steps li { margin: 6px 0; }
  `;
  document.head.append(style);
  if (comfyCfg.source && comfyCfg.source !== "builtin" && !cwCurrent()) { comfyCfg.source = "builtin"; saveComfyCfg(); }
  cwRenderPanel();
}
function cwHowTo() {
  const m = wcModal("cwHowOverlay", "Add a workflow from ComfyUI", "620px");
  if (!m.built) {
    m.built = true;
    m.body.innerHTML = `
      <ol class="cw-steps">
        <li>In ComfyUI, open (or build) the workflow you render with — e.g. your Moss Image text-to-image workflow — and check it renders there.</li>
        <li>Use <b>Workflow → Export (API)</b> in ComfyUI's menu (older versions: the gear ⚙ → enable dev mode, then <b>Save (API Format)</b>). It saves a <code>.json</code> file.</li>
        <li>Choose that file below, or drop it on the ComfyUI render panel.</li>
      </ol>
      <p class="hint">Ideogrammar then fills in only <b>the prompt</b>, <b>the size</b> (aspect ratio + megapixels) and <b>the seed</b>; you set how many images with <i>Queue multiple renders → Iterations</i>. Models, sampler, steps and LoRAs stay as they are in the workflow — change them in ComfyUI and export again. You can add several workflows and switch between them.</p>
      <p class="hint">Full guide: 📖 Help → “Your own workflow”. If the workflow has a prompt-builder node (e.g. MOSS-Image Prompt Builder), Ideogrammar sends its finished prompt straight to the text encoder instead.</p>`;
    m.foot.append(Object.assign(document.createElement("button"), { className: "primary", textContent: "Choose the exported file…", onclick: () => { wcCloseModal("cwHowOverlay"); cwPick(null); } }),
      Object.assign(document.createElement("button"), { textContent: "Cancel", onclick: () => wcCloseModal("cwHowOverlay") }));
  }
  wcOpenModal("cwHowOverlay");
}
cwInstall();
