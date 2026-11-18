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
  ["lighting", "Lighting on them", "e.g. hard rim light"], ["camera", "Camera on them", "e.g. __camera/shots__"], ["lens", "Lens", "e.g. __camera/lenses__"],
  ["wardrobe", "Clothes", "e.g. __clothes/outfit__"], ["pose", "Pose", "e.g. __people/poses__"], ["environment", "Their surroundings", "e.g. __places/urban__"],
  ["mood", "Mood / expression", "e.g. __people/expressions__"], ["extra", "Details", "e.g. {50%? wearing __clothes/accessories__}"],
  ["desc_prefix", "Before the description", "e.g. a __people/ages__"], ["desc_suffix", "After the description", "e.g. with a __people/expressions__"],
];
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
const WC_WIZ_STEPS = ["Start", "Shared choices", "Image style", "People & objects", "Name & preview"];
function wcWizVars() { return Object.keys(wcWiz.t.vars || {}).filter(Boolean); }
function wcWizSample(text) {
  if (!text || !WC.hasSyntax(text)) return text || "";
  const r = WC.resolve(text, { lists: wcEngineLists(), rules: wcGlobalRules(), varDefs: wcWiz.t.vars || {}, seed: WC.newSeed() });
  return r.text + (r.errors.length ? "   ⚠ " + r.errors.join("; ") : "");
}
// One field: text box + suggested lists (click to insert) + a live sample.
function wcWizSlot({ label, help, ph, value, suggest, onInput }) {
  const ta = wcEl("textarea", { rows: 2, placeholder: ph || "", spellcheck: false, onkeydown: wcStop });
  ta.value = value || "";
  const sample = wcEl("div", { class: "wc-sample" });
  const reSample = () => { const v = ta.value.trim(); sample.textContent = v ? "→ " + wcWizSample(v) : ""; };
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
    sample);
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
        wcEl("p", {}, "This wizard walks through each field and suggests lists that fit it — click a suggestion to put it in. The line under each box shows a sample roll, so you can see what you'll get. You can fine-tune everything later with Edit.")),
      wcEl("div", { class: "wc-row" }, wcEl("b", {}, "Start from"), pick, wcEl("span", { class: "hint", style: { margin: 0 } }, "— or leave it on “no template” to start blank")),
      wcEl("div", { class: "wc-row" }, wcEl("span", { class: "wc-ml" }, "Name"), (() => { const i = wcEl("input", { type: "text", placeholder: "e.g. Retro tennis poster", onkeydown: wcStop, oninput: () => { t.name = i.value; } }); i.value = t.name || ""; return i; })()));
  } else if (w.step === 1) {
    t.vars = t.vars || {};
    const rows = wcEl("div");
    const draw = () => {
      rows.replaceChildren(...Object.entries(t.vars).map(([k, v], idx) => {
        const name = wcEl("input", { type: "text", value: k, placeholder: "name", onkeydown: wcStop, style: { maxWidth: "140px" } });
        const src = wcEl("input", { type: "text", value: v, placeholder: "__sports__", onkeydown: wcStop });
        const any = wcEl("select", { class: "ai-target-sel wc-insert" }); any.dataset.ph = "pick a list"; wcListOptions(any, "pick a list");
        any.addEventListener("change", () => { if (any.value) { src.value = "__" + any.value + "__"; save(); } any.value = ""; });
        const sample = wcEl("span", { class: "wc-sample" });
        const save = () => {
          const e = Object.entries(t.vars); e[idx] = [name.value.trim().replace(/[^\w.\-]/g, "_"), src.value.trim()];
          t.vars = Object.fromEntries(e.filter(([a]) => a)); sample.textContent = "→ " + wcWizSample(src.value.trim());
        };
        name.addEventListener("change", () => { save(); draw(); }); src.addEventListener("input", save);
        setTimeout(() => { sample.textContent = src.value ? "→ " + wcWizSample(src.value.trim()) : ""; }, 0);
        return wcEl("div", { class: "wc-row" }, name, wcEl("span", {}, "="), src, any,
          wcEl("button", { class: "iconbtn del", title: "Remove", onclick: () => { delete t.vars[k]; draw(); } }, "✕"), sample);
      }));
      if (!Object.keys(t.vars).length) rows.append(wcEl("div", { class: "hint" }, "No shared choices yet."));
    };
    draw();
    body.push(wcEl("div", { class: "wc-explain" },
      wcEl("p", {}, wcEl("b", {}, "Optional. "), "A shared choice is rolled once and can be used in several fields, so they agree with each other. Example: ", wcEl("code", {}, "sport = __sports__"),
        ", then write ", wcEl("code", {}, "${sport} video game cover"), " in the look and ", wcEl("code", {}, "${sport} kit"), " in the clothes — both say the same sport."),
      wcEl("p", {}, "Some built-in lists already follow a shared choice called ", wcEl("code", {}, "sport"), ": ", wcEl("code", {}, "__places/sports__"), " picks a matching venue and ", wcEl("code", {}, "__clothes/sportswear__"), " matching kit.")),
      rows, wcEl("button", { class: "ghost", onclick: () => { let n = "choice", i = 1; while (t.vars[n]) n = "choice" + ++i; t.vars[n] = ""; draw(); } }, "＋ Add a shared choice"),
      wcEl("div", { class: "wc-row" }, wcEl("span", { class: "hint", style: { margin: 0 } }, "Quick add:"),
        [["sport", "__sports__"], ["era", "__eras__"], ["mood", "__moods__"], ["colour", "__colours__"], ["time", "__time-of-day__"]].map(([k, v]) =>
          wcEl("button", { class: "chip", onclick: () => { t.vars[k] = v; draw(); } }, `${k} = ${v}`))));
  } else if (w.step === 2) {
    t.global = t.global || {};
    body.push(wcEl("div", { class: "hint", style: { marginTop: 0 } }, "Fill the fields you want this template to set; leave the rest empty to keep whatever the image already has. Click a ", wcEl("code", {}, "__list__"), " chip to insert it at the cursor (shift-click = two different picks)."));
    for (const [k, label, help, ph] of WC_WIZ_GLOBAL) body.push(wcWizSlot({ label, help, ph, value: t.global[k], suggest: WC_SLOT_SUGGEST[k], onInput: v => { if (v) t.global[k] = v; else delete t.global[k]; } }));
  } else if (w.step === 3) {
    t.element = t.element || {};
    const types = ["subject", "obj", "text", "logo", "bg"];
    const names = { subject: "people & animals", obj: "objects", text: "text", logo: "logos", bg: "background elements" };
    body.push(wcEl("div", { class: "wc-explain" }, wcEl("p", {}, "These go on individual elements, as labelled sentences after their description (", wcEl("code", {}, "… Wardrobe: tennis whites. Pose: mid-action swing."), "). “Apply to image” styles these element types:")),
      wcEl("div", { class: "wc-row" }, types.map(ty => { const c = wcEl("input", { type: "checkbox", checked: (t.appliesTo || ["subject"]).includes(ty), onchange: () => { t.appliesTo = types.filter((x, i) => boxes[i].checked); } }); return wcEl("label", { class: "toggle" }, c, " " + names[ty]); })));
    const boxes = Array.from(body[body.length - 1].querySelectorAll("input"));
    for (const [k, label, ph] of WC_WIZ_ELEMENT) body.push(wcWizSlot({ label, ph, value: t.element[k], suggest: WC_SLOT_SUGGEST["el." + k], onInput: v => { if (v) t.element[k] = v; else delete t.element[k]; } }));
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
      hasAny ? null : wcEl("div", { class: "status err" }, "The template is empty — fill some fields in steps 3 and 4."));
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
