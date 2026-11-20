/* wildcards-cast.js — a style template's "cast": extra elements the template adds
 * by itself (a referee, a crowd, a score graphic, a passer-by…).
 * Loaded after wildcards-ui.js.
 *
 * Template field:
 *   cast: [{ name, type, desc, text, font, style: {wardrobe, pose, …}, styled,
 *            place, chance, min, max }]
 *     desc / text / style can use wildcards and the template's ${vars}.
 *     styled: also give it the template's own per-element style (outfit, pose…).
 *     place:  a key of WC_CAST_PLACES. chance: 0–100 (%). min–max: how many.
 *
 * An element added by a cast carries el.wild.cast = { tpl, slot, n, name, bbox, desc }.
 *   - Applying a template adds its cast and takes away the previous template's.
 *   - Every roll decides again whether each cast member shows (chance), how many
 *     (min–max) and, for "anywhere", where. Members not in this roll are switched
 *     off, not deleted, so their locked picks survive.
 *   - Move, resize or lock a cast element, or change its wildcard text, and it is
 *     yours: it stays on, stops rolling in and out, and survives template changes.
 */
"use strict";

const WC_CAST_PLACES = {
  left: { label: "Left", box: [40, 220, 400, 990] },
  right: { label: "Right", box: [600, 220, 960, 990] },
  centre: { label: "Centre", box: [300, 160, 700, 990] },
  "back-left": { label: "Far left, in the distance", box: [60, 320, 300, 720] },
  "back-right": { label: "Far right, in the distance", box: [700, 320, 940, 720] },
  back: { label: "In the distance, spread out", box: [60, 330, 940, 700] },
  front: { label: "Foreground, along the bottom", box: [0, 720, 1000, 1000] },
  top: { label: "Top band", box: [100, 30, 900, 200] },
  bottom: { label: "Bottom band", box: [100, 820, 900, 970] },
  "top-left": { label: "Top-left corner", box: [30, 30, 330, 220] },
  "top-right": { label: "Top-right corner", box: [670, 30, 970, 220] },
  "bottom-left": { label: "Bottom-left corner", box: [30, 780, 330, 970] },
  "bottom-right": { label: "Bottom-right corner", box: [670, 780, 970, 970] },
  sky: { label: "Sky (top third)", box: [0, 0, 1000, 340] },
  full: { label: "Whole frame", box: [0, 0, 1000, 1000] },
  anywhere: { label: "Anywhere (changes every roll)", box: null },
};
const WC_CAST_ANYWHERE = ["left", "right", "back-left", "back-right", "front"];
const WC_CAST_TYPES = ["subject", "obj", "text", "logo", "bg"];

// Clean one cast entry (from a template, or typed in the editor).
function wcCastNorm(d) {
  if (!d || typeof d !== "object") return null;
  const num = (v, def) => Number.isFinite(+v) && v !== "" && v !== null ? +v : def;
  const style = {};
  if (d.style && typeof d.style === "object") for (const k of ELEMENT_STYLE_KEYS) if (typeof d.style[k] === "string" && d.style[k].trim()) style[k] = d.style[k].trim();
  let min = Math.max(0, Math.min(9, Math.round(num(d.min, 1)))), max = Math.max(1, Math.min(9, Math.round(num(d.max, Math.max(1, min)))));
  if (min > max) min = max;
  const out = {
    name: String(d.name || "").trim() || "extra",
    type: WC_CAST_TYPES.includes(d.type) ? d.type : "obj",
    desc: String(d.desc || "").trim(),
    place: WC_CAST_PLACES[d.place] ? d.place : "anywhere",
    chance: Math.max(0, Math.min(100, Math.round(num(d.chance, 100)))),
    min, max,
  };
  if (Object.keys(style).length) out.style = style;
  if (d.styled) out.styled = true;
  if (String(d.text || "").trim()) out.text = String(d.text).trim();
  if (String(d.font || "").trim()) out.font = String(d.font).trim();
  return out.desc || out.text ? out : null;
}
function wcCastDefs(tpl) { return tpl && Array.isArray(tpl.cast) ? tpl.cast.map(wcCastNorm) : []; }

