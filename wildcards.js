/* wildcards.js — Dynamic-Prompts-style wildcard engine for Ideogrammar.
 *
 * No DOM. Loaded as a plain <script> (exposes window.WC) and as a CommonJS
 * module for the node tests (tests/wildcards.test.mjs).
 *
 * Syntax (Dynamic Prompts compatible):
 *   {a|b|c}                one of
 *   {2$$a|b|c}             two distinct, joined with ", "
 *   {1-3$$a|b|c}           one to three      {-3$$…} = 1–3, {2-$$…} = 2–all
 *   {2$$ and $$a|b|c}      custom separator
 *   {0.5::a|2::b}          weights (default 1)
 *   __colours__            a random line from the "colours" list
 *   __clothes/hats__       folder path;  __clothes/*__  glob (combines lists)
 *   {2$$__colours__}       two distinct items from a list
 *   ${v=text}              set variable (re-evaluated on every use)
 *   ${v=!{a|b}}            set variable, evaluated once and kept
 *   ${v}  ${v:default}     use variable
 *   \{ \} \| \$ \_          escape
 * Ideogrammar extensions:
 *   {[time=night] neon|[time!=night] sun}   option guards (also at the start
 *                                           of a list line). Ops: = != ~ (contains);
 *                                           a=x,y means "x or y"; join conditions with &.
 *                                           A guard key is a variable name or a list name
 *                                           (true when something picked from that list matches).
 *   {40%? wearing a cap}                    40% chance, otherwise nothing
 *   rules: [{when:{var|list, is:[…], isNot:[…]}, then:{list, exclude:[…]|only:[…]|force:"x"}}]
 *          patterns are case-insensitive; * is a wildcard ("*neon*").
 *   list options: {unique:true} never repeats an item within one roll.
 *
 * Determinism: every choice point ("slot") has a stable id made from the field
 * path and its position in the source. Its random numbers come from
 * hash(seed, slotId, salt), so locking one slot or re-salting one slot leaves
 * every other pick unchanged.
 */
