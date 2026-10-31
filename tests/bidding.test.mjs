import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  compile,
  readEntries,
  legacyId,
  parseAuction,
  compareCalls,
  checkLegal,
  sourceEntry,
  publicEntry,
  filename,
} from "../scripts/bidding.mjs";
import { cmsConfig } from "../scripts/cms.mjs";
import { validateNotebook, validateSite } from "../scripts/build.mjs";
const root = path.resolve(import.meta.dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const baseline = read("archive/pre-collection-records.json"),
  entries = readEntries(root);
const make = (auction, section = "uncontested", meaning = "Meaning") => ({
  file: `test-${randomUUID()}.json`,
  data: { id: randomUUID(), auction, section, meaning },
});

test("Current data retains every original record and has unique stable IDs and parents", () => {
  const nodes = compile(entries, baseline),
    ids = new Set(nodes.map((n) => n.id));
  assert.equal(ids.size, nodes.length);
  assert(nodes.length >= baseline.length);
  for (const old of baseline) {
    const n = nodes.find((x) => x.id === legacyId(old.id));
    assert(n);
    assert.equal(n.source.originalMeaning, old.sourceDesc ?? old.desc ?? "");
    assert.equal(
      n.fullAuction,
      old.pathPretty.replaceAll("XX", "Redouble").replaceAll("X", "Double"),
    );
  }
  for (const n of nodes) {
    if (n.parentId) {
      const p = nodes.find((x) => x.id === n.parentId);
      assert(p);
      assert(n.calls.length > p.calls.length);
      assert.deepEqual(n.calls.slice(0, p.calls.length), p.calls);
    }
  }
});

test("New branches attach to their closest parent and sort in bridge order", () => {
  const a = make("1NT"),
    b = make("1NT-2C"),
    c = make("1NT-2C-2S"),
    d = make("1NT-2C-2D"),
    e = make("1NT-2C-2H");
  const nodes = compile([c, e, a, b, d]);
  assert.deepEqual(
    nodes.map((n) => n.auction),
    ["1NT", "1NT-2C", "1NT-2C-2D", "1NT-2C-2H", "1NT-2C-2S"],
  );
  assert.equal(nodes[1].parentId, a.data.id);
  assert.equal(nodes[4].parentId, b.data.id);
  const grandchild = make("1NT-2C-2S-3C");
  assert.equal(compile([a, b, c, grandchild]).at(-1).parentId, c.data.id);
});

test("Spades precede NT, and all suit bids precede the next level", () => {
  const calls = ["2C", "1NT", "1S", "1H", "1D", "1C"];
  calls.sort((a, b) => compareCalls([a], [b]));
  assert.deepEqual(calls, ["1C", "1D", "1H", "1S", "1NT", "2C"]);
  const nodes = compile(calls.map((x) => make(x)));
  assert.deepEqual(
    nodes.map((n) => n.auction),
    calls,
  );
});

test("Opponent calls, doubles, redoubles, and defense stay explicit", () => {
  assert.deepEqual(parseAuction("1NT-2C-2S", "uncontested").calls, [
    "1NT",
    "P",
    "2C",
    "P",
    "2S",
  ]);
  assert.deepEqual(parseAuction("1nt-x-xx", "contested").calls, [
    "1NT",
    "X",
    "XX",
  ]);
  const ours = make("1NT"),
    contested = make("1NT-X-XX", "contested"),
    defense = make("1NT-X", "defense");
  const nodes = compile([defense, contested, ours]);
  assert.equal(
    nodes.find((n) => n.id === contested.data.id).parentId,
    ours.data.id,
  );
  assert.equal(nodes.find((n) => n.id === defense.data.id).parentId, null);
  assert.equal(
    nodes.find((n) => n.id === defense.data.id).fullAuction,
    "(1NT) – Double",
  );
});

test("Duplicate auctions, invalid calls, illegal bids, and missing openings fail", () => {
  assert.throws(() => compile([make("1NT"), make("1nt")]), /duplicates/);
  assert.throws(() => compile([make("1NT"), make("1NT-1S")]), /higher/);
  assert.throws(() => compile([make("1NT-2C")]), /opening or parent/);
  assert.throws(() => parseAuction("1NT-8C", "uncontested"), /Invalid call/);
  assert.throws(() => checkLegal(["1NT", "P", "X"]), /double/);
  assert.throws(() => checkLegal(["1NT", "XX"]), /redouble/);
  assert.throws(() => checkLegal(["1NT", "P", "P", "P", "2C"]), /three passes/);
});

test("Source text and original auction identity cannot be lost during a CMS save", () => {
  const copy = structuredClone(entries);
  copy[0].data.source.originalMeaning = "Changed source";
  assert.throws(() => compile(copy, baseline), /protected BSS/);
  const missing = entries.slice(1);
  assert.throws(() => compile(missing, baseline), /missing/);
  const changed = structuredClone(entries);
  changed.find((e) => e.data.section === "uncontested").data.auction = "7NT";
  assert.throws(
    () => compile(changed, baseline),
    /original auction|duplicates/,
  );
});

test("CMS may omit blank fields without removing an entry or its original description", () => {
  const copy = structuredClone(entries);
  for (const e of copy) {
    if (e.data.meaning === "") delete e.data.meaning;
    if (e.data.notes === "") delete e.data.notes;
    if (e.data.source?.originalMeaning === "")
      delete e.data.source.originalMeaning;
  }
  const actual = compile(copy, baseline),
    expected = compile(entries, baseline);
  assert.deepEqual(actual.map(publicEntry), expected.map(publicEntry));
  const blank = make("1NT");
  delete blank.data.meaning;
  assert.equal(compile([blank])[0].meaning, "");
});

test("Each file is named by its section and auction; generated fields are deterministic", () => {
  const nodes = compile(entries, baseline);
  for (const n of nodes) {
    assert.equal(n.file, filename(n));
    assert(!/^\d+\.json$/.test(n.file));
  }
  const again = compile(
    nodes.map((n) => ({ file: n.file, data: sourceEntry(n) })),
    baseline,
  );
  assert.deepEqual(again.map(sourceEntry), nodes.map(sourceEntry));
});

test("CMS supports searchable entries and creation, with no partner-question form", () => {
  const config = cmsConfig();
  assert.equal(config.content.length, 4);
  const bidding = config.content[0];
  assert.equal(bidding.type, "collection");
  assert.equal(bidding.operations.create, true);
  assert.equal(bidding.subfolders, true);
  assert.equal(bidding.view.default.sort, "order");
  assert(bidding.view.search.includes("meaning"));
  assert(bidding.view.search.includes("auction"));
  assert.equal(bidding.filename.template, "{section}--{auction}.json");
  assert(!JSON.stringify(config).includes("Partner questions"));
  const fields = new Set(bidding.fields.map((f) => f.name));
  for (const e of entries)
    for (const k of Object.keys(e.data))
      assert(fields.has(k), `CMS would omit ${k}`);
});

test("CMS folders keep bulk reads small and follow opening-bid order", () => {
  const folders = new Map();
  for (const n of compile(entries, baseline)) {
    const folder = path.posix.dirname(n.file);
    folders.set(folder, (folders.get(folder) ?? 0) + 1);
    assert.equal(publicEntry(n).editPath, `content/bidding/${n.file}`);
  }
  for (const [folder, count] of folders)
    assert(
      count <= 600,
      `${folder} has ${count} entries. Split this CMS folder before publication.`,
    );
  assert.equal(
    filename({ section: "uncontested", auction: "1NT-2C" }),
    "05-1nt/uncontested--1nt-2c.json",
  );
  assert.equal(
    filename({ section: "defense", auction: "1NT-X" }),
    "defense/05-1nt/defense--1nt-x.json",
  );
  assert(
    filename({ section: "uncontested", auction: "1S" }) <
      filename({ section: "uncontested", auction: "1NT" }),
  );
});

test("Source reads include nested folders and newly created root entries", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-folders-"));
  try {
    const folder = path.join(fixture, "content/bidding");
    fs.mkdirSync(path.join(folder, "defense/05-1nt"), { recursive: true });
    const files = ["new.json", "defense/05-1nt/defense--1nt-x.json"];
    for (const file of files)
      fs.writeFileSync(path.join(folder, file), JSON.stringify({ file }));
    assert.deepEqual(
      readEntries(fixture),
      [...files].sort().map((file) => ({ file, data: { file } })),
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("General rules can be empty; navigation keeps valid section paths", () => {
  assert.deepEqual(validateNotebook({}), { rules: [] });
  assert.throws(() => validateNotebook({ rules: [{ id: "x", text: "" }] }));
  const site = read("content/site.json");
  validateSite(site);
  site.sections[0].key = "../escape";
  assert.throws(() => validateSite(site));
});


test("Discussion flags and document references survive a CMS save", () => {
  const entry = make("1NT");
  entry.data.needsDiscussion = true;
  entry.data.reference = "Source document — example";
  const saved = sourceEntry(compile([entry])[0]);
  const shown = publicEntry(compile([{ file: entry.file, data: saved }])[0]);
  assert.equal(shown.needsDiscussion, true);
  assert.equal(shown.reference, entry.data.reference);
  entry.data.needsDiscussion = "yes";
  assert.throws(() => compile([entry]), /Needs discussion/);
  const fields = cmsConfig().content[0].fields;
  assert.equal(fields.find(f => f.name === "needsDiscussion").type, "boolean");
  assert.equal(fields.find(f => f.name === "reference").readonly, true);
});

test("Section rules accept only supported sections and preserve global rules", () => {
  const global = { id: "global", text: "Global rule." };
  const competitive = { id: "competitive", text: "Section rule.", section: "contested" };
  assert.deepEqual(validateNotebook({ rules: [global, competitive] }).rules, [global, competitive]);
  assert.throws(() => validateNotebook({ rules: [{ ...competitive, section: "unknown" }] }));
  assert.equal(filename({ section: "contested", auction: "1H-X" }), "contested/03-1h/contested--1h-x.json");
});

test("The competitive import accounts for every document table row", () => {
  const document = read("archive/competitive-method-2026-10-31/document.json");
  const report = read("archive/competitive-method-2026-10-31/import-report.json");
  const expected = document.sections.flatMap((s, i) => s.rows.map((_, j) => `${i}:${j}`));
  assert.equal(new Set(report.coverage.map(c => c.sourceRow)).size, expected.length);
  for (const key of expected) {
    const row = report.coverage.find(c => c.sourceRow === key);
    assert(row?.targets.length, `Missing source row ${key}`);
  }
});


test("Unresolved CMS shortcuts edit the original files and follow their saved flags", () => {
  const flagged = make("1NT");
  flagged.data.needsDiscussion = true;
  flagged.data.notes = "Keep this question and its notes.";
  const clear = make("1NT-2C");
  let compiled = compile([flagged, clear]);
  const config = cmsConfig(compiled);
  const group = config.content.find((entry) => entry.name === "unresolved");
  assert.equal(group.type, "group");
  assert.equal(group.items.length, 1);
  const shortcut = group.items[0];
  assert.equal(shortcut.path, publicEntry(compiled[0]).editPath);
  assert.deepEqual(shortcut.fields, config.content[0].fields);
  assert.deepEqual(shortcut.operations, { create: false, rename: false, delete: false });
  assert(shortcut.label.includes("1NT"));

  // Resolving changes only the flag. The entry, notes, and stable identity remain.
  const resolved = sourceEntry(compiled[0]);
  resolved.needsDiscussion = false;
  compiled = compile([{ file: compiled[0].file, data: resolved }, clear]);
  assert.equal(cmsConfig(compiled).content.find((entry) => entry.name === "unresolved").items.length, 0);
  assert.equal(compiled[0].id, flagged.data.id);
  assert.equal(compiled[0].notes, flagged.data.notes);
  assert.equal(compiled[0].meaning, flagged.data.meaning);

  const actual = compile(entries, baseline);
  const shortcuts = cmsConfig(actual).content.find((entry) => entry.name === "unresolved").items;
  assert.deepEqual(shortcuts.map((entry) => entry.path), actual.filter((n) => n.needsDiscussion).map((n) => publicEntry(n).editPath));
});
