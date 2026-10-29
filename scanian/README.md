# Penghao Wang — Scanian bridge notebook

Public site: https://penghaowang1225.github.io/bridge/scanian/

Read the bidding tree without signing in. Open **Connect editing** to edit it.
Use a fine-grained GitHub token for the `bridge` repository only. Give it **Contents: Read and write** access.
The token stays in page memory. It is not saved in a file, browser storage, or a backup.
Refresh or disconnect to remove it.

Click **Finish editing** to save meanings to GitHub. The rule and question buttons also save to GitHub.
Wait for **Saved to GitHub** before closing the page. Failed saves keep a browser draft.
Use **Download backup** to keep a JSON file. **Save edited HTML** makes a standalone copy.
The standalone HTML saves locally in the browser. Use its export button to update a file copy.

To move newer edits from an old local page, use **Save edited HTML** there.
Then connect editing on this site and choose **Import backup**. Review the draft and save it.
Imports stop if five or more written meanings would become blank.

Saved content is in `scanian/data/scanian.json` from the repository root. Each save makes a Git commit.
Separate edits from two browsers merge. Conflicting edits require a choice before saving.
GitHub Pages can take a short time to publish a new version.
GitHub saves update the online repository. They do not update a separate local HTML file.

The source records and BSS lines are in `data/records.json` and `data/source-bss.json`.
Partner answers remain separate notes. They do not replace a bidding meaning.

Run checks with `node --test tests/*.test.mjs tests/*.test.cjs`.
For a local preview, run `python3 -m http.server 8765` in this folder.
Publish the `main` branch from the Bridge repository root in GitHub Pages settings.
