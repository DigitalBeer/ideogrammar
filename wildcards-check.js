/* wildcards-check.js — 🔍 Check for clashes.
 * Your AI model reads the finished prompt field by field (which fields the
 * style template rolls, which were written by hand or by Generate) and lists
 * the contradictions: two places, a pose that needs a coat the outfit doesn't
 * have, night in one field and golden-hour sun in another… Each comes with a
 * suggested rewrite of one field. You apply it (this roll only: a rolled field
 * rolls again next time), re-roll a rolled field instead, or ignore it.
 * On demand only: nothing is sent to the model unless you press the button.
 * Loaded after wildcards-ui.js.
 */
"use strict";

const WC_CHECK_PROMPT = `You check a prompt for an image-generation model for CLASHES: places where two of its fields cannot both be true in one picture.

You get every field of the prompt with an id. Fields marked "rolled" are picked at random from lists by a style template on every roll; the template owns the look, place, lighting, clothes and pose. Fields marked "written" were typed by the user or written by an AI model; the subject's description says WHO or WHAT is in the picture and what they hold.

Clashes are things like:
- two different places, times of day, seasons or weather (e.g. "night" in one field, "golden hour sunlight" in another; "kitchen" and "beach")
- a pose or action that contradicts the description or another field ("punching the air" vs "hands in pockets"; "sitting" vs "running")
- a pose, prop or detail that needs clothing the outfit doesn't have ("hands in coat pockets" with a tank top)
- two different objects held in the same hands, or a prop that contradicts the description
- a medium or style that contradicts another (a photograph AND an oil painting; a black-and-white photo with a colour palette described)
- lighting that cannot exist in the place (stage spotlights in an open meadow at noon) unless the place explains it
NOT clashes: extra detail that can coexist, mild redundancy, artistic choices, things that are merely unusual.

For each clash give:
- "fields": the ids involved (2 or more)
- "problem": one short plain-English sentence a non-expert understands
- "fix": {"field": one id, "value": the COMPLETE new text for that one field}. Change as little as possible; keep its length and tone; never use wildcard syntax (__x__, {a|b}). Choose which field to change like this: change the field whose job it is. A "written" description that names a place, outfit, pose or lighting the template rolls should lose those words; a "rolled" field that contradicts the subject (who/what/holding) should be rewritten to fit the subject.

Return ONLY JSON: {"clashes":[{"fields":["…","…"],"problem":"…","fix":{"field":"…","value":"…"}}]}. Return {"clashes":[]} when nothing clashes. Report at most 6, most serious first.`;

// Every field of st, with a short id for the model, its path in the editor,
// a label for people, the text, and whether the template rolls it.
function wcCheckFields(st) {
  const out = [];
  const rolled = (src, key) => !!(src && src[key] && WC.hasSyntax(src[key]));
  const gIds = { hld: "image.description", "style.aesthetics": "image.aesthetics", "style.lighting": "image.lighting", "style.photo": "image.camera", "style.medium": "image.medium", "style.art_style": "image.art_style", background: "image.background" };
  for (const f of WC_GLOBAL_FIELDS) {
    const v = String(f.get(st) || "").trim();
    if (!v) continue;
    out.push({ id: gIds[f.path] || "image." + f.path, path: f.path, label: f.label, value: v, rolled: rolled(st.wild && st.wild.src, f.path) });
  }
  let n = 0;
  for (const el of st.elements) {
    if (el.enabled === false) continue;
    n++;
    for (const f of WC_EL_FIELDS) {
      const v = String(f.get(el) || "").trim();
      if (!v || f.key === "font") continue;
      const short = f.key === "desc" ? "description" : f.key.replace(/^style\./, "");
      out.push({ id: `el${n}.${short}`, path: wcElPath(el, f.key), label: wcPathLabel(wcElPath(el, f.key), st), value: v,
        rolled: rolled(el.wild && el.wild.src, f.key), el: n, type: el.type, cast: !!(el.wild && el.wild.cast) });
    }
  }
  return out;
}
function wcCheckSetField(st, path, value) {
  const g = WC_GLOBAL_FIELDS.find(f => f.path === path);
  if (g) { g.set(st, value); return true; }
  const m = /^e:([^.]+)\.(.+)$/.exec(path);
  if (!m) return false;
  const el = st.elements.find(e => e.wild && e.wild.key === m[1]);
  const f = WC_EL_FIELDS.find(f => f.key === m[2]);
  if (!el || !f) return false;
  f.set(el, value);
  return true;
}

