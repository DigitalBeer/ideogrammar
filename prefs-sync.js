/* Ideogrammar — settings backup on the proxy.
   Settings (AI connection and presets, ComfyUI address and workflows, wildcard
   lists, templates, panel sizes...) live in browser localStorage. Some setups
   lose that on every restart (a browser that clears site data on exit, a
   desktop wrapper, opening localhost one day and 127.0.0.1 the next). This file
   mirrors those keys to the proxy's database and puts them back when the
   browser comes up empty. Without the proxy (file://, plain static server)
   it does nothing.
   Loaded first, so it sees every write. */
(function () {
  "use strict";
  const KEYS = new Set([
    "ideogram_llm_cfg", "ideogram_llm_presets", "ideogram_comfy_cfg", "ideogrammar.comfyWorkflows", "ideogram_vec_cfg",
    "ideogrammar.refinePresets", "ideogrammar.genOptions", "ideogrammar.genTemplates", "ideogrammar.genStyleTpl",
    "ideogrammar.wildcards", "ideogrammar.styleTemplates", "ideogrammar.wcRules", "ideogrammar.wcSync",
    "ideogrammar.wcAutoRoll", "ideogrammar.wcPaletteFollow", "ideogrammar.tplPreviews",
    "ideogrammar.listCategories", "ideogrammar.listCollapsed", "ideogrammar.tplCategories",
    "ideogram_grid_layout", "ideogram_grid_preset", "ideogrammar.thumbSize", "ideogrammar.promptSide",
    "ideogrammar.promptSidePretty", "ideogrammar.viewerSpeed", "ideogram_editor_state",
  ]);
  const SEEN = "ideogrammar.prefsSeen";   // absent = this browser's storage was wiped (or never used)
  let ls;
  try { ls = window.localStorage; } catch (_) { return; }
  if (!ls || !/^https?:$/.test(location.protocol)) return;
  const fresh = ls.getItem(SEEN) === null;
  const url = location.origin + "/ideogrammar/prefs";
  const proto = Storage.prototype, setItem = proto.setItem, removeItem = proto.removeItem;
  const dirty = new Set();
  let ready = false, timer = null;

  proto.setItem = function (k, v) { setItem.call(this, k, v); if (this === ls && KEYS.has(k)) queue(k); };
  proto.removeItem = function (k) { removeItem.call(this, k); if (this === ls && KEYS.has(k)) queue(k); };
  function queue(k) {
    dirty.add(k);
    if (!ready) return;
    clearTimeout(timer);
    timer = setTimeout(push, 800);
  }
  function payload() {
    const items = {};
    for (const k of dirty) items[k] = ls.getItem(k);
    dirty.clear();
    return items;
  }
  async function push() {
    timer = null;
    if (!dirty.size) return;
    const items = payload();
    try {
      const r = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
      if (!r.ok) throw new Error(r.status);
    } catch (_) { Object.keys(items).forEach(k => dirty.add(k)); }   // retried on the next change or on leaving
  }
  function flush() {
    if (!ready || !dirty.size) return;
    clearTimeout(timer); timer = null;
    try { navigator.sendBeacon(url, new Blob([JSON.stringify({ items: payload() })], { type: "application/json" })); } catch (_) {}
  }
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

  (async function start() {
    let server;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return;   // older proxy or no proxy: nothing to sync with
      server = (await r.json()).items || {};
    } catch (_) { return; }
    const remoteKeys = Object.keys(server).filter(k => KEYS.has(k) && typeof server[k] === "string");
    if (fresh && remoteKeys.length && !sessionStorage.getItem("ideogrammar.prefsRestored")) {
      // Storage came up empty: put the backup back and reload so every panel reads it.
      for (const k of remoteKeys) setItem.call(ls, k, server[k]);
      setItem.call(ls, SEEN, "1");
      dirty.clear();
      try { sessionStorage.setItem("ideogrammar.prefsRestored", "1"); } catch (_) {}
      location.reload();
      return;
    }
    for (const k of KEYS) {
      const local = ls.getItem(k), remote = typeof server[k] === "string" ? server[k] : null;
      if (local === null && remote !== null) setItem.call(ls, k, remote);   // missing here: take the backup (used on next load)
      else if (local !== null && local !== remote) dirty.add(k);           // newer here: back it up
    }
    setItem.call(ls, SEEN, "1");
    ready = true;
    if (dirty.size) push();
  })();
})();
