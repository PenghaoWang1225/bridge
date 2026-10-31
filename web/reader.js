const $ = (id) => document.getElementById(id);
const SUIT_CLASSES = {
  "♣": "suit-clubs",
  "♦": "suit-diamonds",
  "♥": "suit-hearts",
  "♠": "suit-spades",
};
function setSuitText(node, text) {
  // Keep saved text literal. Only suit symbols get display-only spans.
  const parts = String(text ?? "").split(/([♣♦♥♠])/u);
  node.replaceChildren(...parts.map((part) => {
    const suitClass = SUIT_CLASSES[part];
    if (!suitClass) return document.createTextNode(part);
    const suit = document.createElement("span");
    suit.className = `suit ${suitClass}`;
    suit.textContent = part;
    return suit;
  }));
}
const el = (tag, text, className) => {
  const n = document.createElement(tag);
  if (text !== undefined) setSuitText(n, text);
  if (className) n.className = className;
  return n;
};
const query = new URLSearchParams(location.search);
const editorShortcuts = query.get("edit") === "1";
const readerUrl = (hash = "") =>
  `?view=${view}${editorShortcuts ? "&edit=1" : ""}${hash}`;
function editLink(n) {
  const link = el("a", "Edit in Pages CMS", "cms-edit-link");
  link.href = `https://app.pagescms.org/PenghaoWang1225/bridge/main/collection/bidding/edit/${encodeURIComponent(n.editPath)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}
let view = ["uncontested", "contested", "defense", "all"].includes(
  query.get("view"),
)
  ? query.get("view")
  : "uncontested";
let rules = [];
let nodes = [],
  byId = new Map(),
  selectedOpening = null,
  page = 0;
const PAGE_SIZE = 100;
const AGREEMENTS = {
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
const bid = (c) =>
  c === "P"
    ? "Pass"
    : c === "X"
      ? "Double"
      : c === "XX"
        ? "Redouble"
        : c
            .replace("C", "♣")
            .replace("D", "♦")
            .replace("H", "♥")
            .replace("S", "♠");
const normalize = (text) =>
  String(text)
    .toUpperCase()
    .replaceAll("♣", "C")
    .replaceAll("♦", "D")
    .replaceAll("♥", "H")
    .replaceAll("♠", "S")
    .replace(/([1-7])N(?!T)/g, "$1NT")
    .replace(/[^A-Z0-9\u4e00-\u9fff]/g, "");
const openingKey = (n) => `${n.they ? "them" : "us"}:${n.opening}`;
const direct = (n) => view === "all" || n.section === view;
const status = (text) => {
  $("readerStatus").textContent = text;
};
function openingLabel(key) {
  const [side, call] = key.split(":");
  return `${side === "them" ? "Opponent " : ""}${bid(call)}`;
}
function scope() {
  const included = new Set(nodes.filter(direct).map((n) => n.id));
  for (const id of [...included]) {
    let p = byId.get(id)?.parentId;
    while (p) {
      included.add(p);
      p = byId.get(p)?.parentId;
    }
  }
  return nodes.filter((n) => included.has(n.id));
}
function label(n) {
  const parent = byId.get(n.parentId);
  if (!parent) return n.calls.length === 1 ? bid(n.calls[0]) : n.fullAuction;
  const delta = n.calls.slice(parent.calls.length);
  const opponentAction = delta.some(
    (c, i) => ((parent.calls.length + i) % 2 === 0) === n.they && c !== "P",
  );
  if (!opponentAction && n.calls.at(-1) !== "P") return bid(n.calls.at(-1));
  return delta
    .map((c, i) =>
      ((parent.calls.length + i) % 2 === 0) !== n.they ? bid(c) : `(${bid(c)})`,
    )
    .join(" – ");
}
function badges(n) {
  const box = el("span", undefined, "badges");
  if (!direct(n)) box.append(el("span", "Context", "badge"));
  if (n.needsDiscussion) box.append(el("span", "Needs discussion", "badge discussion"));
  if (n.artificial) box.append(el("span", "Artificial", "badge artificial"));
  if (AGREEMENTS[n.forcing])
    box.append(el("span", AGREEMENTS[n.forcing], "badge"));
  const last = n.calls.at(-1);
  if (n.minLength > 0 && /^[1-7][CDHS]$/.test(last))
    box.append(
      el(
        "span",
        `${n.maxLength === 8 ? n.minLength + "+" : n.minLength + "–" + n.maxLength}${bid(last).slice(1)}`,
        "badge",
      ),
    );
  if (n.source && n.meaning !== n.source.originalMeaning)
    box.append(el("span", "Edited meaning", "badge edited"));
  if (!n.source && !n.reference) box.append(el("span", "Added entry", "badge added"));
  return box;
}
function meaning(n) {
  const box = el("div", undefined, "meaning");
  box.append(
    el(
      "span",
      n.meaning || "(No meaning recorded)",
      n.meaning ? "meaning-text" : "meaning-text empty",
    ),
  );
  if (n.notes) box.append(el("p", n.notes, "entry-note"));
  return box;
}
function detailsFor(n) {
  const meta = el("div", undefined, "auction-info");
  meta.append(el("p", `Full auction: ${n.fullAuction}`));
  if (editorShortcuts) meta.append(editLink(n));
  if (n.reference) {
    const reference = el("details", undefined, "source-note");
    reference.append(el("summary", "Source document"), el("p", n.reference));
    meta.append(reference);
  }
  if (n.source) {
    const source = el("details", undefined, "source-note");
    source.append(
      el("summary", `Original BSS · line ${n.source.bssLine}`),
      el("p", n.source.originalMeaning || "(No original description)"),
    );
    meta.append(source);
  }
  return meta;
}
function renderTree() {
  const list = scope();
  const groups = new Map();
  for (const n of nodes.filter(direct)) {
    const key = openingKey(n);
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  if (!groups.has(selectedOpening))
    selectedOpening = groups.keys().next().value;
  $("openings").replaceChildren();
  for (const [key, count] of groups) {
    const button = el("button", `${openingLabel(key)}  ·  ${count}`);
    button.setAttribute("aria-pressed", String(key === selectedOpening));
    button.onclick = () => {
      selectedOpening = key;
      $("search").value = "";
      page = 0;
      render();
    };
    $("openings").append(button);
  }
  const current = list.filter((n) => openingKey(n) === selectedOpening),
    ids = new Set(current.map((n) => n.id)),
    children = new Map();
  for (const n of current) {
    const key = ids.has(n.parentId) ? n.parentId : null;
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(n);
  }
  function branch(n) {
    const d = el("details", undefined, "bid-node");
    d.id = `bid-${n.id}`;
    d.dataset.id = n.id;
    const s = el("summary");
    s.append(el("span", label(n), "bid-label"), meaning(n), badges(n));
    d.append(s, detailsFor(n));
    const kids = children.get(n.id) || [];
    if (kids.length) {
      const box = el("div", undefined, "children");
      for (const k of kids) box.append(branch(k));
      d.append(box);
    } else d.classList.add("leaf");
    return d;
  }
  const content = $("tree");
  content.replaceChildren(
    el(
      "h2",
      selectedOpening
        ? `${openingLabel(selectedOpening)} opening`
        : "No auctions",
    ),
  );
  if (view === "contested")
    content.append(
      el(
        "p",
        "Earlier bids are included as context for each contested branch.",
        "view-note",
      ),
    );
  for (const n of children.get(null) || []) content.append(branch(n));
  status(
    `${nodes.filter(direct).length.toLocaleString()} auctions in this section.`,
  );
}
function renderSearch() {
  const term = normalize($("search").value),
    matches = nodes.filter((n) => direct(n) && n.searchText.includes(term));
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  page = Math.min(page, totalPages - 1);
  $("openings").replaceChildren(
    el("p", "Search covers all openings in the selected section.", "view-note"),
  );
  const box = $("tree");
  box.replaceChildren(
    el("h2", `${matches.length.toLocaleString()} matching auctions`),
  );
  for (const n of matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
    const card = el("article", undefined, "search-result");
    const link = el("a", n.fullAuction, "result-auction");
    link.href = readerUrl(`#bid-${n.id}`);
    link.onclick = (e) => {
      e.preventDefault();
      $("search").value = "";
      selectedOpening = openingKey(n);
      page = 0;
      render();
      history.replaceState(null, "", readerUrl(`#bid-${n.id}`));
      reveal(n.id);
    };
    card.append(link, meaning(n), badges(n));
    if (editorShortcuts) card.append(editLink(n));
    box.append(card);
  }
  if (!matches.length)
    box.append(
      el(
        "p",
        "Try a shorter auction or a word from its meaning. Select All auctions to search every section.",
      ),
    );
  if (totalPages > 1) {
    const paging = el("div", undefined, "pagination");
    const prev = el("button", "Previous"),
      next = el("button", "Next");
    prev.disabled = page === 0;
    next.disabled = page === totalPages - 1;
    prev.onclick = () => {
      page--;
      renderSearch();
    };
    next.onclick = () => {
      page++;
      renderSearch();
    };
    paging.append(prev, el("span", `Page ${page + 1} of ${totalPages}`), next);
    box.append(paging);
  }
  status(`Search results: ${matches.length.toLocaleString()}.`);
}
function render() {
  const scopedRules = rules.filter((r) => r.section && r.section !== "all" && (view === "all" || r.section === view));
  $("sectionRules").hidden = scopedRules.length === 0;
  $("sectionRuleList").replaceChildren(...scopedRules.map((r) => el("li", r.text)));
  for (const b of document.querySelectorAll("[data-view]"))
    b.setAttribute("aria-pressed", String(b.dataset.view === view));
  $("search").value.trim() ? renderSearch() : renderTree();
}
function reveal(id) {
  let node = document.getElementById(`bid-${id}`);
  if (!node) return;
  node.open = true;
  for (let p = node.parentElement; p; p = p.parentElement)
    if (p.tagName === "DETAILS") p.open = true;
  node.classList.add("highlight");
  node.scrollIntoView({ block: "center" });
  setTimeout(() => node.classList.remove("highlight"), 2500);
}
for (const button of document.querySelectorAll("[data-view]"))
  button.onclick = () => {
    view = button.dataset.view;
    page = 0;
    history.replaceState(null, "", readerUrl());
    render();
  };
