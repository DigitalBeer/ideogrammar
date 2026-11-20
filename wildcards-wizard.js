/* wildcards-wizard.js — template preview images, "which lists does this use"
 * links, the step-by-step Template wizard and the Help window.
 * Loaded after wildcards-ui.js and uses its helpers (wcEl, wcModal, …).
 */
"use strict";

/* ------------------------------------------------------------------ */
/*  Template preview images                                           */
/* ------------------------------------------------------------------ */
// Stored apart from the templates, so giving a built-in template a picture
// doesn't turn it into an edited copy: { id: { data: "data:image/jpeg…", updatedAt } }
const WCS_PREV_KEY = "ideogrammar.tplPreviews";
let wcPreviews = wcLoad(WCS_PREV_KEY, {});
function wcGetPreview(id) { const p = wcPreviews[id]; return p && p.data ? p.data : null; }
function wcPreviewTime(id) { const p = wcPreviews[id]; return p ? p.updatedAt || 0 : 0; }
function wcPreviewMap() { const o = {}; for (const [id, p] of Object.entries(wcPreviews)) if (p && p.data) o[id] = p.data; return o; }
function wcSetPreview(id, data, quiet, at) {
  if (data) wcPreviews[id] = { data, updatedAt: at != null ? at : Date.now() };
  else wcPreviews[id] = { data: null, updatedAt: Date.now() };   // keep the time so sync pushes the removal
  wcSave(WCS_PREV_KEY, wcPreviews);
  if (!quiet && document.getElementById("wcTplOverlay")?.classList.contains("show")) wcRenderTemplates();
}
// Scale an image (URL or File) down to a small JPEG data URL.
function wcImageToDataURL(src, max = 480) {
  return new Promise((resolve, reject) => {
    const go = url => {
      const img = new Image();
      if (!/^(data|blob):/.test(url)) img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.82));
        } catch (err) { reject(new Error("the browser won't let the page copy that image (it comes from another address) — download it and use Upload instead")); }
      };
      img.onerror = () => reject(new Error("couldn't load the image"));
      img.src = url;
    };
    if (src instanceof Blob) { const u = URL.createObjectURL(src); go(u); setTimeout(() => URL.revokeObjectURL(u), 30000); }
    else go(src);
  });
}
function wcCurrentRenderSrc() {
  const ri = document.getElementById("renderImg");
  return ri && ri.style.display !== "none" && ri.getAttribute("src") ? ri.src : null;
}
const WC_CAT_LOOK = {
  Editorial: ["📰", ["#F2E8DC", "#C8553D", "#1F1F1F"]], Sports: ["🏆", ["#0B3D91", "#F2A900", "#E4002B"]],
  Film: ["🎬", ["#0F1C2E", "#E07A2D", "#2E8B8B"]], Commercial: ["🛍️", ["#F5F5F5", "#6366F1", "#1A1A1A"]],
  Documentary: ["📷", ["#5B6A5A", "#C9B79C", "#2F2F2F"]], Retro: ["📼", ["#FF2E97", "#00E5FF", "#1B0B3A"]],
  Illustration: ["🎨", ["#FFB4A2", "#6D6875", "#B5E48C"]], Music: ["🎵", ["#7B2CBF", "#F72585", "#10002B"]],
};
function wcTemplateThumb(t, opts = {}) {
  const pv = wcGetPreview(t.id) || t.preview;
  if (pv) return wcEl("div", { class: "wc-thumb" + (opts.big ? " big" : "") }, wcEl("img", { src: pv, alt: t.name + " preview", loading: "lazy" }));
  const [emoji, cat] = WC_CAT_LOOK[t.category] || ["🎭", ["#283341", "#f32446", "#121822"]];
  const pal = (t.global && Array.isArray(t.global.color_palette) && t.global.color_palette.length >= 2) ? t.global.color_palette : cat;
  const bg = `linear-gradient(135deg, ${pal.map((c, i) => `${c} ${Math.round(i / Math.max(1, pal.length - 1) * 100)}%`).join(", ")})`;
  return wcEl("div", { class: "wc-thumb empty" + (opts.big ? " big" : ""), style: { background: bg }, title: "No preview image yet — use 🖼 to add one" },
    wcEl("span", { class: "wc-thumb-emoji" }, emoji), wcEl("span", { class: "wc-thumb-note" }, "no preview yet"));
}
let wcPvMenu = null;
function wcPreviewMenu(t, anchor, onDone) {
  if (wcPvMenu) wcPvMenu.remove();
  const file = wcEl("input", { type: "file", accept: "image/*", style: { display: "none" } });
  const close = () => { if (wcPvMenu) { wcPvMenu.remove(); wcPvMenu = null; } };
  const done = msg => { close(); if (onDone) onDone(); if (msg) toast(msg, "ok"); };
  const fail = err => { close(); toast("Preview: " + (err.message || err), "bad"); };
  file.addEventListener("change", () => { const f = file.files[0]; if (f) wcImageToDataURL(f).then(d => { wcSetPreview(t.id, d); done("Preview set ✓"); }).catch(fail); });
  const render = wcCurrentRenderSrc();
  const item = (label, title, fn, disabled) => wcEl("button", { class: "ghost", title, disabled, onclick: fn }, label);
  wcPvMenu = wcEl("div", { class: "wc-menu wc-pvmenu" },
    wcEl("div", { class: "hint", style: { margin: "2px 8px 6px" } }, "Preview for “" + t.name + "”"),
    item("⬆ Upload an image…", "Any picture that shows the look — e.g. a render made with this template", () => file.click()),
    item("🖼 Use the current render", render ? "The image in the Rendered output window" : "Render something first (ComfyUI mode), then come back", () => wcImageToDataURL(render).then(d => { wcSetPreview(t.id, d); done("Preview set from the current render ✓"); }).catch(fail), !render),
    wcGetPreview(t.id) ? item("✕ Remove the preview", "", () => { wcSetPreview(t.id, null); done("Preview removed"); }) : null,
    file);
  document.body.append(wcPvMenu);
  const r = anchor.getBoundingClientRect();
  wcPvMenu.style.display = "block";
  wcPvMenu.style.left = Math.max(8, Math.min(window.innerWidth - wcPvMenu.offsetWidth - 8, r.left)) + "px";
  const below = r.bottom + 6, h = wcPvMenu.offsetHeight;
  wcPvMenu.style.top = (below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : below) + "px";
  setTimeout(() => document.addEventListener("mousedown", function off(e) { if (wcPvMenu && !wcPvMenu.contains(e.target)) { close(); document.removeEventListener("mousedown", off); } }), 0);
}

