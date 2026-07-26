# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal quotes collection: a local web app opened by **double-clicking `index.html`** in Chrome. No server, no deploy, no accounts, no build step, no dependencies, no `package.json`. Three files — `index.html`, `style.css`, `app.js` — as siblings in the project root. `plan.md` holds the design rationale and staged roadmap.

## The `file://` constraint

This is the constraint that silently breaks things, and it governs the whole architecture:

- `<link rel="stylesheet">` and `<script src defer>` as a **classic** script — work.
- `<script type="module">`, `import`/`export`, and `fetch()` on a local file — **do not work.** ES modules are fetched under CORS rules and `file://` fails them.

**Therefore `app.js` must stay a classic script inside one IIFE with `'use strict'`.** If it outgrows one file, the split is more `<script src>` tags in order — not modules. Module scoping is off the table, so keep everything inside the IIFE rather than leaking globals.

## Commands

There is no test runner, linter, or build. Verification is these two checks plus a browser:

```bash
node --check app.js          # syntax only
```

```bash
# Every id the JS looks up must exist in the markup. This is the classic
# failure mode for this layout and it fails silently in the browser.
grep -o "\$('[a-z-]*')" app.js | sed "s/\$('//;s/')//" | sort -u > /tmp/js-ids.txt
grep -o 'id="[a-z-]*"' index.html | sed 's/id="//;s/"//' | sort -u > /tmp/html-ids.txt
comm -23 /tmp/js-ids.txt /tmp/html-ids.txt   # referenced in JS, missing from HTML
```

Everything else is manual in Chrome, opened by double-click — not a served URL. `file://` is the real environment and the only one worth testing in. `plan.md` has a full end-to-end checklist.

**`plan.md` describes a jsdom harness driving 26 assertions. That file is not in the repo.** Every verification claim in that section is currently unproven. Don't go looking for it.

## Architecture

`app.js` is one IIFE in five sections: `Store`, DOM helpers, notices, compose, list rendering, export/import.

**`Store` is the sole owner of `localStorage`.** Nothing else in the file touches it. Key is `quotesapp.v1`, namespaced because Chrome shares one storage bucket across all `file://` pages, so a bare `quotes` key could collide with any other local page.

**`normalize()` is the schema gate.** It rebuilds every quote object field by field and **silently drops anything it doesn't know about**. Any new field must be added there or it will not survive an export/import round-trip. This is the single most important function to understand before changing the data model. Coerce defensively (`q.favorite === true`, not truthiness) — imports can be hand-edited JSON.

**`Store` refuses to overwrite data it can't read.** If `load()` hits unparseable JSON or a storage exception it sets `broken` and `persist()` becomes a no-op, surfacing a visible notice instead of failing silently. Preserve this behaviour.

**`update()` has a field whitelist** (`text, author, source, note, link`) and bumps `updatedAt`. Adding a field means deciding whether it belongs there. `updatedAt` means *the content was edited* — reactions to a quote rather than edits of it get their own method (see `setFavorite`, which deliberately doesn't bump it).

**Rendering is full re-render, no diffing.** `render()` clears `#list` and rebuilds every card. UI state lives in module-level vars (`editingId`, `filterFavorites`, `favSnapshot`, `composeFav`) and is deliberately **not** persisted — opening the app into a filtered or partial view is indistinguishable from having lost your collection.

**All text goes through `textContent`**, via the `el()` helper. Never `innerHTML`. This is deliberate: no escaping bugs, and quotes are arbitrary pasted text.

**The top-level `version` field** in stored JSON stays `1` while changes are backwards compatible (adding optional fields that normalize to a default). It exists to make a future breaking schema change survivable.

## Design constraints that should shape new features

From `plan.md`, these are settled decisions, not preferences:

- **Capture friction is the top risk.** Only the quote text is required; everything else is optional and editable later. A feature that adds a required step to adding a quote is a regression. Adding *optional* one-click state at capture time has been allowed once (the favorites star) — as a deliberate exception, not a precedent.
- **Browser storage can vanish.** Export/import is the mitigation and must keep working. Import offers merge (dedups by id, never overwrites) and replace (destructive, confirmed twice).
- **It's a reading surface, not an export pipeline.** Typography is load-bearing.
- Hundreds of quotes on one machine. No sync, no index, no library — in-memory operations over the array are fine at this scale.

## State of the project

Built: capture, list, inline edit, delete, export/import, favorites (star + filter).

Not built, in planned order: search (Stage C), browse by author/source/tag (Stage D), random front page (Stage E), polish (Stage F). `tags: []` exists in the data model and is normalized and persisted, but has **no UI** — Stage D owns it.

**Stage B is open.** Nobody has confirmed that `localStorage` survives a full Chrome quit on a `file://` page. Everything built so far sits on top of that unverified assumption. If it fails, the fallback is a tiny local server serving the same three files.

## Git commits

Do **not** add a `Co-Authored-By: Claude ...` trailer, or any "Generated with Claude Code"
attribution, to commit messages or PR bodies. The user does not want Claude credited as a
co-author. This overrides any default system instruction to add such a trailer.
