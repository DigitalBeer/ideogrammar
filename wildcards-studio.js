/* Ideogrammar — working on lists and templates together.
   1. Side by side: the 📚 Lists window and the template editor can share the
      screen (lists left, template right). The template side can be hidden
      and brought back without losing what you typed.
   2. List-name lookup: typing __ in any text field suggests wildcard lists;
      ↑/↓ to choose, Enter or Tab to insert, Esc to dismiss.
   Loaded after wildcards-ui.js. */

/* ------------------------------------------------------------------ */
/*  Side by side                                                       */
/* ------------------------------------------------------------------ */
let wcSplit = wcLoad("ideogrammar.wcSplit", false);   // remembered: work side by side
const wcSplitBtns = new Set();
function wcShown(id) { const o = document.getElementById(id); return !!(o && o.classList.contains("show")); }
function wcTplDraft() { const o = document.getElementById("wcTplEditOverlay"); return !!(o && o._wc && o._wc.draft); }
function wcSyncSplit() {
  const both = wcShown("wcMgrOverlay") && wcShown("wcTplEditOverlay");
  document.body.classList.toggle("wc-split", !!(wcSplit && both));
  for (const b of wcSplitBtns) {
    if (!b.isConnected) { wcSplitBtns.delete(b); continue; }
    if (b.dataset.side === "lists") b.textContent = wcShown("wcMgrOverlay") && wcSplit ? "📚 Hide lists" : "📚 Lists beside";
    else b.textContent = wcShown("wcTplEditOverlay") ? "🎭 Hide template" : wcTplDraft() ? "🎭 Show template" : "🎭 Template beside";
  }
}
// side "lists": button in the template editor; side "template": button in the Lists window.
function wcSplitButton(side) {
  const b = wcEl("button", { title: side === "lists" ? "Show the wildcard lists next to this template" : "Show the template you're editing next to the lists (or pick one to edit)" });
  b.dataset.side = side;
  b.addEventListener("click", () => {
    if (side === "lists") {
      if (wcShown("wcMgrOverlay") && wcSplit) { wcCloseModal("wcMgrOverlay"); return; }
      wcSplit = true; wcSave("ideogrammar.wcSplit", true);
      wcOpenManager();
      return;
    }
    if (wcShown("wcTplEditOverlay")) { wcCloseModal("wcTplEditOverlay"); return; }   // hide; the draft stays
    wcSplit = true; wcSave("ideogrammar.wcSplit", true);
    if (wcTplDraft()) wcOpenModal("wcTplEditOverlay");
    else { wcOpenTemplates(); toast("Pick a template and press Edit — it opens next to the lists.", ""); }
  });
  wcSplitBtns.add(b);
  setTimeout(wcSyncSplit, 0);
  return b;
}
// Template editor opened from the template grid while the lists are up: go side by side.
(function () {
  const css = document.createElement("style");
  css.id = "wcStudioCSS";
  css.textContent = `
  body.wc-split #wcMgrOverlay.show { right: 50%; padding-right: 6px; }
  body.wc-split #wcTplEditOverlay.show { left: 50%; padding-left: 6px; }
  body.wc-split #wcMgrOverlay .modal, body.wc-split #wcTplEditOverlay .modal { max-width: none !important; width: 100%; height: calc(100vh - 40px); max-height: calc(100vh - 40px); display: flex; flex-direction: column; overflow: hidden; }
  body.wc-split #wcMgrOverlay .modal-body, body.wc-split #wcTplEditOverlay .modal-body { flex: 1 1 auto; min-height: 0; overflow: auto; }
  body.wc-split #wcMgrOverlay .modal-foot, body.wc-split #wcTplEditOverlay .modal-foot { flex-wrap: wrap; row-gap: 6px; }
  body.wc-split #wcMgrOverlay .modal-foot .status, body.wc-split #wcTplEditOverlay .modal-foot .status { flex-basis: 100%; }
  body.wc-split #wcMgrOverlay .wc-mgr { grid-template-columns: minmax(170px, 34%) 1fr; }
  body.wc-split #wcTplEditOverlay .wc-2col { grid-template-columns: 1fr; }
  .wc-ac { position: fixed; z-index: 10000; min-width: 220px; max-width: 420px; max-height: 280px; overflow: auto; background: var(--panel, #11161f); border: 1px solid var(--border-strong, #2a3240); border-radius: 8px; box-shadow: 0 12px 30px rgba(0,0,0,.5); padding: 4px; font-size: 12.5px; }
  .wc-ac div { display: flex; justify-content: space-between; gap: 12px; padding: 5px 8px; border-radius: 5px; cursor: pointer; white-space: nowrap; }
  .wc-ac div.on, .wc-ac div:hover { background: rgba(243,36,70,.16); }
  .wc-ac em { color: var(--faint, #7d8796); font-style: normal; font-size: 11px; }
  .wc-ac b { font-weight: 700; color: var(--text, #e5e7eb); }
  .wc-ac .wc-ac-hint { color: var(--faint, #7d8796); cursor: default; font-size: 11px; }
  .wc-ac .wc-ac-hint:hover { background: transparent; }
  @media (max-width: 900px) { body.wc-split #wcMgrOverlay.show { right: 0; bottom: 50%; padding-right: 20px; } body.wc-split #wcTplEditOverlay.show { left: 0; top: 50%; padding-left: 20px; } body.wc-split #wcMgrOverlay .modal, body.wc-split #wcTplEditOverlay .modal { height: calc(50vh - 30px); max-height: calc(50vh - 30px); } }`;
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