async function wcCheckClashes() {
  let setup;
  try { setup = llmSetup(); } catch (err) { toast(err.message, "bad"); if (typeof openSettings === "function") openSettings(); return; }
  if (typeof wcEnsureRolled === "function") wcEnsureRolled();   // check what would actually be sent
  const fields = wcCheckFields(state);
  if (fields.length < 2) { toast("Nothing to compare yet — the prompt has fewer than two fields.", ""); return; }
  const tpl = wcGetTemplate(state.wild && state.wild.templateId);
  const els = [];
  for (const f of fields) if (f.el && !els[f.el]) els[f.el] = `el${f.el} = element ${f.el}, type ${f.type}${f.cast ? " (added by the template's cast)" : ""}`;
  const user = (tpl ? `Style template: “${tpl.name}”.\n` : "No style template.\n") + els.filter(Boolean).join("\n") + "\n\nFIELDS:\n" +
    fields.map(f => `- ${f.id} [${f.rolled ? "rolled" : "written"}]: ${f.value}`).join("\n");
  const m = wcCheckModal();
  m.list.replaceChildren(wcEl("div", { class: "hint" }, wcEl("span", { class: "spinner" }), " Asking your AI model to read the prompt…"));
  m.fixAll.disabled = true;
  wcOpenModal("wcCheckOverlay");
  const snapshot = JSON.stringify(fields.map(f => [f.path, f.value]));
  let reply;
  try { reply = extractJSON(await llmText(WC_CHECK_PROMPT, user, { json: true })); }
  catch (err) { m.list.replaceChildren(wcEl("div", { class: "hint wc-check-err" }, "The check failed: " + (err.message || err))); return; }
  const byId = new Map(fields.map(f => [f.id, f]));
  const clashes = (reply && Array.isArray(reply.clashes) ? reply.clashes : []).map(c => {
    const fs = (Array.isArray(c.fields) ? c.fields : []).map(id => byId.get(String(id))).filter(Boolean);
    const fixF = c.fix && byId.get(String(c.fix.field));
    const value = c.fix && typeof c.fix.value === "string" ? c.fix.value.trim() : "";
    return { fields: fs, problem: String(c.problem || "").trim(), fix: fixF && value && !WC.hasSyntax(value) && value !== fixF.value ? { f: fixF, value } : null };
  }).filter(c => c.problem && c.fields.length);
  wcShowClashes(m, clashes, snapshot);
}

