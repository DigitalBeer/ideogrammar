/* Ideogrammar — working on lists and templates together.
   1. One window: wildcard lists on the left, templates (grid or editor) on
      the right. The template side can be hidden and brought back without
      losing what you typed.
   2. List-name lookup: typing __ in any text field suggests wildcard lists;
      ↑/↓ to choose, Enter or Tab to insert, Esc to dismiss.
   Loaded after wildcards-ui.js. */

/* ------------------------------------------------------------------ */
/*  One window: lists on the left, templates on the right              */
/* ------------------------------------------------------------------ */
// The Lists manager, the Templates grid and the template editor are built by
// wildcards-ui.js as three dialogs. Their panels are moved into one window
// here; their (now empty) overlays only carry the open/closed state, which
// wcSyncStudio turns into the layout:
//   lists pane    — always, while the window is open
//   template pane — when the grid or the editor is open (the editor wins)
const WC_STUDIO_IDS = ["wcMgrOverlay", "wcTplOverlay", "wcTplEditOverlay"];
let wcStudioEl = null, wcStudioSyncing = false;
const wcSplitBtns = new Set();
function wcShown(id) { const o = document.getElementById(id); return !!(o && o.classList.contains("show")); }
function wcTplDraft() { const o = document.getElementById("wcTplEditOverlay"); return !!(o && o._wc && o._wc.draft); }
function wcStudio() {
  if (wcStudioEl) return wcStudioEl;
  const ov = wcEl("div", { class: "overlay", id: "studioOverlay" });
  const left = wcEl("div", { class: "wc-pane wc-pane-l" }), right = wcEl("div", { class: "wc-pane wc-pane-r" });
  const box = wcEl("div", { class: "wc-studio" }, left, right);
  ov.append(box);
  document.body.append(ov);
  wcStudioEl = { ov, box, left, right };
  return wcStudioEl;
}
// Called by wcModal when one of the three dialogs is first built.
function wcStudioAdopt(id, modal) {
  if (!WC_STUDIO_IDS.includes(id)) return;
  const st = wcStudio();
  modal.classList.add("wc-in-studio");
  (id === "wcMgrOverlay" ? st.left : st.right).append(modal);
}
function wcSyncStudio() {
  if (wcStudioSyncing) return;
  wcStudioSyncing = true;
  try {
    const grid = wcShown("wcTplOverlay"), ed = wcShown("wcTplEditOverlay");
    if ((grid || ed) && !wcShown("wcMgrOverlay")) wcOpenManager();   // templates always come with the lists
    const mgr = wcShown("wcMgrOverlay");
    const st = wcStudio();
    st.ov.classList.toggle("show", mgr || grid || ed);
    st.box.classList.toggle("tpl-on", grid || ed);
    const g = document.getElementById("wcTplOverlay"), e = document.getElementById("wcTplEditOverlay");
    if (g) g._wc.modal.style.display = grid && !ed ? "" : "none";
    if (e) e._wc.modal.style.display = ed ? "" : "none";
    for (const b of wcSplitBtns) {
      if (!b.isConnected) continue;   // may be mid-build; never dropped (there is one per Lists footer)
      b.textContent = grid || ed ? "🎭 Hide templates" : "🎭 Show templates";
      b.classList.toggle("on", grid || ed);
    }
  } finally { wcStudioSyncing = false; }
}
// Closing a dialog inside the window.
function wcStudioOnClose(id) {
  // Closing the editor (×, Esc, Cancel) drops its draft; only "Hide templates" keeps it.
  if (id === "wcTplEditOverlay") { const e = document.getElementById(id); if (e && e._wc) e._wc.draft = false; }
  if (id === "wcMgrOverlay") for (const o of ["wcTplEditOverlay", "wcTplOverlay"]) { const x = document.getElementById(o); if (x) x.classList.remove("show"); }
}
// Open the window: lists only, or lists with templates.
function wcOpenStudio(withTemplates) {
  if (withTemplates) { wcStudioShowTemplates(); return; }
  for (const o of ["wcTplEditOverlay", "wcTplOverlay"]) { const x = document.getElementById(o); if (x) x.classList.remove("show"); }
  wcOpenManager("lists");
}
function wcStudioShowTemplates() {
  wcOpenTemplates();
  if (wcTplDraft()) wcOpenModal("wcTplEditOverlay");   // bring back the template being edited
}
function wcStudioHideTemplates() {
  for (const o of ["wcTplEditOverlay", "wcTplOverlay"]) { const x = document.getElementById(o); if (x) x.classList.remove("show"); }   // the editor keeps its draft
  wcSyncStudio();
}
// The show/hide templates button (Lists footer). The old "lists" side is gone:
// the lists are always there.
function wcSplitButton(side) {
  if (side !== "template") return null;
  const b = wcEl("button", { title: "Show or hide the templates next to the lists" });
  b.addEventListener("click", () => { if (wcShown("wcTplOverlay") || wcShown("wcTplEditOverlay")) wcStudioHideTemplates(); else wcStudioShowTemplates(); });
  wcSplitBtns.add(b);
  setTimeout(wcSyncStudio, 0);
  return b;
}
(function () {
  const css = document.createElement("style");
  css.id = "wcStudioCSS";
  css.textContent = `
  #wcMgrOverlay.show, #wcTplOverlay.show, #wcTplEditOverlay.show { display: none !important; }
  #studioOverlay { padding: 14px; }
  .wc-studio { display: grid; grid-template-columns: 1fr; gap: 10px; width: 100%; max-width: 1800px; height: calc(100vh - 28px); }
  .wc-studio.tpl-on { grid-template-columns: minmax(380px, 1fr) minmax(420px, 1.15fr); }
  .wc-studio:not(.tpl-on) .wc-pane-r { display: none; }
  .wc-pane { min-width: 0; min-height: 0; display: flex; }
  .wc-pane > .modal.wc-in-studio { max-width: none !important; width: 100%; height: 100%; max-height: 100%; display: flex; flex-direction: column; overflow: hidden; animation: none; }
  .wc-pane > .modal.wc-in-studio[style*="display: none"] { display: none !important; }
  .wc-in-studio .modal-body { flex: 1 1 auto; min-height: 0; overflow: auto; }
  .wc-in-studio .modal-foot { flex-wrap: wrap; row-gap: 6px; }
  .wc-studio.tpl-on .wc-pane-l .wc-mgr { grid-template-columns: minmax(170px, 38%) 1fr; }
  .wc-studio.tpl-on .wc-pane-r .wc-2col { grid-template-columns: 1fr; }
  .wc-studio.tpl-on .wc-pane-l .modal-foot .status { flex-basis: 100%; }
  @media (max-width: 900px) { .wc-studio.tpl-on { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; } }
  .wc-ac { position: fixed; z-index: 10000; min-width: 220px; max-width: 420px; max-height: 280px; overflow: auto; background: var(--panel, #11161f); border: 1px solid var(--border-strong, #2a3240); border-radius: 8px; box-shadow: 0 12px 30px rgba(0,0,0,.5); padding: 4px; font-size: 12.5px; }
  .wc-ac div { display: flex; justify-content: space-between; gap: 12px; padding: 5px 8px; border-radius: 5px; cursor: pointer; white-space: nowrap; }
  .wc-ac div.on, .wc-ac div:hover { background: rgba(243,36,70,.16); }
  .wc-ac em { color: var(--faint, #7d8796); font-style: normal; font-size: 11px; }
  .wc-ac b { font-weight: 700; color: var(--text, #e5e7eb); }
  .wc-ac .wc-ac-hint { color: var(--faint, #7d8796); cursor: default; font-size: 11px; }
  .wc-ac .wc-ac-hint:hover { background: transparent; }`;
  document.head.append(css);
})();

