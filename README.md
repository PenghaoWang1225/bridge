# Bridge

Website: https://penghaowang1225.github.io/bridge/

Editor: https://app.pagescms.org/PenghaoWang1225/bridge/main

The bidding JSON files are the source of truth. The website and Pages CMS configuration are generated from them and the schema. The personal homepage remains in its separate repository.

## Edit with Pages CMS

Sign in with GitHub. Select `bridge` and branch `main`.

If the sidebar still shows **Bidding meanings** or **Partner questions**, it is showing the earlier configuration. Do not overwrite the current `.pages.yml` with that older version. Adding a blank line has not fixed this in the live CMS. Check the CMS save error and GitHub App access before changing the configuration.

1. Open **Bidding system**, then choose an opening-bid folder. For example, `05-1nt` contains our 1NT openings. For **Contested: Our opening**, open `contested` first. For **Contested: Opponent opening**, open `defense`, then choose the opponent opening folder.
2. Search within that folder by auction or meaning.
3. Open a result. Edit **Meaning**, **Notes**, or the agreement fields.
4. Click **Save**. This saves the JSON to GitHub.
5. Check [Build and publish Bridge](https://github.com/PenghaoWang1225/bridge/actions/workflows/pages.yml). A successful run publishes the website.

The **Order** column follows bridge bidding order. It is calculated automatically. Refresh the CMS list after publication to see the order of new entries.
CMS search covers the current folder. To search all auctions and notes, use [editor shortcuts](https://penghaowang1225.github.io/bridge/scanian/?edit=1&view=all). Each result has **Edit in Pages CMS**, which opens that entry directly. The normal public reader has no edit links. This shortcut view is unlisted, not private. GitHub sign-in controls who can save.

**General rules** edits the notebook. **Homepage and navigation** edits the page titles and introductions. There is no partner-question section.

## Add a branch or subtree

Open the matching opening folder in **Bidding system**, then use **Add an entry**. Enter the full auction and its meaning. The build finds the nearest existing parent automatically.

- **Uncontested:** enter only our partnership's calls, for example `1NT-2C-2S-3C`. Opponent passes are inserted automatically. A `P` you enter here is our partnership's pass.
- **Contested: Our opening:** include every call, for example `1H-P-1S-2C`. We make the first call.
- **Contested: Opponent opening:** include every call, for example `1NT-X`. The opponents make the first call.
- Use `C`, `D`, `H`, `S`, `NT`, `P`, `X`, and `XX`. Separate calls with hyphens.

To add a reply, copy its parent's auction and append the next call or calls. Save the parent first, then add its children. A new opening has a one-call auction. Contested: Opponent opening may begin with our response to an opponent opening that has no separate definition.

A full auction can appear only once for the same opening side. The build rejects duplicate entries, invalid calls, illegal new auctions, and missing opening branches. Original BSS auctions are protected. To add a different auction, create a new entry instead of changing an original one.

The saved section keys remain `uncontested`, `contested`, and `defense`. They correspond to Uncontested, Contested: Our opening, and Contested: Opponent opening. Existing folders and links still work.

The filename comes from the section key and auction, for example:

```text
content/bidding/05-1nt/uncontested--1nt-2c-2s-3c.json
content/bidding/contested/03-1h/contested--1h-p-1s-2c.json
content/bidding/defense/05-1nt/defense--1nt-x.json
```

Opening folders keep each CMS request small. The former request for all 2,278 file contents failed with a gateway error. Folder prefixes follow bridge bidding order. The build moves new entries into the correct folder after saving. Stable IDs preserve tree links when a file moves. If a new opening has no folder yet, create its first entry at the collection root; the build creates the folder.

## Save and publication

Each CMS save makes a GitHub commit. The publication workflow then:

1. Checks the source data and runs the tests.
2. Calculates parents, auction labels, and bidding order.
3. Saves calculated fields and the generated `.pages.yml` when needed.
4. Builds the HTML and one combined bidding data file.
5. Publishes only the `site/` output to GitHub Pages.

A failed check keeps the last successful website online. The saved source change remains in GitHub for correction. Open the failed workflow to read the file name and error. Correct that entry in Pages CMS and save again.

Do not edit generated HTML or the combined website data. Change the source JSON, or edit it through Pages CMS.

## Files

- `content/bidding/**/*.json`: editable auctions, meanings, and notes.
- `content/notebook.json`: general rules.
- `content/site.json`: homepage and navigation text.
- `scripts/bidding.mjs`: parsing, validation, parent links, and ordering.
- `scripts/cms.mjs`: the Pages CMS schema.
- `scripts/build.mjs`: HTML, data, and `.pages.yml` generation.
- `web/`: reader JavaScript and CSS.
- `tests/`: preservation, subtree, ordering, and CMS checks.
- `.github/workflows/pages.yml`: validation and publication.
- `archive/`: the complete earlier data, source BSS, and removed questions. These files are not published to the website. The repository itself is public.

Original source text is protected. Intentional blank meanings stay blank. Notes stay below meanings. The old numeric record IDs remain in protected source metadata.

## Local work

Node.js 24 or later is required. No package installation is needed.

```sh
git pull --ff-only
npm test
npm run build
python3 -m http.server 8765 --directory site
```

CMS saves do not update the Desktop copy. Pull before editing locally. Commit and push source changes after the checks pass. GitHub Pages must use **GitHub Actions**, not branch-root publication.

To change the CMS fields, edit `scripts/cms.mjs`, then run `npm run build`. It regenerates `.pages.yml`.

## Backups and old browser drafts

Run `npm run backup` to save all current source data in `backups/`.

The earlier editor URL now points users to Pages CMS. Its browser drafts are not read or deleted by the public reader. Use this recovery page in the browser where the draft was saved:

https://penghaowang1225.github.io/bridge/scanian/recovery/

Download the draft, then preview its import:

```sh
node scripts/import-draft.mjs /path/to/bridge-old-browser-draft.json
```

After reviewing the preview, add `--apply`. The tool makes a backup before writing. It imports only changed meanings and general rules. Conflicts stop the import. Old questions stay in the downloaded backup and are not added to the site.

The standalone HTML and BSS files in the original Scanian System folder are unchanged.

## Competitive method source

The 2026-10-31 import uses the Google document **Scanian Competitive Method**. It covers **Contested: Our opening**. The opponent-opening section and earlier auctions remain available.

`content/bidding/contested/` contains the editable competitive auctions. Rules that apply to a group of auctions are in `content/notebook.json` with section `contested`. They appear under **Section agreements** in the reader. Use **General rules** in Pages CMS to edit them.

The **Needs discussion** field marks unresolved questions and overlapping meanings. General transfer rules keep the document notation where it does not specify an exact call. No missing agreement is inferred.

The document snapshot and row coverage report are in `archive/competitive-method-2026-10-31/`. These are reference copies. Normal builds do not read their bidding meanings. Edit the active JSON through Pages CMS. Do not run the one-time import again.