function wcCheckModal() {
  const m = wcModal("wcCheckOverlay", "🔍 Clashes in the prompt", "760px");
  if (!m.built) {
    m.built = true;
    m.list = wcEl("div", { class: "wc-check-list" });
    m.body.append(wcEl("div", { class: "hint", style: { marginTop: 0 } }, "Your AI model read the prompt and lists things that can't both be true in one picture. A fix changes one field for this roll; a field the template rolls (🎲) rolls again next time. Each fix is one Undo step."), m.list);
    m.fixAll = wcEl("button", {}, "Apply all fixes");
    m.foot.append(m.fixAll, wcEl("button", { onclick: () => wcCheckClashes() }, "🔍 Check again"), wcEl("button", { class: "primary", onclick: () => wcCloseModal("wcCheckOverlay") }, "Close"));
  }
  return m;
}
function wcShowClashes(m, clashes, snapshot) {
  if (!clashes.length) {
    m.list.replaceChildren(wcEl("div", { class: "wc-check-ok" }, "✓ No clashes found — every field fits with the others."));
    m.fixAll.disabled = true;
    return;
  }
  const stale = () => JSON.stringify(wcCheckFields(state).map(f => [f.path, f.value])) !== snapshot;
  const cards = clashes.map(c => {
    const status = wcEl("span", { class: "wc-check-status" });
    const done = msg => { status.textContent = msg; card.classList.add("done"); card.querySelectorAll("button").forEach(b => { b.disabled = true; }); };
    const apply = () => {
      if (!c.fix) return false;
      const next = cloneState(state);
      if (!wcCheckSetField(next, c.fix.f.path, c.fix.value)) return false;
      wcCommit(next, "Fix clash: " + c.fix.f.label);
      done("✓ fixed" + (c.fix.f.rolled ? " for this roll" : ""));
      return true;
    };
    const reroll = f => {
      const next = cloneState(state);
      wcRollInto(next, { onlyPaths: new Set([f.path]), bump: true });
      wcCommit(next, "Re-roll: " + f.label);
      done("🎲 re-rolled " + f.label.toLowerCase() + " — check again to see if it fits");
    };
    const card = wcEl("div", { class: "wc-check-card" },
      wcEl("div", { class: "wc-check-problem" }, "⚠ " + c.problem),
      wcEl("div", { class: "wc-check-fields" }, c.fields.map(f => wcEl("div", {}, wcEl("b", {}, f.label + (f.rolled ? " 🎲" : "") + ": "), wcShort(f.value, 160)))),
      c.fix ? wcEl("div", { class: "wc-check-fix" }, wcEl("span", { class: "wc-ml" }, "Suggested: "), wcEl("b", {}, c.fix.f.label + " → "), c.fix.value) : wcEl("div", { class: "hint" }, "No usable fix suggested."),
      wcEl("div", { class: "wc-row" },
        c.fix ? wcEl("button", { class: "primary", onclick: () => { if (stale() && !confirm("The prompt changed since the check. Apply this fix anyway?")) return; apply(); } }, "Apply fix") : null,
        ...c.fields.filter(f => f.rolled && f.path !== "hld").map(f => wcEl("button", { title: "New random pick for this field only", onclick: () => reroll(f) }, "🎲 Re-roll " + f.label.replace(/^Element \d+ \(\w+\) · /, ""))),
        wcEl("button", { class: "ghost", onclick: () => done("ignored") }, "Ignore"),
        status));
    card._apply = apply;
    return card;
  });
  m.list.replaceChildren(wcEl("div", { class: "wc-check-count" }, `${clashes.length} clash${clashes.length === 1 ? "" : "es"} found`), ...cards);
  m.fixAll.disabled = !clashes.some(c => c.fix);
  m.fixAll.onclick = () => {
    if (stale() && !confirm("The prompt changed since the check. Apply the fixes anyway?")) return;
    let n = 0;
    for (const card of cards) if (!card.classList.contains("done") && card._apply()) n++;
    m.fixAll.disabled = true;
    toast(`Applied ${n} fix${n === 1 ? "" : "es"} — Undo takes them back one at a time`, "ok");
  };
}

(function () {
  const css = document.createElement("style");
  css.textContent = `
  .wc-check-list { display: flex; flex-direction: column; gap: 10px; }
  .wc-check-card { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
  .wc-check-card.done { opacity: .6; }
  .wc-check-problem { font-weight: 600; }
  .wc-check-fields { font-size: 12.5px; color: var(--faint); display: flex; flex-direction: column; gap: 2px; }
  .wc-check-fields b { color: var(--text, #e5e7eb); font-weight: 600; }
  .wc-check-fix { font-size: 13px; background: rgba(78,205,196,.08); border-radius: 6px; padding: 6px 8px; }
  .wc-check-status { font-size: 12px; color: var(--faint); margin-left: 4px; }
  .wc-check-ok { padding: 14px; text-align: center; color: #4ade80; }
  .wc-check-err { color: #f87171; }
  .wc-check-count { font-size: 12px; color: var(--faint); }`;
  document.head.append(css);
})();