(function (root) {
  "use strict";

  const MAX_DEPTH = 24;

  // ---------------------------------------------------------------- random
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function slotRng(seed, id, salt) { return mulberry32(hashStr(String(seed) + "|" + id + "|" + (salt || 0))); }
  // salts[id] re-rolls one pick; salts["@" + fieldPath] re-rolls every pick in one field.
  function rngFor(ctx, id) { return slotRng(ctx.seed, id, (ctx.salts[id] || 0) + "/" + (ctx.fieldSalt || 0)); }
  function newSeed() { return Math.floor(Math.random() * 4294967296); }

  // ---------------------------------------------------------------- parser
  const ESCAPABLE = "{}|$_\\[]:%";
  const RE_CHANCE = /\s*(\d+(?:\.\d+)?)%\?\s*/y;
  const RE_COUNT = /\s*(\d*)\s*(?:(-)\s*(\d*))?\s*\$\$/y;
  const RE_WEIGHT = /\s*(\d+(?:\.\d+)?)::/y;
  const RE_GUARD = /\s*\[([^\]]*)\]\s*/y;
  const RE_GUARD_BODY = /^\s*[\w.\-\/]+\s*(!=|=|~)/;
  const RE_WILD = /__((?:\$\{[^{}]*\}|[A-Za-z0-9\-\/*.]|_(?!_))+)__/y;
  const RE_VARNAME = /\s*([A-Za-z_][\w.\-]*)\s*/y;

  function sticky(re, p) { re.lastIndex = p.i; const m = re.exec(p.s); if (m) p.i = re.lastIndex; return m; }

  function parse(src) {
    const p = { s: String(src == null ? "" : src), i: 0 };
    const out = [];
    while (p.i < p.s.length) {
      out.push(...parseSeq(p, ""));
      if (p.i < p.s.length) { out.push({ t: "text", v: p.s[p.i] }); p.i++; } // stray } or |
    }
    return mergeText(out);
  }
  function mergeText(nodes) {
    const out = [];
    for (const n of nodes) {
      const last = out[out.length - 1];
      if (n.t === "text" && last && last.t === "text") last.v += n.v; else out.push(n);
    }
    return out;
  }

  function parseSeq(p, stops) {
    const nodes = []; let buf = "";
    const flush = () => { if (buf) { nodes.push({ t: "text", v: buf }); buf = ""; } };
    while (p.i < p.s.length) {
      const c = p.s[p.i];
      if (stops && stops.includes(c)) break;
      if (c === "\\" && p.i + 1 < p.s.length && ESCAPABLE.includes(p.s[p.i + 1])) { buf += p.s[p.i + 1]; p.i += 2; continue; }
      if (c === "{") { flush(); nodes.push(parseVariant(p)); continue; }
      if (c === "$" && p.s[p.i + 1] === "{") { flush(); nodes.push(parseVar(p)); continue; }
      if (c === "_" && p.s[p.i + 1] === "_") {
        RE_WILD.lastIndex = p.i; const m = RE_WILD.exec(p.s);
        if (m) { flush(); nodes.push({ t: "wild", name: m[1], src: m[0] }); p.i = RE_WILD.lastIndex; continue; }
      }
      buf += c; p.i++;
    }
    flush();
    return mergeText(nodes);
  }

  // find "$$" before the first top-level | or } (custom separator)
  function findSep(p) {
    let depth = 0;
    for (let k = p.i; k < p.s.length; k++) {
      const c = p.s[k];
      if (c === "\\") { k++; continue; }
      if (c === "{") depth++;
      else if (c === "}") { if (depth === 0) return -1; depth--; }
      else if (c === "|" && depth === 0) return -1;
      else if (c === "$" && p.s[k + 1] === "$" && depth === 0) return k;
    }
    return -1;
  }

  function parseGuard(body) {
    const conds = [];
    for (const part of body.split("&")) {
      const m = /^\s*([\w.\-\/]+)\s*(!=|=|~)\s*(.*?)\s*$/.exec(part);
      if (!m) return null;
      conds.push({ key: m[1], op: m[2], vals: m[3].split(",").map(v => v.trim()).filter(Boolean) });
    }
    return conds.length ? conds : null;
  }

  function parseOptionPrefix(p) {
    let w = null, guard = null;
    for (;;) {
      const save = p.i;
      const mw = sticky(RE_WEIGHT, p);
      if (mw) { w = parseFloat(mw[1]); continue; }
      const mg = sticky(RE_GUARD, p);
      if (mg && RE_GUARD_BODY.test(mg[1])) { const g = parseGuard(mg[1]); if (g) { guard = (guard || []).concat(g); continue; } }
      p.i = save; break;
    }
    return { w, guard };
  }

  function parseVariant(p) {
    const start = p.i; p.i++; // past {
    const fail = () => { p.i = start + 1; return { t: "text", v: "{" }; };
    // {40%? body}
    const mc = sticky(RE_CHANCE, p);
    if (mc) {
      const body = parseSeq(p, "}");
      if (p.s[p.i] !== "}") return fail();
      p.i++;
      const pr = Math.max(0, Math.min(100, parseFloat(mc[1]))) / 100;
      return { t: "variant", min: 1, max: 1, sep: ", ", src: p.s.slice(start, p.i), chance: true,
        opts: [{ w: pr, guard: null, body }, { w: 1 - pr, guard: null, body: [] }] };
    }
    let min = 1, max = 1, counted = false, sep = ", ";
    const save = p.i;
    const mn = sticky(RE_COUNT, p);
    if (mn && (mn[1] || mn[2])) {
      counted = true;
      if (mn[2]) { min = mn[1] ? +mn[1] : 1; max = mn[3] ? +mn[3] : Infinity; }
      else { min = max = +mn[1]; }
      if (max < min) max = min;
      const k = findSep(p);
      if (k >= 0) { sep = p.s.slice(p.i, k); p.i = k + 2; }
    } else p.i = save;
    const opts = [];
    for (;;) {
      const { w, guard } = parseOptionPrefix(p);
      const body = parseSeq(p, "|}");
      opts.push({ w: w == null ? 1 : w, guard, body });
      if (p.s[p.i] === "|") { p.i++; continue; }
      if (p.s[p.i] === "}") { p.i++; break; }
      return fail(); // unterminated: treat "{" as literal
    }
    return { t: "variant", min, max, sep, counted, opts, src: p.s.slice(start, p.i) };
  }

  function parseVar(p) {
    const start = p.i; p.i += 2;
    const fail = () => { p.i = start + 1; return { t: "text", v: "$" }; };
    const mn = sticky(RE_VARNAME, p);
    if (!mn) return fail();
    const name = mn[1];
    const c = p.s[p.i];
    if (c === "=") {
      p.i++;
      let immediate = false;
      if (p.s[p.i] === "!") { immediate = true; p.i++; }
      const body = parseSeq(p, "}");
      if (p.s[p.i] !== "}") return fail();
      p.i++;
      return { t: "setvar", name, immediate, body, src: p.s.slice(start, p.i) };
    }
    if (c === ":") {
      p.i++;
      const def = parseSeq(p, "}");
      if (p.s[p.i] !== "}") return fail();
      p.i++;
      return { t: "getvar", name, def, src: p.s.slice(start, p.i) };
    }
    if (c === "}") { p.i++; return { t: "getvar", name, def: null, src: p.s.slice(start, p.i) }; }
    return fail();
  }

  const _astCache = new Map();
  function parseCached(s) {
    let a = _astCache.get(s);
    if (!a) { a = parse(s); if (_astCache.size > 5000) _astCache.clear(); _astCache.set(s, a); }
    return a;
  }

  function hasSyntax(text) {
    if (!text || !/[{}\\]|__|\$\{/.test(text)) return false;
    const a = parseCached(String(text));
    return a.some(n => n.t !== "text") || (a.length === 1 && a[0].v !== String(text));
  }

  // ---------------------------------------------------------------- lists
  function normName(n) {
    return String(n || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\.(txt|ya?ml|json)$/i, "").toLowerCase();
  }

  function parseListLine(line, defW) {
    const p = { s: line, i: 0 };
    const { w, guard } = parseOptionPrefix(p);
    return { text: p.s.slice(p.i).trim(), w: w == null ? defW : w, guard };
  }

  // Text of a wildcard file -> items. Blank lines and lines starting with # are skipped.
  function parseList(txt, defW) {
    const dw = defW == null ? 1 : defW;
    const items = [];
    for (const raw of String(txt || "").split(/\r?\n/)) {
      const t = raw.trim();
      if (!t || t.startsWith("#")) continue;
      const it = parseListLine(t, dw);
      if (it.text || it.guard) items.push(it);
    }
    return items;
  }

  // YAML/JSON pack object -> { "path/name": ["item", …] }
  function parsePack(obj, prefix) {
    const out = {};
    const walk = (v, path) => {
      if (Array.isArray(v)) {
        const flat = [];
        for (const x of v) {
          if (x != null && typeof x === "object" && !Array.isArray(x)) walk(x, path); // list of maps
          else if (x != null) flat.push(String(x));
        }
        if (flat.length) out[path] = (out[path] || []).concat(flat);
      } else if (v != null && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) walk(x, path ? path + "/" + k : k);
      } else if (v != null && path) {
        out[path] = (out[path] || []).concat([String(v)]);
      }
    };
    walk(obj, prefix || "");
    return out;
  }

  // Accepts { name: "text" | ["items"] | {text, opts:{unique, weight}} }
  function normLists(raw) {
    if (raw && raw.__normalized) return raw;
    const out = Object.create(null);
    for (const [name, val] of Object.entries(raw || {})) {
      let text = val, opts = {};
      if (val && typeof val === "object" && !Array.isArray(val)) { text = val.text != null ? val.text : val.items; opts = val.opts || {}; }
      const dw = opts.weight != null && opts.weight !== "" ? +opts.weight : 1;
      const items = Array.isArray(text) ? text.map(t => parseListLine(String(t), dw)).filter(i => i.text || i.guard) : parseList(text, dw);
      const key = normName(name);
      if (!key) continue;
      out[key] = { items, unique: !!opts.unique };
    }
    Object.defineProperty(out, "__normalized", { value: true });
    return out;
  }

  function globRe(g) {
    const esc = g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
    return new RegExp("^" + esc + "$");
  }

  // -> { found, items:[{text,w,guard,list}], lists:[names] }
  function lookup(lists, name) {
    const n = normName(name);
    const keys = Object.keys(lists);
    let names = [];
    if (n.includes("*")) { const re = globRe(n); names = keys.filter(k => re.test(k)).sort(); }
    else if (lists[n]) names = [n];
    else names = keys.filter(k => k.endsWith("/" + n)).sort();
    const items = [];
    for (const k of names) for (const it of lists[k].items) items.push(Object.assign({ list: k }, it));
    return { found: names.length > 0, items, lists: names };
  }

  // ---------------------------------------------------------------- matching
  function patMatch(text, pat) {
    const t = String(text).trim().toLowerCase(), p = String(pat).trim().toLowerCase();
    if (!p) return false;
    if (p.includes("*")) return globRe(p.replace(/\//g, "\u0001")).test(t.replace(/\//g, "\u0001"));
    return t === p;
  }
  const matchAny = (text, pats) => (pats || []).some(p => patMatch(text, p));

  function valuesFor(ctx, key) {
    const k = String(key);
    if (Object.prototype.hasOwnProperty.call(ctx.vars, k)) return [ctx.vars[k]];
    const nk = normName(k);
    if (ctx.picked[nk]) return ctx.picked[nk];
    // suffix match for list names (hats -> clothes/hats)
    const hit = Object.keys(ctx.picked).filter(p => p.endsWith("/" + nk));
    return hit.length ? [].concat(...hit.map(h => ctx.picked[h])) : [];
  }

  function guardHolds(guard, ctx) {
    if (!guard) return true;
    for (const c of guard) {
      const vals = valuesFor(ctx, c.key).map(v => String(v).toLowerCase());
      const want = c.vals.map(v => v.toLowerCase());
      let ok;
      if (c.op === "~") ok = vals.some(v => want.some(w => v.includes(w)));
      else {
        const hit = vals.some(v => want.some(w => w.includes("*") ? patMatch(v, w) : v === w));
        ok = c.op === "=" ? hit : !hit;
      }
      if (!ok) return false;
    }
    return true;
  }

  function whenHolds(when, ctx) {
    if (!when) return true;
    if (Array.isArray(when)) return when.every(w => whenHolds(w, ctx));
    const key = when.var != null && when.var !== "" ? when.var : when.list;
    if (key == null || key === "") return true;
    const vals = when.var != null && when.var !== ""
      ? (Object.prototype.hasOwnProperty.call(ctx.vars, when.var) ? [ctx.vars[when.var]] : [])
      : valuesFor(ctx, when.list);
    const is = toArr(when.is), isNot = toArr(when.isNot);
    if (is.length && !vals.some(v => matchAny(v, is))) return false;
    if (isNot.length && vals.some(v => matchAny(v, isNot))) return false;
    if (!is.length && !isNot.length && !vals.length) return false; // "when list was picked at all"
    return true;
  }
  function toArr(x) { return x == null || x === "" ? [] : Array.isArray(x) ? x : String(x).split(",").map(s => s.trim()).filter(Boolean); }

  function listMatches(ruleList, itemList) {
    const r = normName(ruleList), l = normName(itemList);
    if (!r) return false;
    if (r.includes("*")) return globRe(r).test(l);
    return l === r || l.endsWith("/" + r);
  }

  // apply rules to candidate items drawn from lists
  function applyRules(items, ctx) {
    let out = items;
    for (const rule of ctx.rules) {
      if (!rule || rule.enabled === false || !rule.then || !rule.then.list) continue;
      if (!out.some(it => it.list && listMatches(rule.then.list, it.list))) continue;
      if (!whenHolds(rule.when, ctx)) continue;
      const th = rule.then, applies = it => it.list && listMatches(th.list, it.list);
      if (th.force != null && th.force !== "") {
        const forced = toArr(th.force);
        const kept = out.filter(it => !applies(it) || matchAny(it.text, forced));
        out = kept.some(applies) ? kept : out.filter(it => !applies(it)).concat(forced.map(f => ({ text: f, w: 1, guard: null, list: normName(th.list) })));
        continue;
      }
      const ex = toArr(th.exclude), only = toArr(th.only);
      if (ex.length) out = out.filter(it => !applies(it) || !matchAny(it.text, ex));
      if (only.length) out = out.filter(it => !applies(it) || matchAny(it.text, only));
    }
    return out;
  }

  // ---------------------------------------------------------------- resolver
  function pickWeighted(cands, n, rng) {
    const pool = cands.slice(), out = [];
    while (out.length < n && pool.length) {
      let total = 0;
      for (const c of pool) total += Math.max(0, c.w);
      let idx = 0;
      if (total <= 0) idx = Math.floor(rng() * pool.length);
      else {
        let r = rng() * total;
        for (idx = 0; idx < pool.length - 1; idx++) { r -= Math.max(0, pool[idx].w); if (r < 0) break; }
      }
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }

  function interpName(name, ctx, path) {
    if (!name.includes("${")) return name;
    return name.replace(/\$\{([A-Za-z_][\w.\-]*)\}/g, (_, v) => {
      if (ctx.varDefs[v]) return evalVarDef(v, ctx, path);
      return ctx.vars[v] != null ? ctx.vars[v] : "";
    });
  }

  function evalVarDef(name, ctx, path) {
    const d = ctx.varDefs[name];
    const v = clean(evalSeq(d.body, d.path + "@" + path, ctx));
    ctx.vars[name] = v;
    return v;
  }

  function recordPick(ctx, listName, value) {
    if (!listName) return;
    (ctx.picked[listName] = ctx.picked[listName] || []).push(value);
  }

  function evalSeq(nodes, path, ctx) {
    let s = "";
    for (let i = 0; i < nodes.length; i++) s += evalNode(nodes[i], path + "." + i, ctx);
    return s;
  }

  function evalNode(n, path, ctx) {
    switch (n.t) {
      case "text": return n.v;
      case "setvar":
        if (n.immediate) {
          delete ctx.varDefs[n.name];
          ctx.vars[n.name] = clean(evalSeq(n.body, path + "=", ctx));
        } else {
          ctx.varDefs[n.name] = { body: n.body, path };
          delete ctx.vars[n.name];
        }
        return "";
      case "getvar":
        if (ctx.varDefs[n.name]) return evalVarDef(n.name, ctx, path);
        if (Object.prototype.hasOwnProperty.call(ctx.vars, n.name)) return ctx.vars[n.name];
        if (n.def) return evalSeq(n.def, path + ":", ctx);
        ctx.errors.push("Variable ${" + n.name + "} is not set");
        return "";
      case "wild": return evalWild(n, path, ctx);
      case "variant": return evalVariant(n, path, ctx);
    }
    return "";
  }

  function enter(ctx) {
    if (ctx.depth >= MAX_DEPTH) { ctx.errors.push("Wildcards nested too deeply (a list probably refers to itself)"); return false; }
    ctx.depth++; return true;
  }

  function lockedValue(ctx, id, n, kind) {
    if (!Object.prototype.hasOwnProperty.call(ctx.locks, id)) return null;
    const v = String(ctx.locks[id]);
    ctx.trace.push({ id, kind, token: n.src, list: n.t === "wild" ? normName(n.name) : undefined, value: v, locked: true, depth: ctx.depth });
    return v;
  }

  function filterItems(items, ctx, listUnique) {
    let c = items.filter(it => guardHolds(it.guard, ctx));
    c = applyRules(c, ctx);
    if (listUnique) {
      const fresh = c.filter(it => !(ctx.used[it.list] && ctx.used[it.list].has(it.text)));
      if (fresh.length) c = fresh;
    }
    return c;
  }

  function evalItem(it, id, ctx) {
    if (!enter(ctx)) return "";
    const v = clean(evalSeq(parseCached(it.text), id + ">", ctx));
    ctx.depth--;
    if (it.list) { (ctx.used[it.list] = ctx.used[it.list] || new Set()).add(it.text); recordPick(ctx, it.list, v); }
    return v;
  }

  function evalWild(n, path, ctx) {
    const id = path;
    const name = interpName(n.name, ctx, path);
    const lv = lockedValue(ctx, id, n, "wild");
    if (lv != null) { for (const l of lookup(ctx.lists, name).lists.slice(0, 1)) recordPick(ctx, l, lv); return lv; }
    const lk = lookup(ctx.lists, name);
    if (!lk.found) { ctx.errors.push("No wildcard list called \"" + name + "\""); return n.src; }
    const unique = lk.lists.some(l => ctx.lists[l].unique);
    const cands = filterItems(lk.items, ctx, unique);
    if (!cands.length) { ctx.errors.push("Nothing left to pick from \"" + name + "\" after rules"); return ""; }
    const rng = rngFor(ctx, id);
    const [it] = pickWeighted(cands, 1, rng);
    const traceAt = ctx.trace.length;
    const v = evalItem(it, id, ctx);
    ctx.trace.splice(traceAt, 0, { id, kind: "wild", token: n.src, list: it.list, value: v, depth: ctx.depth });
    return v;
  }

  function evalVariant(n, path, ctx) {
    const id = path;
    const lv = lockedValue(ctx, id, n, "variant");
    if (lv != null) return lv;
    // {2$$__list__}: options come from the list
    let cands, fromList = false, unique = false;
    const only = n.opts.length === 1 && n.opts[0].body.length === 1 && n.opts[0].body[0].t === "wild" ? n.opts[0].body[0] : null;
    if (only && n.counted) {
      const lk = lookup(ctx.lists, interpName(only.name, ctx, path));
      if (!lk.found) { ctx.errors.push("No wildcard list called \"" + only.name + "\""); return n.src; }
      unique = lk.lists.some(l => ctx.lists[l].unique);
      cands = filterItems(lk.items, ctx, unique).map((it, k) => Object.assign({ k }, it));
      fromList = true;
    } else {
      cands = n.opts.map((o, k) => ({ k, w: o.w, guard: o.guard, body: o.body })).filter(o => guardHolds(o.guard, ctx));
    }
    if (!cands.length) return "";
    const rng = rngFor(ctx, id);
    const max = Math.min(n.max, cands.length), min = Math.min(n.min, max);
    const count = min + Math.floor(rng() * (max - min + 1));
    const picks = pickWeighted(cands, count, rng);
    if (!enter(ctx)) return "";
    const traceAt = ctx.trace.length;
    const parts = picks.map(o => fromList ? evalItem(o, id + "|" + o.k, ctx) : clean(evalSeq(o.body, id + "|" + o.k, ctx))).filter(s => s !== "");
    ctx.depth--;
    const v = parts.join(n.sep);
    ctx.trace.splice(traceAt, 0, { id, kind: "variant", token: n.src, value: v, depth: ctx.depth, list: fromList ? normName(only.name) : undefined });
    return v;
  }

  function clean(s) {
    return String(s)
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+,/g, ",")
      .replace(/,(\s*,)+/g, ",")
      .replace(/^[\s,]+|[\s,]+$/g, "");
  }

  function makeCtx(o) {
    o = o || {};
    return {
      lists: normLists(o.lists),
      rules: o.rules || [],
      vars: Object.assign({}, o.vars || {}),
      varDefs: {},
      seed: o.seed != null ? o.seed : 0,
      locks: o.locks || {},
      salts: o.salts || {},
      trace: [], errors: [], picked: {}, used: {}, depth: 0,
    };
  }

  // Resolve several fields with shared variables, rules and picks.
  // fields: [{path, text}] in the order they should be rolled.
  // opts.varDefs: {name: "source"} template variables, evaluated first (immediately).
  function resolveFields(fields, opts) {
    const ctx = makeCtx(opts);
    for (const [name, src] of Object.entries((opts && opts.varDefs) || {})) {
      ctx.fieldSalt = ctx.salts["@var:" + name] || 0;
      ctx.vars[name] = clean(evalSeq(parseCached(String(src)), "var:" + name, ctx));
    }
    const values = {};
    for (const f of fields || []) {
      const txt = String(f.text == null ? "" : f.text);
      ctx.fieldSalt = ctx.salts["@" + f.path] || 0;
      values[f.path] = hasSyntax(txt) ? clean(evalSeq(parseCached(txt), f.path, ctx)) : txt;
    }
    return { values, trace: ctx.trace, vars: ctx.vars, errors: Array.from(new Set(ctx.errors)), picked: ctx.picked };
  }

  function resolve(text, opts) {
    const path = (opts && opts.path) || "t";
    const r = resolveFields([{ path, text }], opts);
    return { text: r.values[path], trace: r.trace, vars: r.vars, errors: r.errors, picked: r.picked };
  }

  // Names of lists a text refers to (for "missing list" checks in the UI).
  function listRefs(text) {
    const out = new Set();
    const walk = nodes => {
      for (const n of nodes) {
        if (n.t === "wild") out.add(n.name);
        else if (n.t === "variant") n.opts.forEach(o => walk(o.body));
        else if (n.t === "setvar") walk(n.body);
        else if (n.t === "getvar" && n.def) walk(n.def);
      }
    };
    walk(parseCached(String(text || "")));
    return Array.from(out);
  }

  const WC = {
    parse, parseList, parsePack, normLists, normName, lookup, hasSyntax, listRefs,
    resolve, resolveFields, newSeed, hashStr, slotRng, MAX_DEPTH,
  };
  root.WC = WC;
  if (typeof module !== "undefined" && module.exports) module.exports = WC;
})(typeof window !== "undefined" ? window : globalThis);
