import { AGREEMENTS } from "./bidding.mjs";
const f = (name, label, type, extra = {}) => ({ name, label, type, ...extra });
const protectedField = (name, type = "string") =>
  f(name, name, type, { hidden: true, readonly: true });
export function cmsConfig() {
  const statuses = [
    ...Object.entries(AGREEMENTS).map(([value, label]) => ({ value, label })),
    ...["M", "N", "S", "T", "W"].map((value) => ({
      value,
      label: `Original BSS status ${value}`,
    })),
  ];
  return {
    settings: { content: { merge: true } },
    content: [
      {
        name: "bidding",
        label: "Bidding system",
        type: "collection",
        path: "content/bidding",
        format: "json",
        subfolders: true,
        description:
          "Open an opening-bid folder, then search by auction or meaning. Use Add an entry to add a branch. Search all auctions at https://penghaowang1225.github.io/bridge/scanian/?edit=1&view=all and follow Edit in Pages CMS. For Uncontested, enter only our calls, such as 1NT-2C-2S. For Contested and Defense, include every call. The build finds the parent, folder, and bidding order.",
        filename: { template: "{section}--{auction}.json", field: false },
        operations: { create: true, rename: false, delete: false },
        view: {
          fields: ["order", "auction", "meaning", "section"],
          primary: "auction",
          search: ["auction", "meaning", "notes", "fullAuction"],
          sort: ["order", "auction"],
          default: { sort: "order", order: "asc" },
        },
        fields: [
          f("id", "Permanent ID", "uuid", {
            required: true,
            hidden: true,
            readonly: true,
            options: { editable: false, generate: false },
          }),
          f("section", "Section", "select", {
            required: true,
            default: "uncontested",
            options: {
              values: [
                { value: "uncontested", label: "Uncontested — our calls only" },
                { value: "contested", label: "Contested — all calls" },
                {
                  value: "defense",
                  label: "Defense — opponents open; all calls",
                },
              ],
            },
          }),
          f("auction", "Auction", "string", {
            required: true,
            description:
              "Use letters and hyphens. Uncontested: 1NT-2C-2S. Contested: 1H-P-1S-2C. Defense: 1NT-X. Use P for pass, X for double, and XX for redouble. To add a child, copy the parent auction and append the next call(s).",
            pattern: {
              regex:
                "^[1-7](?:[cCdDhHsS]|[nN][tT]?)(?:[ -]+(?:[1-7](?:[cCdDhHsS]|[nN][tT]?)|[pP]|[xX]{1,2}))*$",
              message:
                "Use calls such as 1NT-2C-2S, with C, D, H, S, NT, P, X, or XX.",
            },
          }),
          f("meaning", "Meaning", "text", {
            options: { maxlength: 50000 },
            description:
              "Blank meanings are allowed. They do not remove the auction.",
          }),
          f("notes", "Notes", "text", {
            description:
              "Notes appear below the meaning. They do not replace it.",
          }),
          f("artificial", "Artificial", "boolean"),
          f("forcing", "Agreement", "select", {
            default: "0",
            options: { values: statuses },
          }),
          f("minLength", "Minimum suit length", "number", {
            default: 0,
            options: { min: 0, max: 8, step: 1 },
            description:
              "0 means unspecified. This applies to the suit of the last bid.",
          }),
          f("maxLength", "Maximum suit length", "number", {
            default: 8,
            options: { min: 0, max: 8, step: 1 },
            description:
              "8 keeps the original BSS convention for no stated upper limit.",
          }),
          f("order", "Order", "number", {
            readonly: true,
            default: 0,
            description:
              "Calculated after saving. Refresh the list after publication to see the new position.",
          }),
          protectedField("parentId"),
          protectedField("opening"),
          protectedField("fullAuction"),
          protectedField("meaningUpdatedAt"),
          f("source", "Original BSS source", "object", {
            hidden: true,
            readonly: true,
            fields: [
              protectedField("legacyId", "number"),
              protectedField("bssLine", "number"),
              protectedField("bssPrefix"),
              protectedField("originalMeaning", "text"),
            ],
          }),
        ],
      },
      {
        name: "rules",
        label: "General rules",
        type: "file",
        path: "content/notebook.json",
        format: "json",
        operations: { create: false, delete: false, rename: false },
        fields: [
          f("rules", "Rules", "object", {
            list: { collapsible: { collapsed: false, summary: "{text}" } },
            fields: [
              f("id", "ID", "uuid", {
                required: true,
                hidden: true,
                readonly: true,
              }),
              f("text", "Rule", "text", { required: true }),
            ],
          }),
        ],
      },
      {
        name: "site",
        label: "Homepage and navigation",
        type: "file",
        path: "content/site.json",
        format: "json",
        operations: { create: false, delete: false, rename: false },
        fields: [
          f("title", "Homepage title", "string", { required: true }),
          f("description", "Homepage introduction", "text"),
          f("systemTitle", "Bidding tree title", "string", { required: true }),
          f("sections", "Sections", "object", {
            list: {
              min: 3,
              max: 3,
              collapsible: { collapsed: false, summary: "{title}" },
            },
            fields: [
              f("key", "Section key", "string", {
                required: true,
                readonly: true,
              }),
              f("title", "Title", "string", { required: true }),
              f("description", "Description", "text"),
            ],
          }),
        ],
      },
    ],
  };
}
// JSON-quoted scalars keep symbols, colons, and user text safe in generated YAML.
export function yaml(value, depth = 0) {
  const pad = "  ".repeat(depth);
  if (Array.isArray(value))
    return value
      .map((v) =>
        typeof v === "object" && v !== null
          ? `${pad}-\n${yaml(v, depth + 1)}`
          : `${pad}- ${JSON.stringify(v)}`,
      )
      .join("\n");
  return Object.entries(value)
    .map(([k, v]) =>
      typeof v === "object" && v !== null
        ? `${pad}${k}:\n${yaml(v, depth + 1)}`
        : `${pad}${k}: ${JSON.stringify(v)}`,
    )
    .join("\n");
}
export function cmsYaml() {
  return (
    "# Generated by scripts/build.mjs from the bidding schema.\n# Edit the schema in scripts/cms.mjs, then run npm run build.\n" +
    yaml(cmsConfig()) +
    "\n"
  );
}
