import fs from "node:fs";
import path from "node:path";

export const SECTIONS = ["uncontested", "contested", "defense"];
export const AGREEMENTS = {
  0: "No special agreement",
  1: "To play",
  2: "Non-forcing",
  3: "Constructive",
  4: "Invitational",
  5: "Forcing",
  6: "Game forcing",
  7: "Slam try",
  8: "Control bid",
  9: "Preemptive",
  A: "Transfer",
  B: "Puppet",
  C: "Relay",
  D: "Asking bid",
  E: "Asking response",
};
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function legacyId(id) {
  return `10000000-0000-4000-8000-${id.toString(16).padStart(12, "0")}`;
}
export function callName(call) {
  return call === "P"
    ? "Pass"
    : call === "X"
      ? "Double"
      : call === "XX"
        ? "Redouble"
        : call
            .replace("C", "♣")
            .replace("D", "♦")
            .replace("H", "♥")
            .replace("S", "♠");
}
export function normalizeCall(call) {
  return call
    .toUpperCase()
    .replace(/^PASS$/, "P")
    .replace(/^DOUBLE$/, "X")
    .replace(/^REDOUBLE$/, "XX")
    .replace(/^D$/, "X")
    .replace(/^R$/, "XX")
    .replace(/([1-7])N$/, "$1NT");
}
export function parseAuction(value, section) {
  if (typeof value !== "string" || !value.trim())
    throw Error("Enter an auction.");
  if (!SECTIONS.includes(section))
    throw Error("Choose Uncontested, Contested, or Defense.");
  const words = value
    .trim()
    .toUpperCase()
    .replaceAll("♣", "C")
    .replaceAll("♦", "D")
    .replaceAll("♥", "H")
    .replaceAll("♠", "S")
    .replace(/[()]/g, "")
    .split(/[\s–—-]+/)
    .filter(Boolean)
    .map(normalizeCall);
  if (words.some((x) => !/^(?:[1-7](?:C|D|H|S|NT)|P|X|XX)$/.test(x)))
    throw Error(`Invalid call in ${value}. Use C, D, H, S, NT, P, X, or XX.`);
  if (!/^[1-7]/.test(words[0]))
    throw Error("Start the auction with an opening bid.");
  if (section === "uncontested" && words.some((x) => x === "X" || x === "XX"))
    throw Error("Use Contested for an auction with a double or redouble.");
  const calls =
    section === "uncontested"
      ? words.flatMap((x, i) => (i ? ["P", x] : [x]))
      : words;
  return { auction: words.join("-"), calls };
}
export function rank(call) {
  if (call === "P") return 0;
  if (call === "X") return 1;
  if (call === "XX") return 2;
  return (
    3 +
    (Number(call[0]) - 1) * 5 +
    ["C", "D", "H", "S", "NT"].indexOf(call.slice(1))
  );
}
export function compareCalls(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const diff = rank(a[i]) - rank(b[i]);
    if (diff) return diff;
  }
  return a.length - b.length;
}
export function checkLegal(calls) {
  let last = -1,
    contractSide = -1,
    doubled = 0,
    passes = 0;
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    if (passes >= 3) throw Error("The auction continues after three passes.");
    if (c === "P") {
      passes++;
      continue;
    }
    passes = 0;
    if (c === "X") {
      if (last < 0 || doubled !== 0 || i % 2 === contractSide)
        throw Error(
          "A double must be made by the opponents of the last contract bid.",
        );
      doubled = 1;
    } else if (c === "XX") {
      if (doubled !== 1 || i % 2 !== contractSide)
        throw Error("A redouble must follow an opposing double.");
      doubled = 2;
    } else {
      const n = rank(c);
      if (n <= last)
        throw Error(
          "A contract bid must be higher than the previous contract bid.",
        );
      last = n;
      contractSide = i % 2;
      doubled = 0;
    }
  }
}
export function filename(node) {
  return `${node.section}--${node.auction.toLowerCase()}.json`;
}
export function readEntries(root) {
  const folder = path.join(root, "content/bidding");
  return fs
    .readdirSync(folder)
    .filter((x) => x.endsWith(".json"))
    .map((file) => {
      try {
        return {
          file,
          data: JSON.parse(fs.readFileSync(path.join(folder, file), "utf8")),
        };
      } catch (e) {
        throw Error(`${file}: ${e.message}`);
      }
    });
}
export function compile(entries, baseline = []) {
  const ids = new Set(),
    paths = new Map(),
    legacy = new Set();
  const original = new Map(baseline.map((r) => [r.id, r]));
  const nodes = entries.map(({ file, data }) => {
    const n = structuredClone(data);
    try {
      const allowed = [
        "id",
        "section",
        "auction",
        "meaning",
        "notes",
        "artificial",
        "forcing",
        "minLength",
        "maxLength",
        "order",
        "parentId",
        "opening",
        "fullAuction",
        "source",
        "meaningUpdatedAt",
      ];
      if (Object.keys(n).some((k) => !allowed.includes(k)))
        throw Error(
          "An unknown field needs a matching CMS schema before it can be published.",
        );
      if (!UUID.test(n.id) || ids.has(n.id))
        throw Error("The entry ID is missing, invalid, or duplicated.");
      ids.add(n.id);
      const parsed = parseAuction(n.auction, n.section);
      n.auction = parsed.auction;
      n.calls = parsed.calls;
      // Blank meanings are intentional and supported. Pages CMS omits empty strings.
      n.meaning ??= "";
      n.notes ??= "";
      if (
        typeof n.meaning !== "string" ||
        n.meaning.length > 50000 ||
        typeof n.notes !== "string"
      )
        throw Error("Meaning and notes must be plain text.");
      if (n.artificial === undefined) n.artificial = false;
      if (typeof n.artificial !== "boolean")
        throw Error("Artificial must be true or false.");
      n.forcing ??= "0";
      if (typeof n.forcing !== "string" || !/^[0-9A-Z]$/.test(n.forcing))
        throw Error("The forcing status is invalid.");
      n.minLength =
        n.minLength === "" || n.minLength === undefined
          ? 0
          : Number(n.minLength);
      n.maxLength =
        n.maxLength === "" || n.maxLength === undefined
          ? 8
          : Number(n.maxLength);
      if (
        !Number.isInteger(n.minLength) ||
        !Number.isInteger(n.maxLength) ||
        n.minLength < 0 ||
        n.minLength > 8 ||
        n.maxLength < 0 ||
        n.maxLength > 8 ||
        (n.maxLength < 8 && n.minLength > n.maxLength)
      )
        throw Error("The suit length is invalid.");
      n.they = n.section === "defense";
      const contested = n.calls.some((c, i) => i % 2 === 1 && c !== "P");
      if (n.section === "contested" && !contested)
        throw Error("Use Uncontested when all opponent calls are passes.");
      const key = `${n.they ? "them" : "us"}:${n.calls.join("-")}`;
      if (paths.has(key))
        throw Error(`The auction duplicates ${paths.get(key)}.`);
      paths.set(key, file);
      if (n.source?.legacyId !== undefined) {
        n.source.originalMeaning ??= "";
        const r = original.get(n.source.legacyId);
        if (!r || legacy.has(r.id))
          throw Error("The original BSS record link is invalid or duplicated.");
        legacy.add(r.id);
        if (
          n.id !== legacyId(r.id) ||
          n.they !== r.they ||
          n.calls.join(" ") !== r.tokens.map(normalizeCall).join(" ")
        )
          throw Error(
            "Keep the original auction unchanged. Use New entry to add a branch.",
          );
        if (
          n.source.originalMeaning !== (r.sourceDesc ?? r.desc ?? "") ||
          n.source.bssLine !== r.line ||
          n.source.bssPrefix !== r.bssPrefix
        )
          throw Error("The protected BSS source text changed.");
      } else {
        delete n.source;
        checkLegal(n.calls);
      }
      n.opening = n.calls[0];
      n.fullAuction = n.calls
        .map((c, i) =>
          (i % 2 === 0) !== n.they ? callName(c) : `(${callName(c)})`,
        )
        .join(" – ");
      n.file = filename(n);
      return n;
    } catch (e) {
      throw Error(`${file}: ${e.message}`);
    }
  });
  for (const r of baseline)
    if (!legacy.has(r.id))
      throw Error(
        `Original auction ${r.pathPretty} is missing. Restore it before publishing.`,
      );
  const byPath = new Map(
    nodes.map((n) => [`${n.they}:${n.calls.join(" ")}`, n]),
  );
  for (const n of nodes) {
    let parent = null;
    for (let length = n.calls.length - 1; length > 0; length--) {
      parent = byPath.get(`${n.they}:${n.calls.slice(0, length).join(" ")}`);
      if (parent) break;
    }
    n.parentId = parent?.id ?? null;
    // Defense can start at our response to an opponent opening without a root definition.
    if (!parent && n.calls.length > 1 && n.section !== "defense")
      throw Error(`${n.file}: Add the opening or parent auction first.`);
  }
  nodes.sort(
    (a, b) => Number(a.they) - Number(b.they) || compareCalls(a.calls, b.calls),
  );
  nodes.forEach((n, i) => (n.order = i + 1));
  return nodes;
}
export function sourceEntry(n) {
  const x = structuredClone(n);
  for (const k of ["calls", "they", "file"]) delete x[k];
  return x;
}
export function publicEntry(n) {
  return {
    id: n.id,
    parentId: n.parentId,
    order: n.order,
    section: n.section,
    auction: n.auction,
    fullAuction: n.fullAuction,
    opening: n.opening,
    calls: n.calls,
    they: n.they,
    meaning: n.meaning,
    notes: n.notes,
    artificial: n.artificial,
    forcing: n.forcing,
    minLength: n.minLength,
    maxLength: n.maxLength,
    source: n.source
      ? { originalMeaning: n.source.originalMeaning, bssLine: n.source.bssLine }
      : null,
  };
}
