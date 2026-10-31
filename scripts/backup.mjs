import fs from "node:fs";
import path from "node:path";
import { readEntries } from "./bidding.mjs";
const root = path.resolve(import.meta.dirname, "..");
const read = (file) =>
  JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const backup = {
  version: 2,
  createdAt: new Date().toISOString(),
  entries: readEntries(root),
  notebook: read("content/notebook.json"),
  site: read("content/site.json"),
};
const folder = path.join(root, "backups");
fs.mkdirSync(folder, { recursive: true });
const file = path.join(
  folder,
  `bridge-${new Date().toISOString().replaceAll(":", "-")}.json`,
);
fs.writeFileSync(file, JSON.stringify(backup, null, 2) + "\n");
console.log(`Saved ${file}`);