/* ------------------------------------------------------------------ */
/*  List-name lookup while typing __                                   */
/* ------------------------------------------------------------------ */
(function () {
  let pop = null, field = null, matches = [], idx = 0, partial = "";
  const isField = t => t && !t.readOnly && !t.disabled && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && /^(text|search)$/i.test(t.type || "text")));

  // The unfinished __name before the caret, or null when not inside one.
  function openRef(t) {
    const pos = t.selectionStart;
    if (pos == null || pos !== t.selectionEnd) return null;
    const before = t.value.slice(0, pos);
    const opens = (before.match(/__/g) || []).length;
    if (opens % 2 === 0) return null;   // every __ is closed
    const m = /__([^\s_{}|$\[\]]*(?:_[^\s_{}|$\[\]]+)*)$/.exec(before);
    return m ? m[1] : null;
  }
  function rank(names, q) {
    q = q.toLowerCase();
    const scored = [];
    for (const n of names) {
      const leaf = n.split("/").pop();
      let s = -1;
      if (!q) s = 3;
      else if (n.startsWith(q)) s = 0;
      else if (leaf.startsWith(q)) s = 1;
      else if (n.includes(q)) s = 2;
      if (s >= 0) scored.push([s, n]);
    }
    return scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).slice(0, 14).map(x => x[1]);
  }
  // Pixel position of the caret inside a text field (mirror-div trick).
  function caretXY(t) {
    const r = t.getBoundingClientRect();
    if (t.tagName !== "TEXTAREA") return { x: r.left + 6, y: r.bottom };
    const cs = getComputedStyle(t), div = document.createElement("div");
    for (const p of ["boxSizing", "width", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderLeftWidth", "whiteSpace", "wordWrap", "tabSize"]) div.style[p] = cs[p];
    Object.assign(div.style, { position: "fixed", visibility: "hidden", whiteSpace: "pre-wrap", wordWrap: "break-word", top: "0", left: "-9999px", overflow: "hidden" });
    div.textContent = t.value.slice(0, t.selectionStart);
    const mark = document.createElement("span"); mark.textContent = "​"; div.append(mark);
    document.body.append(div);
    const x = r.left + mark.offsetLeft - t.scrollLeft, y = r.top + mark.offsetTop - t.scrollTop + (parseFloat(cs.lineHeight) || 18);
    div.remove();
    return { x: Math.min(x, r.right - 40), y: Math.min(y, r.bottom) };
  }
  function close() { if (pop) pop.style.display = "none"; field = null; matches = []; }
  function draw() {
    if (!pop) {
      pop = document.createElement("div"); pop.className = "wc-ac";
      pop.addEventListener("mousedown", e => e.preventDefault());   // keep focus in the field
      document.body.append(pop);
    }
    const lists = wcAllLists();
    pop.replaceChildren(...matches.map((n, i) => {
      const row = document.createElement("div");
      if (i === idx) row.className = "on";
      const name = document.createElement("span");
      const at = partial ? n.toLowerCase().indexOf(partial.toLowerCase()) : -1;
      if (at >= 0) { name.append(n.slice(0, at)); const b = document.createElement("b"); b.textContent = n.slice(at, at + partial.length); name.append(b, n.slice(at + partial.length)); }
      else name.textContent = n;
      const em = document.createElement("em"); em.textContent = String(WC.parseList((lists[n] || {}).text || "").length);
      row.append(name, em);
      row.addEventListener("click", () => accept(n));
      return row;
    }));
    const hint = document.createElement("div"); hint.className = "wc-ac-hint";
    hint.textContent = matches.length ? "↑↓ choose · Enter/Tab insert · Esc close" : `No list matches “${partial}” — make it in 📚 Lists`;
    pop.append(hint);
    const { x, y } = caretXY(field);
    pop.style.display = "block";
    const h = pop.offsetHeight, w = pop.offsetWidth;
    pop.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + "px";
    pop.style.top = (y + h + 8 > innerHeight ? Math.max(8, y - h - 24) : y + 4) + "px";
    const on = pop.querySelector(".on"); if (on) on.scrollIntoView({ block: "nearest" });
  }
  function update(t) {
    const q = openRef(t);
    if (q === null) { close(); return; }
    field = t; partial = q;
    const prev = matches[idx];
    matches = rank(Object.keys(wcAllLists()), q);
    idx = Math.max(0, matches.indexOf(prev));
    draw();
  }
  function accept(name) {
    const t = field; if (!t) return;
    const pos = t.selectionStart, before = t.value.slice(0, pos - partial.length), after = t.value.slice(pos);
    const close2 = after.startsWith("__") ? "" : "__";
    t.value = before + name + close2 + after;
    const caret = before.length + name.length + 2;
    t.setSelectionRange(caret, caret);
    close();
    t.dispatchEvent(new Event("input", { bubbles: true }));
    t.focus();
  }
  document.addEventListener("input", e => { if (isField(e.target)) update(e.target); }, true);
  document.addEventListener("click", e => { if (isField(e.target) && field === e.target) update(e.target); else if (pop && !pop.contains(e.target)) close(); }, true);
  document.addEventListener("focusout", e => { if (e.target === field) setTimeout(() => { if (document.activeElement !== field) close(); }, 120); }, true);
  window.addEventListener("keydown", e => {   // window capture: runs before the dialogs' own Esc/Enter handling
    if (!field || e.target !== field || !pop || pop.style.display === "none") return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!matches.length) return;
      idx = (idx + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length; draw();
    } else if ((e.key === "Enter" || e.key === "Tab") && matches.length) accept(matches[idx]);
    else if (e.key === "Escape") close();
    else return;
    e.preventDefault(); e.stopPropagation();
  }, true);
  window.addEventListener("resize", close);
})();
