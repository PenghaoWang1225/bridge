# Bridge

Website: https://penghaowang1225.github.io/bridge/

This repository contains the Bridge project site. The personal homepage is in the separate `PenghaoWang1225.github.io` repository.

## Files

- `index.html`: Bridge homepage and navigation.
- `style.css`: Styles for the homepage and section pages.
- `uncontested/index.html`: Uncontested Bidding System.
- `contested/index.html`: Contested auctions.
- `defense/index.html`: Defense.
- `scanian/`: Existing bidding tree, saved meanings, questions, rules, and backup controls.

The Scanian content was moved without changing its data. Its GitHub save target is now this repository: `bridge`, file `scanian/data/scanian.json`.
Use Pages CMS to edit and save with GitHub sign-in. You do not need to create or paste a token for Pages CMS.

## Add a page

Create a folder, such as `conventions`, and put an `index.html` file inside it.
Copy a section page as a starting point. Use `../style.css` for its stylesheet.
Add a link such as `conventions/` to the Bridge homepage.
Use `../` to return from a section to the Bridge homepage.
Keep links within this repository relative. A link such as `/style.css` points outside `/bridge/` and must not be used.

## Publish

In GitHub, open this repository. Select Settings → Pages.
Under Build and deployment, select Deploy from a branch.
Select branch `main` and folder `/ (root)`. Click Save.
The repository must be public unless the account plan supports Pages from private repositories.

## Checks

From this folder, run `node --test scanian/tests/*.test.mjs scanian/tests/*.test.cjs`.
The tests check data preservation, editing, and GitHub save conflicts.
The `.nojekyll` file lets GitHub Pages serve these files without a site generator.

## Edit with Pages CMS

Open https://app.pagescms.org/PenghaoWang1225/bridge/main and sign in with GitHub.
Install the Pages CMS GitHub App when prompted. Choose **Only select repositories**, then **bridge**.
The form setup is in `.pages.yml`. It contains no secrets.

- **Bidding meanings**: Find the full auction, expand it, and edit its meaning. The browser Find command can search auction labels.
- **General rules**: Add, change, or remove notebook rules.
- **Partner questions**: Add questions and answers. Find the bidding record number under Bidding meanings. To show an answer below a meaning, copy it into the note field and enable the note switch.
- **Site pages**: Edit the existing homepage and section HTML, or the shared CSS.

Click **Save** in Pages CMS. A save changes the GitHub file and starts a Pages update.
Wait for the save result. Unsaved form changes are not published.
The editor requires sign-in and repository write access. The website and repository stay public.
A save on GitHub does not update this Desktop copy. Run `git pull` here before editing local files.

The first CMS save still needs to be checked after you sign in and connect the repository.

## Backup editor

The earlier editor remains at https://penghaowang1225.github.io/bridge/scanian/?edit=1.
It can recover old browser drafts and import JSON or standalone HTML backups.
It still needs a GitHub token to save. Use Pages CMS for normal editing.
The public reading view does not read or remove browser drafts.

## CMS data format

Keep `settings.content.merge: true` in `.pages.yml`. Each form edits part of the same JSON file.
Pages CMS replaces arrays, so each list schema must contain all fields that its entries use.
Do not remove the protected auction IDs or change the 2278-entry limit.
The `auction` labels help locate meanings. The reader derives these labels from the source records.
Note IDs use UUIDs. The reader converts old numeric IDs in backups and drafts to stable UUIDs.
Pages CMS removes empty fields. The reader treats an omitted meaning or answer as empty text.
Git history records each CMS save time. The hidden timestamps retain earlier editor history.
