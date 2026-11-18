// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const WC = require("../wildcards.js");

const lists = {
  colours: "red\nblue\ngreen\n# comment\n\nyellow",
  "clothes/hats": "cap\nbeanie\nfedora",
  "clothes/shoes": "boots\nsneakers",
  weighted: "100::common\n0.0001::rare",
  nested: "a __colours__ hat",
  loop: "__loop__",
  time: "day\nnight",
  lights: "[time=night] neon\n[time=night] streetlight\n[time!=night] sunlight",
  uniq: { text: "x\ny\nz", opts: { unique: true } },
};
const R = (t, o = {}) => WC.resolve(t, { lists, seed: 1, ...o });
const COL = ["red", "blue", "green", "yellow"];

test("plain text passes through untouched", () => {
  assert.equal(R("a plain {not closed").text, "a plain {not closed");
  assert.equal(R("just words").text, "just words");
  assert.equal(WC.hasSyntax("just words"), false);
  assert.equal(WC.hasSyntax("a __colours__"), true);
  assert.equal(WC.hasSyntax("{a|b}"), true);
});

test("variants and escapes", () => {
  for (let s = 0; s < 30; s++) assert.ok(["a", "b", "c"].includes(R("{a|b|c}", { seed: s }).text));
  assert.equal(R("\\{a|b\\}").text, "{a|b}");
  assert.equal(R("{only}").text, "only");
});

test("pick N distinct, ranges, custom separator", () => {
  for (let s = 0; s < 40; s++) {
    const parts = R("{2$$a|b|c|d}", { seed: s }).text.split(", ");
    assert.equal(parts.length, 2); assert.equal(new Set(parts).size, 2);
    const r = R("{1-3$$a|b|c|d}", { seed: s }).text.split(", ");
    assert.ok(r.length >= 1 && r.length <= 3);
    const all = R("{2-$$a|b|c}", { seed: s }).text.split(", ");
    assert.ok(all.length >= 2 && all.length <= 3);
    const t = R("{2$$ and $$a|b}", { seed: s }).text;
    assert.ok(t === "a and b" || t === "b and a", t);
  }
  assert.equal(R("{9$$a|b}").text.split(", ").length, 2); // capped
});

test("weights follow a statistical bound", () => {
  let a = 0;
  for (let s = 0; s < 2000; s++) if (R("{3::a|1::b}", { seed: s }).text === "a") a++;
  assert.ok(a > 1350 && a < 1650, "a=" + a); // expect 1500
  let rare = 0;
  for (let s = 0; s < 500; s++) if (R("__weighted__", { seed: s }).text === "rare") rare++;
  assert.ok(rare < 3);
});

test("wildcards, folders, suffix lookup, globs, nesting", () => {
  assert.ok(COL.includes(R("__colours__").text));
  assert.ok(["cap", "beanie", "fedora"].includes(R("__clothes/hats__").text));
  assert.ok(["cap", "beanie", "fedora"].includes(R("__hats__").text));
  const seen = new Set();
  for (let s = 0; s < 80; s++) seen.add(R("__clothes/*__", { seed: s }).text);
  assert.ok(seen.has("boots") && seen.has("cap"));
  assert.match(R("__nested__").text, /^a (red|blue|green|yellow) hat$/);
  for (let s = 0; s < 30; s++) {
    const p = R("{2$$__colours__}", { seed: s }).text.split(", ");
    assert.equal(p.length, 2); assert.notEqual(p[0], p[1]); p.forEach(x => assert.ok(COL.includes(x)));
  }
});

test("missing list and recursion limit report errors", () => {
  const m = R("a __nope__ b");
  assert.equal(m.text, "a __nope__ b");
  assert.match(m.errors[0], /nope/);
  const l = R("__loop__");
  assert.ok(l.errors.some(e => /nested too deeply/.test(e)));
});

test("same seed is deterministic, different seeds vary", () => {
  const t = "__colours__ {a|b|c|d} {2$$__clothes/*__}";
  assert.equal(R(t, { seed: 42 }).text, R(t, { seed: 42 }).text);
  const outs = new Set();
  for (let s = 0; s < 20; s++) outs.add(R(t, { seed: s }).text);
  assert.ok(outs.size > 5);
});