// 🖼 Render previews: each template (without a preview, or all of them) is
// applied to the current setup, rolled once, rendered with the ComfyUI
// workflow chosen in the Render tile, and the picture becomes its preview.
// The setup comes back afterwards; Cancel in the Render tile stops the run.
async function wcRenderPreviews() {
  if (typeof comfyRenderAwait !== "function" || typeof comfyBase !== "function") { toast("Rendering isn't available on this page.", "bad"); return; }
  if (!comfyBase()) { toast("Set your ComfyUI server URL in the Render tile first.", "bad"); return; }
  if (rendering || queueActive) { toast("A render is already running — wait for it or cancel it first.", "bad"); return; }
  const all = wcAllTemplates().filter(t => t.scope !== "element");
  let list = all.filter(t => !wcGetPreview(t.id) && !t.preview);
  if (!list.length) {
    if (!confirm(`All ${all.length} templates have a preview. Render new previews for all of them?`)) return;
    list = all;
  } else if (!confirm(`Render previews for ${list.length} template${list.length === 1 ? "" : "s"} without one?\n\nEach template is applied to the setup you have now, rolled once and rendered with your ComfyUI workflow; the picture becomes its preview. For a fair comparison, start from a simple setup (e.g. one person in the middle).\n\nYour setup comes back when it's done. The renders also land in History. Cancel in the Render tile stops the run.`)) return;
  const saved = cloneState(state);
  const btns = [document.getElementById("renderBtn"), document.getElementById("renderBtn2")].filter(Boolean);
  queueActive = true; queueStop = false;
  btns.forEach(b => { b.disabled = true; });
  let ok = 0, failed = 0;
  try {
    for (let i = 0; i < list.length && !queueStop; i++) {
      const t = list[i];
      queueLabel = `🖼 ${i + 1}/${list.length} ${t.name}`;
      const st = cloneState(saved);
      wcApplyTemplateTo(st, t);
      wcRollInto(st, { newSeed: true });
      state = st; render();
      const good = await comfyRenderAwait();
      if (good) {
        const src = wcCurrentRenderSrc();
        try { if (!src) throw new Error("no picture"); wcSetPreview(t.id, await wcImageToDataURL(src), true); ok++; }
        catch (_) { failed++; }
      } else if (queueStop) break;
      else failed++;
    }
  } finally {
    queueLabel = ""; queueActive = false;
    btns.forEach(b => { b.disabled = false; });
    state = saved; render();
    if (typeof scheduleSaveState === "function") scheduleSaveState();
    if (document.getElementById("wcTplOverlay")?.classList.contains("show")) wcRenderTemplates();
  }
  toast(`Previews: ${ok} set${failed ? `, ${failed} failed` : ""}${queueStop ? " (stopped)" : ""}`, ok && !failed ? "ok" : failed ? "bad" : "");
}

/* ------------------------------------------------------------------ */
/*  Which lists a template uses / which templates use a list          */
/* ------------------------------------------------------------------ */
function wcTemplateStrings(t) {
  const out = [];
  const walk = v => { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk([t.global, t.element, t.vars, t.formats]);
  return out;
}
// -> [{ ref, lists: [full names], found }]
function wcTemplateLists(t) {
  const refs = new Set();
  for (const s of wcTemplateStrings(t)) for (const r of WC.listRefs(s)) refs.add(r);
  const lists = wcEngineLists();
  return Array.from(refs).map(ref => { const lk = WC.lookup(lists, ref.replace(/\$\{[^}]*\}/g, "*")); return { ref, lists: lk.lists, found: lk.found }; });
}
function wcListChips(t) {
  const L = wcTemplateLists(t);
  if (!L.length) return null;
  return wcEl("div", { class: "wc-uses" }, wcEl("span", { class: "wc-ml", style: { paddingLeft: 0 } }, "Rolls from:"),
    L.map(x => wcEl("button", {
      class: "chip" + (x.found ? "" : " wc-missing"), title: x.found ? "Open the list " + x.lists.join(", ") : "No list called " + x.ref + " — create it in 📚 Wildcard lists",
      onclick: () => { wcMgrSel = x.lists[0] || null; wcOpenManager("lists"); }
    }, "__" + x.ref + "__")));
}
function wcUsedBy(name) {
  if (!name) return null;
  const users = wcAllTemplates().filter(t => wcTemplateLists(t).some(x => x.lists.includes(name)));
  // lists that refer to this one (e.g. clothes/outfit uses clothes/tops)
  const all = wcAllLists(), lists = wcEngineLists();
  const parents = Object.keys(all).filter(n => n !== name && WC.listRefs(all[n].text).some(r => WC.lookup(lists, r).lists.includes(name)));
  return wcEl("div", { class: "hint wc-usedby" },
    users.length ? ["Used by templates: ", ...users.map((t, i) => [i ? ", " : "", wcEl("a", { href: "#", onclick: e => { e.preventDefault(); wcOpenTemplateEditor(t); } }, t.name)])]
      : ["Not used by any template yet. Put ", wcEl("code", {}, "__" + name + "__"), " in any field or template, or add it with the 🧭 Template wizard."],
    parents.length ? [" · Also inside lists: ", parents.map(p => "__" + p + "__").join(", ")] : null);
}

