# Scanian bridge notebook

Public reader: https://penghaowang1225.github.io/bridge/scanian/

Main editor: https://app.pagescms.org/PenghaoWang1225/bridge/main
Sign in with GitHub. Select **bridge**, then edit meanings, rules, or questions.
Click **Save** to save to GitHub. GitHub Pages will publish the change.
The public reader keeps its current design and has no edit buttons.
See [the main README](../README.md) for setup and data details.

## Backups and old drafts

The earlier editor remains at https://penghaowang1225.github.io/bridge/scanian/?edit=1.
It can recover browser drafts and import JSON or standalone HTML backups.
It uses a fine-grained GitHub token for **bridge**, with **Contents: Read and write**.
The token stays in page memory. It is not saved in a file, browser storage, or a backup.
Use **Download backup** to keep a JSON copy. **Save edited HTML** makes a standalone copy.
The standalone HTML keeps edits in the browser. Export it again to update the file copy.

To move newer edits from an old local page, use **Save edited HTML** there.
Import that file in the backup editor. Review the draft before saving.
Imports stop if five or more written meanings would become blank.

Saved content is in `data/scanian.json`. Source records and BSS lines stay in
`data/records.json` and `data/source-bss.json`. Partner notes do not replace meanings.
GitHub saves do not update the Desktop repository. Run `git pull` before local edits.

Run checks from this folder: `node --test tests/*.test.mjs tests/*.test.cjs`.