test("locks survive a reroll; salting one slot leaves the others", () => {
  const t = "__colours__ / __clothes/hats__ / {a|b|c|d|e|f}";
  const r1 = R(t, { seed: 7 });
  const top = r1.trace.filter(x => x.depth === 0);
  assert.equal(top.length, 3);
  const locks = { [top[0].id]: top[0].value };
  for (let s = 100; s < 120; s++) assert.ok(R(t, { seed: s, locks }).text.startsWith(top[0].value + " /"));
  // reroll only the variant via salt
  let changed = false;
  for (let k = 1; k < 20; k++) {
    const r = R(t, { seed: 7, salts: { [top[2].id]: k } });
    const [c, h] = r.text.split(" / ");
    assert.equal(c, top[0].value); assert.equal(h, top[1].value);
    if (r.text !== r1.text) changed = true;
  }
  assert.ok(changed);
});

test("variables: deferred, immediate, defaults, interpolated list names", () => {
  for (let s = 0; s < 30; s++) {
    const t = R("${c=!__colours__}${c} and ${c}", { seed: s }).text;
    const [a, b] = t.split(" and "); assert.equal(a, b);
  }
  assert.equal(R("${missing:fallback}").text, "fallback");
  assert.equal(R("${x=hello}${x} world").text, "hello world");
  assert.ok(["cap", "beanie", "fedora"].includes(R("${k=hats}__clothes/${k}__").text));
  const r = WC.resolveFields([{ path: "a", text: "${mood}" }], { lists, seed: 1, varDefs: { mood: "{calm|tense}" } });
  assert.ok(["calm", "tense"].includes(r.values.a));
  assert.equal(r.vars.mood, r.values.a);
});

test("guards on options and list lines", () => {
  for (let s = 0; s < 30; s++) {
    assert.equal(R("${time=!night}{[time=night] neon|[time!=night] sun}", { seed: s }).text, "neon");
    const v = R("${time=!day}__lights__", { seed: s }).text;
    assert.equal(v, "sunlight");
    const t = R("__time__ / __lights__", { seed: s }).text;
    const [tm, li] = t.split(" / ");
    if (tm === "night") assert.ok(["neon", "streetlight"].includes(li)); else assert.equal(li, "sunlight");
  }
  assert.equal(R("${c=!dark red}{[c~red] warm|[c!=dark red] cold}").text, "warm");
});

test("chance syntax", () => {
  let hit = 0;
  for (let s = 0; s < 1000; s++) if (R("{30%? cap}", { seed: s }).text === "cap") hit++;
  assert.ok(hit > 230 && hit < 370, "hit=" + hit);
  assert.equal(R("{0%? cap}").text, "");
  assert.equal(R("{100%? cap}").text, "cap");
});

test("rules: exclude, only, force, var conditions, cross-field", () => {
  const rules = [
    { when: { list: "colours", is: ["red"] }, then: { list: "hats", exclude: ["fedora", "beanie"] } },
    { when: { var: "sport", is: ["tennis"] }, then: { list: "shoes", only: ["sneakers"] } },
    { when: { var: "era", is: ["1920s"] }, then: { list: "hats", force: "fedora" } },
  ];
  for (let s = 0; s < 40; s++) {
    const r = WC.resolveFields([{ path: "a", text: "__colours__" }, { path: "b", text: "__hats__" }], { lists, rules, seed: s });
    if (r.values.a === "red") assert.equal(r.values.b, "cap");
    assert.equal(R("${sport=!tennis}__shoes__", { seed: s, rules }).text, "sneakers");
    assert.equal(R("${era=!1920s}__hats__", { seed: s, rules }).text, "fedora");
  }
  // glob patterns in rules
  const r2 = [{ then: { list: "colours", exclude: ["*r*"] } }];
  for (let s = 0; s < 20; s++) assert.ok(["blue", "yellow"].includes(R("__colours__", { seed: s, rules: r2 }).text));
  // nothing left
  const none = R("__colours__", { rules: [{ then: { list: "colours", only: ["purple"] } }] });
  assert.equal(none.text, ""); assert.match(none.errors[0], /Nothing left/);
});

test("unique lists never repeat within a roll", () => {
  for (let s = 0; s < 30; s++) {
    const parts = R("__uniq__ __uniq__ __uniq__", { seed: s }).text.split(" ");
    assert.equal(new Set(parts).size, 3);
  }
});