/* ------------------------------------------------------------------ */
/*  Template wizard                                                    */
/* ------------------------------------------------------------------ */
const WC_SLOT_SUGGEST = {
  aesthetics: ["art-styles", "eras", "moods", "magazine/genres", "colour-schemes"],
  lighting: ["lighting/setups", "lighting/natural", "lighting/practical", "light-sources"],
  photo: ["camera/setup", "camera/shots", "camera/angles", "camera/lenses", "camera/apertures", "camera/film-stocks", "camera/bodies"],
  medium: ["medium", "art-styles"],
  art_style: ["art-styles", "eras"],
  background: ["places", "places/urban", "places/indoor", "places/nature", "places/sports", "time-of-day", "weather", "seasons"],
  hld_suffix: ["moods", "eras", "magazine/genres"],
  "el.lighting": ["lighting/setups", "lighting/natural", "lighting/practical", "colours"],
  "el.camera": ["camera/shots", "camera/angles", "camera/compositions"],
  "el.lens": ["camera/lenses", "camera/apertures"],
  "el.wardrobe": ["clothes/outfit", "clothes/tops", "clothes/outerwear", "clothes/sportswear", "clothes/hats", "clothes/accessories", "colours", "patterns", "materials"],
  "el.pose": ["people/poses"],
  "el.environment": ["places", "time-of-day", "weather", "seasons"],
  "el.mood": ["moods", "people/expressions"],
  "el.extra": ["clothes/accessories", "people/hairstyles", "people/ages", "game/hud", "materials"],
  "el.desc_prefix": ["people/ages", "people/builds", "people/roles"],
  "el.desc_suffix": ["people/expressions", "people/hairstyles"],
};
const WC_WIZ_GLOBAL = [
  ["aesthetics", "Overall look", "The genre and feel of the whole image.", "e.g. glossy __magazine/genres__ magazine cover, bold masthead"],
  ["lighting", "Lighting", "How the scene is lit.", "e.g. __lighting/setups__"],
  ["photo", "Camera & lens", "Shot type, angle, lens, film. Leave empty for paintings and illustrations.", "e.g. __camera/shots__, __camera/lenses__"],
  ["medium", "Medium", "What kind of picture it is.", "e.g. 35mm film photograph"],
  ["art_style", "Art style", "Only for non-photographic images (used when Camera & lens is empty).", "e.g. __art-styles__"],
  ["background", "Background / setting", "Where it happens.", "e.g. __places__ at __time-of-day__, __weather__"],
  ["hld_suffix", "Add to the description", "Added to the end of the high-level description.", "e.g. styled as a __eras__ poster"],
];
const WC_WIZ_ELEMENT = [
  ["desc_prefix", "Who / what", "e.g. a __people/ages__ __people/roles__", "Put in front of each element's own description. Use it if the template should supply the subject; leave it empty to keep the subject you (or ✨ Generate) wrote."],
  ["lighting", "Lighting on them", "e.g. hard rim light"], ["camera", "Camera on them", "e.g. __camera/shots__"], ["lens", "Lens", "e.g. __camera/lenses__"],
  ["wardrobe", "Clothes", "e.g. __clothes/outfit__"], ["pose", "Pose", "e.g. __people/poses__"], ["environment", "Their surroundings", "e.g. __places/urban__"],
  ["mood", "Mood / expression", "e.g. __people/expressions__"],
  ["extra", "Details", "e.g. {50%? __people/hairstyles__}", "Anything that has no field of its own: hairstyle, props, accessories, tattoos…"],
  ["desc_suffix", "After their description", "e.g. with a __people/expressions__", "Added to the end of each element's description, without a label."],
];
// How a field's text shows up in the prompt (for the sample line).
function wcWizLands(scope, key, value) {
  if (scope === "g") {
    if (key === "hld_suffix") return `high-level description: “… ${value}.”`;
    if (key === "background") return `background: “${value}”`;
    const lab = { aesthetics: "Style", lighting: "Lighting", photo: "Camera", medium: "Medium", art_style: "Art style" }[key];
    return `image style → Ideogram style_description.${key}, Moss caption “${lab}: ${value}.”`;
  }
  if (key === "desc_prefix") return `each element: “${value} <their description> …”`;
  if (key === "desc_suffix") return `each element: “<their description> ${value} …”`;
  const lab = (ELEMENT_STYLE_FIELDS.find(f => f[0] === key) || [key, key])[1];
  return `each element: “<their description>. ${lab}: ${value}.”`;
}
// Lists that suit any field (colours, materials…) never trigger the "unusual list" note.
const WC_WIZ_ANYWHERE = /^(colours|colour-schemes|materials|textures|patterns|moods|eras)$/;
const WC_WIZ_FREEFORM = new Set(["g.aesthetics", "g.hld_suffix", "e.extra", "e.desc_prefix", "e.desc_suffix"]);
function wcWizOddLists(scope, key, text) {
  if (WC_WIZ_FREEFORM.has(scope + "." + key)) return [];
  const sug = WC_SLOT_SUGGEST[(scope === "e" ? "el." : "") + key] || [];
  const folders = new Set(sug.map(n => n.split("/")[0]));
  const lists = wcEngineLists();
  const odd = [];
  for (const ref of WC.listRefs(text)) {
    const full = WC.lookup(lists, ref).lists[0];
    if (!full || !(full in WC_BUILTIN_LISTS) || WC_WIZ_ANYWHERE.test(full) || sug.includes(full) || folders.has(full.split("/")[0])) continue;
    odd.push(full);
  }
  return odd;
}
// Every wizard field, for the "make things match" step.
function wcWizFields() {
  const t = wcWiz.t; t.global = t.global || {}; t.element = t.element || {};
  return [
    ...WC_WIZ_GLOBAL.map(([k, label]) => ({ id: "g." + k, label: "Image · " + label, get: () => t.global[k] || "", set: v => { if (v) t.global[k] = v; else delete t.global[k]; } })),
    ...WC_WIZ_ELEMENT.map(([k, label]) => ({ id: "e." + k, label: "Each element · " + label, perElement: true, get: () => t.element[k] || "", set: v => { if (v) t.element[k] = v; else delete t.element[k]; } })),
  ];
}
let wcWiz = null;
function wcOpenWizard(base) {
  const t = base ? JSON.parse(JSON.stringify(base)) : { name: "", category: "Mine", scope: "both", appliesTo: ["subject"], global: {}, element: {}, vars: {}, rules: [], llmNotes: "" };
  if (base) { t.id = ""; t.name = base.name + " (my version)"; delete t.builtin; delete t.modified; }
  wcWiz = { step: 0, t, previewData: base ? wcGetPreview(base.id) : null };
  const m = wcModal("wcWizOverlay", "🧭 Template wizard", "900px");
  wcRenderWizard();
  wcOpenModal("wcWizOverlay");
  void m;
}
const WC_WIZ_STEPS = ["Start", "Whole image", "Each person / object", "Make things match", "Name & preview"];
function wcWizVars() { return Object.keys(wcWiz.t.vars || {}).filter(Boolean); }
function wcWizSample(text) {
  if (!text || !WC.hasSyntax(text)) return text || "";
  const r = WC.resolve(text, { lists: wcEngineLists(), rules: wcGlobalRules(), varDefs: wcWiz.t.vars || {}, seed: WC.newSeed() });
  return r.text + (r.errors.length ? "   ⚠ " + r.errors.join("; ") : "");
}
// One field: text box + suggested lists (click to insert) + a live sample.
function wcWizSlot({ label, help, ph, value, suggest, onInput, scope, key }) {
  const ta = wcEl("textarea", { rows: 2, placeholder: ph || "", spellcheck: false, onkeydown: wcStop });
  ta.value = value || "";
  const sample = wcEl("div", { class: "wc-sample" });
  const warn = wcEl("div", { class: "wc-warn" });
  const reSample = () => {
    const v = ta.value.trim();
    sample.textContent = v ? "→ In the prompt: " + wcWizLands(scope, key, wcWizSample(v)) : "";
    const odd = v ? wcWizOddLists(scope, key, v) : [];
    const lab = scope === "e" ? (ELEMENT_STYLE_FIELDS.find(f => f[0] === key) || [0, label])[1] : label;
    warn.replaceChildren(...(odd.length ? ["⚠ ", odd.map(n => "__" + n + "__").join(", "), ` isn't a usual ${lab.toLowerCase()} list — the prompt would read “${lab}: ${wcWizSample("__" + odd[0] + "__")}”. `,
      scope === "e" ? "Things without their own field (hairstyles, props…) belong in Details." : "If that's what you want, ignore this."] : []));
  };
  ta.addEventListener("input", () => { onInput(ta.value.trim()); reSample(); });
  const lists = wcAllLists();
  const chips = (suggest || []).filter(n => lists[n]).map(n => {
    const items = WC.parseList(lists[n].text).slice(0, 4).map(i => i.text).join(" · ");
    return wcEl("button", { class: "chip", title: `Insert __${n}__ (a random line from this list)\nShift-click: pick two different ones\n\n${items}…`,
      onclick: e => { wcInsertAtCursor(ta, e.shiftKey ? `{2$$__${n}__}` : `__${n}__`); } }, "__" + n + "__");
  });
  const varChips = wcWizVars().map(v => wcEl("button", { class: "chip wc-varchip", title: "Insert the shared choice " + v, onclick: () => wcInsertAtCursor(ta, "${" + v + "}") }, "${" + v + "}"));
  const any = wcEl("select", { class: "ai-target-sel wc-insert" }); any.dataset.ph = "+ any list"; wcListOptions(any, "+ any list");
  any.addEventListener("change", () => { if (any.value) wcInsertAtCursor(ta, "__" + any.value + "__"); any.value = ""; });
  const opt = wcEl("button", { class: "chip", title: "Wrap the text in {…|} so it only appears sometimes", onclick: () => { const v = ta.value.trim(); if (v) { ta.value = `{50%? ${v}}`; ta.dispatchEvent(new Event("input")); } } }, "50% chance");
  setTimeout(reSample, 0);
  return wcEl("div", { class: "wc-slot" },
    wcEl("div", { class: "wc-slot-head" }, wcEl("b", {}, label), help ? wcEl("span", { class: "hint", style: { margin: 0 } }, help) : null),
    ta,
    wcEl("div", { class: "wc-chips" }, chips, varChips, opt, any, wcEl("button", { class: "chip", title: "Roll the sample again", onclick: reSample }, "🎲")),
    sample, warn);
}
function wcRenderWizard() {
  const m = document.getElementById("wcWizOverlay")._wc, w = wcWiz, t = w.t;
  const steps = wcEl("div", { class: "wc-steps" }, WC_WIZ_STEPS.map((s, i) => wcEl("button", { class: "chip" + (i === w.step ? " on" : ""), onclick: () => { w.step = i; wcRenderWizard(); } }, `${i + 1}. ${s}`)));
  const body = [];
  if (w.step === 0) {
    const pick = wcTemplateSelect(t._from || "", id => { const b = wcGetTemplate(id); if (b) { wcOpenWizard(b); wcWiz.t._from = id; wcRenderWizard(); } });
    body.push(
      wcEl("div", { class: "wc-explain" },
        wcEl("p", {}, "A template is a set of fields — the look, lighting, camera, background, and what the people wear and do. Each field can be plain words, or a ", wcEl("b", {}, "roll from a wildcard list"), " like ", wcEl("code", {}, "__lighting/setups__"), ", which picks a random line every time you press 🎲 Roll."),
        wcEl("div", { class: "wc-flow" }, wcEl("span", {}, "📚 lists"), "→", wcEl("span", {}, "🎭 template fields"), "→", wcEl("span", {}, "🎲 roll"), "→", wcEl("span", {}, "📄 Ideogram / Moss prompt")),
        wcEl("p", {}, "The steps: ", wcEl("b", {}, "Whole image"), " (look, light, camera, setting) → ", wcEl("b", {}, "Each person / object"), " (clothes, pose, mood…, rolled separately for each one) → ", wcEl("b", {}, "Make things match"), " (optional: make some picks the same everywhere) → ", wcEl("b", {}, "Name & preview"), "."),
        wcEl("p", {}, "Under each box the wizard suggests lists that fit it — click one to put it in — and shows a sample roll and exactly what it adds to the prompt. You can fine-tune everything later with Edit.")),
      wcEl("div", { class: "wc-row" }, wcEl("b", {}, "Start from"), pick, wcEl("span", { class: "hint", style: { margin: 0 } }, "— or leave it on “no template” to start blank")),
      wcEl("div", { class: "wc-row" }, wcEl("span", { class: "wc-ml" }, "Name"), (() => { const i = wcEl("input", { type: "text", placeholder: "e.g. Retro tennis poster", onkeydown: wcStop, oninput: () => { t.name = i.value; } }); i.value = t.name || ""; return i; })()));
  } else if (w.step === 1) {
    t.global = t.global || {};
    body.push(wcEl("div", { class: "wc-explain" },
      wcEl("p", {}, wcEl("b", {}, "The whole picture: "), "the look, light, camera and setting. Fill only the fields this template should set; empty ones leave the image as it is."),
      wcEl("p", { class: "hint", style: { margin: 0 } }, "Click a ", wcEl("code", {}, "__list__"), " chip to put it in at the cursor (shift-click = two different picks). The line under each box shows a sample roll and where it ends up in the prompt.")));
    for (const [k, label, help, ph] of WC_WIZ_GLOBAL) body.push(wcWizSlot({ label, help, ph, value: t.global[k], suggest: WC_SLOT_SUGGEST[k], scope: "g", key: k, onInput: v => { if (v) t.global[k] = v; else delete t.global[k]; } }));
  } else if (w.step === 2) {
    t.element = t.element || {};
    const types = ["subject", "obj", "text", "logo", "bg"];
    const names = { subject: "people & animals", obj: "objects", text: "text", logo: "logos", bg: "background elements" };
    const boxes = types.map(ty => wcEl("input", { type: "checkbox", checked: (t.appliesTo || ["subject"]).includes(ty), onchange: () => { t.appliesTo = types.filter((x, i) => boxes[i].checked); } }));
    body.push(wcEl("div", { class: "wc-explain" },
        wcEl("p", {}, wcEl("b", {}, "Each person or object, one at a time. "), "These fields are added to every element the template styles, ",
          wcEl("b", {}, "rolled separately for each one"), " — two people with Pose = ", wcEl("code", {}, "__people/poses__"), " get two different poses. (Want them the same? That's the next step.)"),
        wcEl("p", {}, "In the prompt they become labelled sentences after the element's description: ", wcEl("code", {}, "A tennis player. Wardrobe: tennis whites. Pose: mid-action swing."), " The label comes from the box, so put things in the box they belong to — anything without its own box goes in ", wcEl("b", {}, "Details"), "."),
        wcEl("p", {}, wcEl("b", {}, "The subject itself"), " (who the person is) normally comes from each element's own description, written by you or by ✨ Generate. Use ", wcEl("b", {}, "Who / what"), " only if this template should supply the subject too.")),
      wcEl("div", { class: "wc-row" }, wcEl("b", {}, "Style these when applied to the image:"), types.map((ty, i) => wcEl("label", { class: "toggle" }, boxes[i], " " + names[ty]))));
    body.push(wcOverlapBox(t.global, t.element));
    for (const [k, label, ph, help] of WC_WIZ_ELEMENT) body.push(wcWizSlot({ label, help, ph, value: t.element[k], suggest: WC_SLOT_SUGGEST["el." + k], scope: "e", key: k, onInput: v => { if (v) t.element[k] = v; else delete t.element[k]; } }));
  } else if (w.step === 3) {
    t.vars = t.vars || {};
    const fields = wcWizFields();
    const tok = name => "${" + name + "}";
    const usedIn = name => fields.filter(f => f.get().includes(tok(name)));
    // Lists the fields roll from, and where.
    const listUse = {};
    for (const f of fields) for (const ref of WC.listRefs(f.get())) (listUse[ref] = listUse[ref] || []).push(f);
    const varName = ref => { let n = ref.split("/").pop().replace(/[^\w]+/g, "_").replace(/s$/, "") || "choice", i = 1; const base = n; while (t.vars[n] && t.vars[n] !== "__" + ref + "__") n = base + ++i; return n; };
    const makeMatch = ref => {
      const n = varName(ref);
      t.vars[n] = "__" + ref + "__";
      for (const f of listUse[ref] || []) f.set(f.get().split("__" + ref + "__").join(tok(n)));
      wcRenderWizard();
    };
    const demoA = wcWizSample("__people/poses__"), demoB = wcWizSample("__people/poses__"), demoS = wcWizSample("__people/poses__");
    // Worth matching: used in 2+ fields, or per element (then every person gets the same pick).
    const candidates = Object.entries(listUse).filter(([ref, fs]) => !Object.values(t.vars).includes("__" + ref + "__") && (fs.length > 1 || fs.some(f => f.perElement)));
    const vrows = Object.entries(t.vars).map(([k, v]) => {
      const src = wcEl("input", { type: "text", onkeydown: wcStop, placeholder: "__sports__" }); src.value = v;
      const sample = wcEl("span", { class: "wc-sample", style: { display: "inline" } }, v ? "→ " + wcWizSample(v) : "");
      src.addEventListener("input", () => { t.vars[k] = src.value.trim(); sample.textContent = "→ " + wcWizSample(src.value.trim()); });
      const users = usedIn(k);
      const sameList = listUse[v.replace(/^__|__$/g, "")] || [];
      const useIn = wcEl("select", { class: "ai-target-sel" }, wcEl("option", { value: "" }, "＋ use it in a field…"), fields.map(f => wcEl("option", { value: f.id }, f.label)));
      useIn.addEventListener("change", () => { const f = fields.find(x => x.id === useIn.value); if (f) { const cur = f.get(); f.set(cur ? cur + (/[\s,]$/.test(cur) ? "" : ", ") + tok(k) : tok(k)); wcRenderWizard(); } });
      return wcEl("div", { class: "wc-slot" },
        wcEl("div", { class: "wc-row", style: { marginTop: 0 } }, wcEl("code", {}, tok(k)), wcEl("span", {}, "="), src,
          wcEl("button", { class: "iconbtn del", title: "Remove this shared choice (fields that use it are left as they are)", onclick: () => { delete t.vars[k]; wcRenderWizard(); } }, "✕")),
        sample,
        users.length ? wcEl("div", { class: "hint" }, "✓ Used in: " + users.map(f => f.label).join(" · "))
          : wcEl("div", { class: "wc-warn" }, "⚠ Not used in any field yet, so it does nothing. Use it in a field ↓"),
        sameList.length ? wcEl("div", { class: "wc-warn" }, `⚠ ${sameList.map(f => f.label).join(" · ")} still ${sameList.length === 1 ? "rolls" : "roll"} ${v} on ${sameList.length === 1 ? "its" : "their"} own, so ${sameList.length === 1 ? "it won't" : "they won't"} match this choice. `,
          wcEl("button", { class: "chip", onclick: () => { for (const f of sameList) f.set(f.get().split(v).join(tok(k))); wcRenderWizard(); } }, `Use ${tok(k)} there instead`)) : null,
        wcEl("div", { class: "wc-row" }, useIn));
    });
    body.push(wcEl("div", { class: "wc-explain" },
      wcEl("p", {}, wcEl("b", {}, "Optional. "), "Every list in a field is rolled on its own, and per-element fields are rolled separately for each person. A ", wcEl("b", {}, "shared choice"), " is rolled ", wcEl("b", {}, "once"), " and then reused wherever you write its name, so those places always agree."),
      wcEl("table", { class: "wc-demo" },
        wcEl("tr", {}, wcEl("th", {}, ""), wcEl("th", {}, "Person 1"), wcEl("th", {}, "Person 2")),
        wcEl("tr", {}, wcEl("td", {}, "Pose = ", wcEl("code", {}, "__people/poses__")), wcEl("td", {}, demoA), wcEl("td", {}, demoB)),
        wcEl("tr", {}, wcEl("td", {}, "Pose = ", wcEl("code", {}, "${pose}"), wcEl("br"), wcEl("small", {}, "with pose = __people/poses__")), wcEl("td", {}, demoS), wcEl("td", {}, demoS))),
      wcEl("p", {}, "It also links ", wcEl("b", {}, "different"), " fields: with ", wcEl("code", {}, "sport = __sports__"), ", “", wcEl("code", {}, "${sport} video game cover"), "” in the look and “", wcEl("code", {}, "${sport} kit"), "” in Clothes always name the same sport. A shared choice on its own never appears in the prompt — only where you use it.")));
    if (candidates.length) body.push(wcEl("div", { class: "wc-slot" }, wcEl("b", {}, "Lists your fields roll from"),
      wcEl("div", { class: "hint", style: { marginTop: 2 } }, "“Make it match” rolls the list once and puts that one result in every field below that uses it."),
      candidates.map(([ref, fs]) => wcEl("div", { class: "wc-row" }, wcEl("code", {}, "__" + ref + "__"),
        wcEl("span", { class: "hint", style: { margin: 0, flex: "1" } }, "in " + fs.map(f => f.label + (f.perElement ? " (each person rolls their own; matching gives everyone the same)" : "")).join(" · ")),
        wcEl("button", { class: "chip", onclick: () => makeMatch(ref) }, "Make it match")))));
    body.push(wcEl("b", { style: { display: "block", marginTop: "14px" } }, "Shared choices"), ...vrows,
      vrows.length ? null : wcEl("div", { class: "hint" }, "None yet — that's fine; most templates don't need any."),
      wcEl("div", { class: "wc-row" }, wcEl("span", { class: "hint", style: { margin: 0 } }, "Add one:"),
        [["sport", "__sports__"], ["era", "__eras__"], ["mood", "__moods__"], ["colour", "__colours__"], ["pose", "__people/poses__"], ["time", "__time-of-day__"]].filter(([k]) => !t.vars[k]).map(([k, v]) =>
          wcEl("button", { class: "chip", onclick: () => { t.vars[k] = v; wcRenderWizard(); } }, `${k} = ${v}`)),
        wcEl("button", { class: "chip", onclick: () => { let n = "choice", i = 1; while (t.vars[n] != null) n = "choice" + ++i; t.vars[n] = ""; wcRenderWizard(); } }, "＋ other…")));
  } else {
    const name = wcEl("input", { type: "text", placeholder: "Template name", onkeydown: wcStop, oninput: () => { t.name = name.value; } }); name.value = t.name || "";
    const cat = wcEl("input", { type: "text", placeholder: "Category", onkeydown: wcStop, oninput: () => { t.category = cat.value; } }); cat.value = t.category || "Mine";
    const notes = wcEl("textarea", { rows: 2, placeholder: "Optional notes for AI polish / Generate, e.g. 'title big at the top'", onkeydown: wcStop, oninput: () => { t.llmNotes = notes.value.trim(); } }); notes.value = t.llmNotes || "";
    const thumbBox = wcEl("div");
    const drawThumb = () => thumbBox.replaceChildren(wcTemplateThumb({ ...t, id: "__wiz", preview: w.previewData }, { big: true }));
    drawThumb();
    const file = wcEl("input", { type: "file", accept: "image/*", style: { display: "none" }, onchange: () => { const f = file.files[0]; if (f) wcImageToDataURL(f).then(d => { w.previewData = d; drawThumb(); }).catch(err => toast(err.message, "bad")); } });
    const render = wcCurrentRenderSrc();
    const out = wcEl("pre", { class: "wc-pre", style: { display: "none" } });
    const hasAny = Object.keys(t.global || {}).length || Object.keys(t.element || {}).length;
    t.scope = Object.keys(t.global || {}).length && Object.keys(t.element || {}).length ? "both" : Object.keys(t.element || {}).length ? "element" : "global";
    body.push(
      wcEl("div", { class: "wc-2col" }, wcEl("div", { class: "wc-field" }, wcEl("label", {}, "Name"), name), wcEl("div", { class: "wc-field" }, wcEl("label", {}, "Category"), cat)),
      wcEl("div", { class: "wc-field" }, wcEl("label", {}, "Notes for the AI"), notes),
      wcEl("label", {}, "Preview image"),
      wcEl("div", { class: "wc-row", style: { alignItems: "flex-start" } }, thumbBox,
        wcEl("div", { class: "wc-col" },
          wcEl("button", { onclick: () => file.click() }, "⬆ Upload an image…"),
          wcEl("button", { disabled: !render, title: render ? "" : "Render something first (ComfyUI mode)", onclick: () => wcImageToDataURL(render).then(d => { w.previewData = d; drawThumb(); }).catch(err => toast(err.message, "bad")) }, "🖼 Use the current render"),
          w.previewData ? wcEl("button", { class: "ghost", onclick: () => { w.previewData = null; drawThumb(); wcRenderWizard(); } }, "✕ Remove") : null,
          wcEl("div", { class: "hint" }, "Tip: save without a picture, apply the template, render, then come back to 🎭 Templates → 🖼 → Use the current render."), file)),
      wcEl("div", { class: "wc-row" }, wcEl("button", { onclick: () => { try { wcSampleTemplate(t, out); } catch (err) { toast(err.message, "bad"); } } }, "🎲 Show 3 sample rolls")),
      out,
      wcOverlapBox(t.global, t.element),
      hasAny ? null : wcEl("div", { class: "status err" }, "The template is empty — fill some fields in steps 2 and 3."));
  }
  m.body.replaceChildren(steps, wcEl("div", { style: { height: "12px" } }), ...body.filter(Boolean));
  const last = w.step === WC_WIZ_STEPS.length - 1;
  const save = apply => {
    const tpl = JSON.parse(JSON.stringify(t)); delete tpl._from;
    if (!Object.keys(tpl.global || {}).length && !Object.keys(tpl.element || {}).length) { m.setStatus("Fill some fields first.", "err"); return; }
    tpl.name = (tpl.name || "").trim() || "My template";
    tpl.id = wcNewId(tpl.name);
    wcSaveTemplate(tpl);
    if (w.previewData) wcSetPreview(tpl.id, w.previewData, true);
    wcCloseModal("wcWizOverlay");
    toast(`Template “${tpl.name}” saved ✓`, "ok");
    if (apply) wcApplyTemplateReview(tpl, "image");
    else wcOpenTemplates();
  };
  m.foot.replaceChildren(m.status,
    wcEl("button", { class: "ghost", onclick: () => wcOpenHelp("wizard") }, "📖 Help"),
    w.step > 0 ? wcEl("button", { onclick: () => { w.step--; wcRenderWizard(); } }, "← Back") : null,
    !last ? wcEl("button", { class: "primary", onclick: () => { w.step++; wcRenderWizard(); } }, "Next →") : null,
    last ? wcEl("button", { onclick: () => save(false) }, "Save template") : null,
    last ? wcEl("button", { class: "primary", onclick: () => save(true) }, "Save & apply to image") : null);
  m.setStatus("");
  m.body.scrollTop = 0;
}