$("search").addEventListener("input", () => {
  page = 0;
  render();
});
$("clearSearch").onclick = () => {
  $("search").value = "";
  page = 0;
  render();
  $("search").focus();
};
$("expandAll").onclick = () => {
  for (const d of $("tree").querySelectorAll("details.bid-node")) d.open = true;
};
$("collapseAll").onclick = () => {
  for (const d of $("tree").querySelectorAll("details")) d.open = false;
};
async function start() {
  for (const item of document.querySelectorAll(".notebook li"))
    setSuitText(item, item.textContent);
  try {
    const url = document.querySelector("script[data-source]").dataset.source;
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw Error("The bidding data could not be loaded.");
    const data = await response.json();
    if (data.version !== 2 || !Array.isArray(data.nodes))
      throw Error("The bidding data has an unsupported format.");
    nodes = data.nodes;
    rules = data.rules ?? [];
    byId = new Map(nodes.map((n) => [n.id, n]));
    for (const n of nodes)
      n.searchText = normalize(
        [
          n.auction,
          n.fullAuction,
          n.meaning,
          n.notes,
        ].join(" "),
      );
    const linked = byId.get(location.hash.replace("#bid-", ""));
    if (linked) {
      view = "all";
      selectedOpening = openingKey(linked);
    }
    render();
    if (linked) reveal(linked.id);
    if (editorShortcuts) {
      const info = el("div", undefined, "legacy-editor-note");
      info.append(
        el("strong", "Editor shortcuts. "),
        document.createTextNode(
          "Search an auction, then use Edit in Pages CMS. Saving requires your GitHub sign-in. ",
        ),
      );
      const cms = el("a", "Open Pages CMS");
      cms.href = "https://app.pagescms.org/PenghaoWang1225/bridge/main";
      const recovery = el("a", "Recover an old browser draft");
      recovery.href = "recovery/";
      info.append(cms, document.createTextNode(" · "), recovery);
      document.querySelector(".reader-controls").before(info);
    }
  } catch (e) {
    status(`${e.message} Refresh the page to try again.`);
    $("readerStatus").classList.add("error");
  }
}
start();