// Small seeded random numbers, so a roll's cast follows its seed like its words do.
function wcCastRand(seed, salt) {
  let h = 2166136261 >>> 0;
  for (const ch of String(seed) + "|" + salt) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Boxes for k members side by side inside a place.
function wcCastBoxes(place, k) {
  const b = (WC_CAST_PLACES[place] || WC_CAST_PLACES.centre).box || WC_CAST_PLACES.centre.box;
  if (k <= 1) return [b.slice()];
  const [x1, y1, x2, y2] = b, w = (x2 - x1) / k, gap = Math.min(16, w * 0.08);
  return Array.from({ length: k }, (_, i) => [Math.round(x1 + i * w + (i ? gap / 2 : 0)), y1, Math.round(x1 + (i + 1) * w - (i < k - 1 ? gap / 2 : 0)), y2]);
}

// The wildcard text an element's description rolls from (or its plain text).
function wcCastDescOf(el) { return (el.wild && el.wild.src && el.wild.src.desc) || el.desc || ""; }
// A cast element the user has taken over.
function wcCastEdited(el) {
  const c = el.wild && el.wild.cast;
  if (!c) return false;
  if (el.locked) return true;
  if (c.bbox && JSON.stringify(el.bbox) !== c.bbox) return true;
  return wcCastDescOf(el) !== c.desc && !(c.desc === "" && !el.desc);
}
function wcCastSetBox(el, box) { el.bbox = box; el.wild.cast.bbox = JSON.stringify(box); }

// Fill one cast element from its definition. Its fields roll like any other.
function wcCastFill(el, d, E, tpl, slot, n) {
  el.type = d.type;
  el.wild = el.wild || normElWild();
  for (const k of Object.keys(el.wild.src)) delete el.wild.src[k];   // the definition is the source now
  el.desc = d.desc;
  el.text = d.text || "";
  el.font = d.font || "";
  const style = {};
  if (d.styled) for (const k of ELEMENT_STYLE_KEYS) if (E[k]) style[k] = E[k];
  Object.assign(style, d.style || {});
  el.style = style;
  if (!el.wild.palRolled && (!Array.isArray(el.color_palette) || el.color_palette.join() === "#FFFFFF")) el.color_palette = [];
  el.wild.templateId = "";
  el.wild.cast = { tpl: tpl.id, slot, n, name: d.name, bbox: el.wild.cast && el.wild.cast.bbox || "", desc: d.desc };
  if (!el.wild.cast.bbox) wcCastSetBox(el, wcCastBoxes(d.place === "anywhere" ? "right" : d.place, 1)[0]);
}

// Apply a template's cast to st: drop the previous template's members, add or
// refresh this one's. Returns the keys of this template's cast elements.
function wcApplyCast(st, tpl) {
  const defs = wcCastDefs(tpl);
  st.elements = st.elements.filter(el => {
    const c = el.wild && el.wild.cast;
    if (!c) return true;
    if (wcCastEdited(el)) {   // the user's own now
      // Fields that use the old template's ${variables} keep the words they have; plain wildcards keep rolling.
      if (c.tpl !== tpl.id) for (const k of Object.keys(el.wild.src)) if (/\$\{/.test(el.wild.src[k])) delete el.wild.src[k];
      delete el.wild.cast; return true;
    }
    if (c.tpl !== tpl.id) return false;
    const d = defs[c.slot];
    return !!d && c.n < d.max;
  });
  const E = (wcTemplateFor(tpl, aiTarget()).element) || {};
  const keys = new Set();
  defs.forEach((d, slot) => {
    if (!d) return;
    for (let n = 0; n < d.max; n++) {
      let el = st.elements.find(e => e.wild && e.wild.cast && e.wild.cast.tpl === tpl.id && e.wild.cast.slot === slot && e.wild.cast.n === n);
      if (!el) {
        el = emptyElement({ type: d.type, color_palette: [] });
        if (d.type === "bg") st.elements.unshift(el); else st.elements.push(el);
      }
      wcCastFill(el, d, E, tpl, slot, n);
      keys.add(el.wild.key);
    }
  });
  return keys;
}

// On every roll: who shows up this time, how many, and where.
function wcRollCast(st) {
  if (!st || !st.wild || !st.elements.some(e => e.wild && e.wild.cast)) return;
  const tpl = wcGetTemplate(st.wild.templateId);
  const defs = tpl ? wcCastDefs(tpl) : [];
  const groups = new Map();
  for (const el of st.elements) {
    const c = el.wild && el.wild.cast;
    if (!c || wcCastEdited(el)) continue;
    if (!tpl || c.tpl !== tpl.id || !defs[c.slot]) continue;
    if (!groups.has(c.slot)) groups.set(c.slot, []);
    groups.get(c.slot).push(el);
  }
  const salt = (st.wild.salts && st.wild.salts["@cast"]) || 0;
  for (const [slot, els] of groups) {
    const d = defs[slot];
    const rnd = wcCastRand(st.wild.seed, tpl.id + "#" + slot + "#" + salt);
    const shows = rnd() * 100 < d.chance;
    const k = shows ? Math.min(els.length, d.min + Math.floor(rnd() * (d.max - d.min + 1))) : 0;
    const place = d.place === "anywhere" ? WC_CAST_ANYWHERE[Math.floor(rnd() * WC_CAST_ANYWHERE.length)] : d.place;
    const boxes = wcCastBoxes(place, Math.max(1, k));
    els.sort((a, b) => a.wild.cast.n - b.wild.cast.n).forEach((el, i) => {
      el.enabled = i < k;
      if (i < k) wcCastSetBox(el, boxes[i]);
    });
  }
}

// For Generate / Improve: what the template adds by itself, so the model leaves it out.
function wcCastSummary(tpl) {
  const defs = wcCastDefs(tpl).filter(Boolean);
  if (!defs.length) return "";
  return defs.map(d => d.name + (d.chance < 100 ? " (sometimes)" : "")).join(", ");
}

/* ------------------------------------------------------------------ */
/*  Template editor: the cast section                                 */
/* ------------------------------------------------------------------ */
// Builds the editor box for a template's cast. Returns { el, collect }.
function wcCastEditor(cast, onInput) {
  let rows = (Array.isArray(cast) ? cast : []).map(d => JSON.parse(JSON.stringify(d)));
  const box = wcEl("div", { class: "wc-cast" });
  const draw = () => {
    box.replaceChildren();
    rows.forEach((d, i) => {
      const inp = (v, ph, w) => { const x = wcEl("input", { type: "text", placeholder: ph, onkeydown: wcStop, style: w ? { width: w } : {} }); x.value = v == null ? "" : v; return x; };
      const name = inp(d.name, "name, e.g. referee", "140px");
      const type = wcEl("select", {}, WC_CAST_TYPES.map(t => wcEl("option", { value: t }, t)));
      type.value = d.type || "obj";
      const place = wcEl("select", {}, Object.entries(WC_CAST_PLACES).map(([k, p]) => wcEl("option", { value: k }, p.label)));
      place.value = d.place || "anywhere";
      const chance = wcEl("input", { type: "number", min: 0, max: 100, step: 5, style: { width: "62px" }, onkeydown: wcStop, title: "Chance it appears in a roll (%)" }); chance.value = d.chance == null ? 100 : d.chance;
      const min = wcEl("input", { type: "number", min: 0, max: 9, style: { width: "48px" }, onkeydown: wcStop, title: "At least" }); min.value = d.min == null ? 1 : d.min;
      const max = wcEl("input", { type: "number", min: 1, max: 9, style: { width: "48px" }, onkeydown: wcStop, title: "At most" }); max.value = d.max == null ? Math.max(1, +min.value) : d.max;
      const desc = wcEl("textarea", { rows: 2, spellcheck: false, onkeydown: wcStop, placeholder: "who or what it is, e.g. a referee in a striped shirt blowing a whistle — wildcards and ${vars} work" }); desc.value = d.desc || "";
      const text = inp(d.text, "words to show (text / logo only)");
      const font = inp(d.font, "typography (text / logo only)");
      const styled = wcEl("input", { type: "checkbox", checked: !!d.styled });
      const styleIn = {};
      for (const [k, l] of ELEMENT_STYLE_FIELDS) styleIn[k] = inp(d.style && d.style[k], l.toLowerCase());
      const isText = () => type.value === "text" || type.value === "logo";
      const textRow = wcEl("div", { class: "wc-row" }, text, font);
      const sync = () => {
        textRow.style.display = isText() ? "" : "none";
        const s = {};
        for (const k of Object.keys(styleIn)) if (styleIn[k].value.trim()) s[k] = styleIn[k].value.trim();
        rows[i] = { name: name.value.trim(), type: type.value, desc: desc.value.trim(), place: place.value, chance: +chance.value, min: +min.value, max: +max.value,
          ...(Object.keys(s).length ? { style: s } : {}), ...(styled.checked ? { styled: true } : {}),
          ...(isText() && text.value.trim() ? { text: text.value.trim() } : {}), ...(isText() && font.value.trim() ? { font: font.value.trim() } : {}) };
        if (onInput) onInput();
      };
      const card = wcEl("div", { class: "wc-cast-row" },
        wcEl("div", { class: "wc-row" }, name, type, place,
          wcEl("label", { class: "toggle", title: "Chance it appears in a roll" }, chance, "%"),
          wcEl("label", { class: "toggle", title: "How many when it appears" }, min, "–", max),
          wcEl("button", { class: "iconbtn del", title: "Remove from the cast", onclick: () => { rows.splice(i, 1); draw(); if (onInput) onInput(); } }, "✕")),
        desc, textRow,
        wcEl("details", { class: "wc-cast-style" }, wcEl("summary", {}, "Style for this one"),
          wcEl("label", { class: "toggle", title: "Also give it the outfit, pose, mood… set under Per element" }, styled, " Use the template's per-element style too"),
          wcEl("div", { class: "wc-2col" }, ELEMENT_STYLE_FIELDS.map(([k, l]) => wcEl("div", { class: "wc-field" }, wcEl("label", {}, l), styleIn[k])))));
      card.addEventListener("input", sync);
      card.addEventListener("change", sync);
      textRow.style.display = isText() ? "" : "none";
      box.append(card);
    });
    box.append(wcEl("button", { class: "ghost", onclick: () => { rows.push({ name: "", type: "subject", desc: "", place: "anywhere", chance: 100, min: 1, max: 1 }); draw(); } }, "＋ Add to the cast"));
  };
  draw();
  return { el: box, collect: () => rows.map(wcCastNorm).filter(Boolean) };
}

(function () {
  const css = document.createElement("style");
  css.id = "wcCastCSS";
  css.textContent = `
  .wc-cast { display: flex; flex-direction: column; gap: 8px; }
  .wc-cast-row { border: 1px solid var(--border); border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
  .wc-cast-row .wc-row { flex-wrap: wrap; gap: 6px; align-items: center; }
  .wc-cast-row select { max-width: 210px; }
  .wc-cast-row textarea { width: 100%; }
  .wc-cast-style summary { cursor: pointer; font-size: 12px; color: var(--faint); }
  .wc-cast-tag { font-size: 10.5px; padding: 1px 6px; border-radius: 8px; background: rgba(243,36,70,.16); color: var(--text, #e5e7eb); margin-left: 6px; white-space: nowrap; }`;
  document.head.append(css);
})();