/* ------------------------------------------------------------------ */
/*  Help window (help.html in a frame)                                */
/* ------------------------------------------------------------------ */
function wcOpenHelp(anchor) {
  const m = wcModal("wcHelpOverlay", "📖 Help", "1100px");
  if (!m.built) {
    m.built = true;
    m.modal.classList.add("wc-help-modal");
    m.frame = wcEl("iframe", { class: "wc-help-frame", title: "Ideogrammar help" });
    m.body.append(m.frame);
    m.newTab = wcEl("a", { class: "hlink wc-help-link", target: "_blank", rel: "noopener" }, "Open in a new tab ↗");
    m.foot.append(m.newTab, wcEl("button", { class: "primary", onclick: () => wcCloseModal("wcHelpOverlay") }, "Close"));
  }
  const url = "help.html" + (anchor ? "#" + anchor : "");
  m.newTab.href = url;
  if (m.frame.getAttribute("src") !== url) m.frame.src = url;
  else if (anchor) try { m.frame.contentWindow.location.hash = anchor; } catch (_) {}
  wcOpenModal("wcHelpOverlay");
}

/* ------------------------------------------------------------------ */
/*  Styles + boot                                                     */
/* ------------------------------------------------------------------ */
(function wcWizardBoot() {
  document.head.append(wcEl("style", {}, `
  .wc-thumb { position: relative; aspect-ratio: 4 / 3; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); display: grid; place-items: center; }
  .wc-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .wc-thumb.big { width: 260px; flex: 0 0 auto; }
  .wc-thumb.empty .wc-thumb-emoji { font-size: 42px; filter: drop-shadow(0 2px 6px rgba(0,0,0,.5)); }
  .wc-thumb-note { position: absolute; bottom: 6px; right: 8px; font-size: 10px; color: rgba(255,255,255,.85); text-shadow: 0 1px 3px #000; }
  .wc-uses { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 11px; }
  .wc-uses .chip, .wc-chips .chip { padding: 2px 7px; font-size: 11px; }
  .chip.wc-missing { border-color: var(--danger); color: var(--danger); }
  .wc-usedby { margin: 6px 0 0; } .wc-usedby a { color: var(--accent-2); }
  .wc-pvmenu { min-width: 240px; }
  .wc-pvmenu > button { display: block; width: 100%; text-align: left; border: 0; padding: 7px 10px; }
  .wc-steps { display: flex; flex-wrap: wrap; gap: 6px; }
  .wc-explain { font-size: 13px; line-height: 1.55; color: var(--text); } .wc-explain p { margin: 0 0 10px; }
  .wc-explain code, .wc-slot code { color: var(--accent-2); }
  .wc-flow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 4px 0 12px; color: var(--muted); }
  .wc-flow span { border: 1px solid var(--border-strong); border-radius: 999px; padding: 4px 10px; color: var(--text); background: var(--bg); }
  .wc-slot { border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; margin-top: 10px; }
  .wc-slot-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; margin-bottom: 6px; }
  .wc-chips { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-top: 6px; }
  .wc-chips select { width: auto; padding: 2px 6px; font-size: 11px; }
  .chip.wc-varchip { border-color: #6366F1; color: #a5b4fc; }
  .wc-warn { font-size: 12px; color: #f59e0b; margin-top: 4px; } .wc-warn:empty { display: none; }
  .wc-warn .chip { margin-left: 4px; border-color: #f59e0b; color: #fbbf24; }
  .wc-demo { border-collapse: collapse; font-size: 12.5px; margin: 6px 0 10px; }
  .wc-demo th, .wc-demo td { border: 1px solid var(--border); padding: 5px 9px; text-align: left; vertical-align: top; }
  .wc-demo th { color: var(--muted); font-weight: 600; } .wc-demo small { color: var(--faint); }
  .wc-sample { display: block; font-size: 12px; color: var(--muted); margin-top: 6px; font-style: italic; word-break: break-word; }
  .wc-col { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .wc-help-modal { max-height: 94vh; display: flex; flex-direction: column; }
  .wc-help-modal .modal-body { padding: 0; flex: 1; min-height: 0; }
  .wc-help-frame { width: 100%; height: calc(94vh - 140px); min-height: 240px; border: 0; display: block; background: var(--bg); }
  .wc-help-link { width: auto !important; padding: 6px 12px; text-decoration: none; font-size: 13px; }
  #wcHelpBtn { font-weight: 700; }
  `));
  if (document.getElementById("wcTplOverlay")) wcRenderTemplates();
})();
