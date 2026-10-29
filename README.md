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
To save from the website, create a fine-grained token for `bridge` with Contents read and write access. The old homepage token does not grant access to this repository.

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
