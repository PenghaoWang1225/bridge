import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  compile,
  readEntries,
  sourceEntry,
  publicEntry,
  SECTIONS,
} from "./bidding.mjs";
import { cmsYaml } from "./cms.mjs";
const root = path.resolve(import.meta.dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text)
    fs.writeFileSync(file, text);
}
export function validateNotebook(notebook) {
  const rules = notebook.rules ?? [];
  if (!Array.isArray(rules)) throw Error("Rules must be a list.");
  const ids = new Set();
  for (const rule of rules) {
    if (
      typeof rule.id !== "string" ||
      ids.has(rule.id) ||
      typeof rule.text !== "string" ||
      !rule.text.trim()
    )
      throw Error("A rule has an invalid ID or empty text.");
    ids.add(rule.id);
  }
  return { rules };
}
export function validateSite(site) {
  if (
    !site ||
    typeof site.title !== "string" ||
    !site.title.trim() ||
    typeof site.systemTitle !== "string" ||
    !site.systemTitle.trim()
  )
    throw Error("The site needs a homepage title and a tree title.");
  if (
    !Array.isArray(site.sections) ||
    site.sections.length !== 3 ||
    new Set(site.sections.map((s) => s.key)).size !== 3 ||
    site.sections.some(
      (s) =>
        !SECTIONS.includes(s.key) ||
        typeof s.title !== "string" ||
        !s.title.trim(),
    )
  )
    throw Error("Keep the three section keys and titles.");
  return site;
}
function document(title, body, prefix, extra = "") {
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="referrer" content="no-referrer">\n<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'">\n<title>${esc(title)}</title>\n<link rel="stylesheet" href="${prefix}style.css">${extra}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}
function nav(site, prefix) {
  return `<nav class="site-nav" aria-label="Main navigation"><a href="${prefix}">Bridge</a>${site.sections.map((s) => `<a href="${prefix}${s.key}/">${esc(s.title)}</a>`).join("")}</nav>`;
}
function footer(prefix) {
  return `<footer class="site-footer"><div class="container">Penghao Wang · Bridge notes <a href="${prefix}">Home</a></div></footer>`;
}
export function build({ sync = false } = {}) {
  const baseline = read("archive/pre-collection-records.json");
  const entries = readEntries(root),
    nodes = compile(entries, baseline);
  const notebook = validateNotebook(read("content/notebook.json")),
    site = validateSite(read("content/site.json"));
  if (sync) {
    const expected = new Map(
      nodes.map((n) => [
        n.file,
        JSON.stringify(sourceEntry(n), null, 2) + "\n",
      ]),
    );
    for (const [file, body] of expected)
      write(path.join(root, "content/bidding", file), body);
    for (const { file } of entries)
      if (!expected.has(file))
        fs.unlinkSync(path.join(root, "content/bidding", file));
  }
  write(path.join(root, ".pages.yml"), cmsYaml());
  const data = {
    version: 2,
    title: site.systemTitle,
    rules: notebook.rules,
    nodes: nodes.map(publicEntry),
  };
  const body = JSON.stringify(data) + "\n";
  const version = createHash("sha256")
    .update(body)
    .update(fs.readFileSync(path.join(root, "web/reader.js")))
    .update(fs.readFileSync(path.join(root, "web/reader.css")))
    .digest("hex")
    .slice(0, 12);
  const out = path.join(root, "site");
  fs.mkdirSync(out, { recursive: true });
  for (const file of ["style.css", "reader.css", "reader.js", "recovery.js"])
    fs.copyFileSync(path.join(root, "web", file), path.join(out, file));
  write(path.join(out, "scanian/data/bidding.json"), body);
  write(path.join(out, ".nojekyll"), "");
  const cards = site.sections
    .map(
      (s) =>
        `<article class="card"><h2><a href="${s.key}/">${esc(s.title)}</a></h2><p>${esc(s.description)}</p><a class="page-link" href="${s.key}/">Open ${esc(s.title)} →</a></article>`,
    )
    .join("\n");
  write(
    path.join(out, "index.html"),
    document(
      site.title,
      `<header class="site-header"><div class="container"><nav class="site-nav" aria-label="Main navigation"><a href="https://penghaowang1225.github.io/">Penghao Wang</a><a href="./" aria-current="page">Bridge</a></nav><h1>${esc(site.title)}</h1><p>${esc(site.description)}</p></div></header><main class="container"><section class="page-grid" aria-label="Bridge topics">${cards}</section><p class="section-note"><a href="scanian/">Open the full Scanian notebook</a></p></main>${footer("./")}`,
      "./",
    ),
  );
  for (const s of site.sections) {
    write(
      path.join(out, s.key, "index.html"),
      document(
        s.title,
        `<header class="site-header"><div class="container">${nav(site, "../")}<h1>${esc(s.title)}</h1><p>${esc(s.description)}</p></div></header><main class="container"><section class="card"><h2>${esc(site.systemTitle)}</h2><p>Read the bidding tree, meanings, and general rules.</p><a class="page-link" href="../scanian/?view=${s.key}">Open the bidding tree →</a></section></main>${footer("../")}`,
        "../",
      ),
    );
  }
  const rules = notebook.rules.map((r) => `<li>${esc(r.text)}</li>`).join("");
  const controls = `<section class="reader-controls" aria-label="Find auctions"><div class="view-tabs" role="group" aria-label="Auction section">${site.sections.map((s) => `<button data-view="${s.key}">${esc(s.title)}</button>`).join("")}<button data-view="all">All auctions</button></div><div class="search-row"><label class="sr-only" for="search">Search auctions and meanings</label><input id="search" type="search" placeholder="Search an auction or meaning, e.g. 1NT-2C-2S" autocomplete="off"><button id="clearSearch">Clear</button><button id="expandAll">Expand all</button><button id="collapseAll">Collapse all</button></div></section>`;
  const reader = `<header class="reader-header"><div class="reader-wrap">${nav(site, "../")}<h1>${esc(site.systemTitle)}</h1><p>Search auctions and meanings. Open a bid to see its continuations.</p></div></header><main class="reader-wrap"><details class="notebook" open><summary>General rules</summary><ol>${rules}</ol></details>${controls}<p id="readerStatus" role="status" aria-live="polite">Loading ${nodes.length.toLocaleString("en-US")} auctions…</p><div class="reader-layout"><aside id="openings" aria-label="Opening bids"></aside><section id="tree" aria-label="Bidding tree"></section></div><noscript><p>Enable JavaScript to use the expandable tree and search.</p></noscript></main>${footer("../")}<script type="module" src="../reader.js?v=${version}" data-source="data/bidding.json?v=${version}"></script>`;
  write(
    path.join(out, "scanian/index.html"),
    document(
      site.systemTitle,
      reader,
      "../",
      `\n<link rel="stylesheet" href="../reader.css?v=${version}">`,
    ),
  );
  const recovery = `<header class="site-header"><div class="container"><a href="../">← Bidding tree</a><h1>Recover an old browser draft</h1></div></header><main class="container"><section class="card"><p>This page can download the draft saved by the earlier editor in this browser. It does not change or remove the draft.</p><button id="recover">Download old draft</button><p id="result" role="status"></p><p>The download can be checked and imported into the current bidding JSON with the repository import tool.</p></section></main><script src="../../recovery.js"></script>`;
  write(
    path.join(out, "scanian/recovery/index.html"),
    document("Recover an old draft", recovery, "../../"),
  );
  write(
    path.join(out, "build.json"),
    JSON.stringify({
      version,
      entries: nodes.length,
      source: "content/bidding/**/*.json",
      commit: process.env.GITHUB_SHA ?? null,
    }) + "\n",
  );
  console.log(
    `Built ${nodes.length} auctions and ${notebook.rules.length} rules into site/. No partner-question section is published.`,
  );
  return { nodes, data, version };
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])
)
  build({ sync: process.argv.includes("--sync") });