test("parseList, parsePack, normName", () => {
  const items = WC.parseList("# c\n2::a\n[x=1] b\n\n c ");
  assert.deepEqual(items.map(i => [i.text, i.w]), [["a", 2], ["b", 1], ["c", 1]]);
  assert.ok(items[1].guard);
  const pack = WC.parsePack({ clothes: { hats: ["cap", "fedora"], shoes: ["boots"] }, mood: ["calm"] });
  assert.deepEqual(Object.keys(pack).sort(), ["clothes/hats", "clothes/shoes", "mood"]);
  assert.equal(WC.normName("Clothes\\Hats.TXT"), "clothes/hats");
});

test("trace records tokens, lists and ids", () => {
  const r = R("__colours__ {a|b}");
  assert.equal(r.trace.length, 2);
  assert.equal(r.trace[0].token, "__colours__");
  assert.equal(r.trace[0].list, "colours");
  assert.equal(r.trace[1].token, "{a|b}");
  assert.notEqual(r.trace[0].id, r.trace[1].id);
});

test("listRefs finds referenced lists", () => {
  assert.deepEqual(WC.listRefs("__a__ {__b__|x} ${v=__c__}").sort(), ["a", "b", "c"]);
});

test("field salt rerolls one field and leaves the others", () => {
  const fields = [{ path: "a", text: "__colours__ {1|2|3|4|5|6}" }, { path: "b", text: "__colours__ {1|2|3|4|5|6}" }];
  const base = WC.resolveFields(fields, { lists, seed: 9 });
  let changed = false;
  for (let k = 1; k < 15; k++) {
    const r = WC.resolveFields(fields, { lists, seed: 9, salts: { "@b": k } });
    assert.equal(r.values.a, base.values.a);
    if (r.values.b !== base.values.b) changed = true;
  }
  assert.ok(changed);
});

test("single picks keep edge spaces; built-in pack resolves cleanly", () => {
  assert.equal(R("{cap, |cap, }red").text, "cap, red");
  const { WC_BUILTIN_LISTS, WC_BUILTIN_TEMPLATES } = require("../wildcards-data.js");
  const all = [];
  for (const t of WC_BUILTIN_TEMPLATES) {
    for (const part of [t.global || {}, t.element || {}, t.vars || {}]) for (const v of Object.values(part)) if (typeof v === "string") all.push(v);
  }
  for (let s = 0; s < 25; s++) for (const txt of all.concat(Object.keys(WC_BUILTIN_LISTS).map(k => "__" + k + "__"))) {
    const r = WC.resolve(txt, { lists: WC_BUILTIN_LISTS, seed: s, vars: { genre: "sports", sport: "tennis" } });
    assert.deepEqual(r.errors, [], txt + " -> " + r.errors.join("; "));
    assert.ok(!/__|\{|\}/.test(r.text), "unresolved: " + txt + " -> " + r.text);
  }
});

test("parseYaml reads Dynamic Prompts style packs", () => {
  const y = `# pack
clothes:
  hats:
    - cap   # comment
    - "red: beret"
    - 'it''s a fedora'
  shoes: [boots, "high tops"]
mood:
  - calm
  - {tense|scared}
people:
  - name: a
    role: b
note: |
  line one
  line two
`;
  const o = WC.parseYaml(y);
  assert.deepEqual(o.clothes.hats, ["cap", "red: beret", "it's a fedora"]);
  assert.deepEqual(o.clothes.shoes, ["boots", "high tops"]);
  assert.deepEqual(o.mood, ["calm", "{tense|scared}"]);
  assert.deepEqual(o.people, [{ name: "a", role: "b" }]);
  assert.equal(o.note, "line one\nline two");
  const pack = WC.parsePack(o);
  assert.deepEqual(pack["clothes/hats"].length, 3);
  assert.deepEqual(pack.mood, ["calm", "{tense|scared}"]);
});

test("sport variable drives the guarded venue and sportswear lists", () => {
  const { WC_BUILTIN_LISTS } = require("../wildcards-data.js");
  for (let s = 0; s < 30; s++) {
    const r = WC.resolveFields([{ path: "a", text: "__places/sports__ / __clothes/sportswear__" }], { lists: WC_BUILTIN_LISTS, seed: s, varDefs: { sport: "tennis" } });
    assert.match(r.values.a, /tennis.* \/ .*(tennis|polo|sweatband)/, r.values.a);
    const free = WC.resolve("__places/sports__", { lists: WC_BUILTIN_LISTS, seed: s });
    assert.deepEqual(free.errors, []); assert.ok(free.text.length > 3);
  }
});
