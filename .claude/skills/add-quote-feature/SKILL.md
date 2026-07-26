---
description: Adds or extends a feature in the Quotes App. Use when the user wants a new field on a
quote, a new filter, a button, sorting, search, or a design change — anything touching index.html,
style.css, or app.js.
---

# Add a feature to the Quotes App

Read `CLAUDE.md` for the full architecture. This is the working checklist.

## Before you write anything

1. Read `app.js` first. It is **one IIFE** with `'use strict'`, in five sections:
   `Store`, DOM helpers, notices, compose, list rendering, export/import. There is no
   `script.js`, no build step, no dependencies, no test runner.
2. The app is opened by **double-clicking `index.html`** — the real environment is `file://`.
   `type="module"`, `import`/`export` and `fetch()` on a local file all fail there. Keep `app.js`
   a classic script. If it outgrows one file, add another `<script src>` in order — not modules.
   Everything stays inside the IIFE; don't leak globals.

## Where code goes

3. Markup in `index.html`, styles in `style.css`, logic in `app.js`.
4. **`Store` is the only code that touches `localStorage`.** The key is `quotesapp.v1` — never
   rename it. Never call `localStorage` from outside `Store`.
5. Build DOM with the `el(tag, className, text)` helper and `document.createElement`. Everything
   goes through `textContent`. **Never `innerHTML`** — quotes are arbitrary pasted text.
6. Wire events with `addEventListener` on each element as you build it. There is no delegated
   listener; `render()` clears `#list` and rebuilds every card from scratch, no diffing.

## Storing new data on a quote

7. **Add the field to `normalize()` or it does not exist.** That function rebuilds every quote
   field by field and silently drops anything it doesn't know about, so a field missing from it
   will not survive an export/import round-trip. Coerce defensively (`q.favorite === true`, not
   truthiness) — imports can be hand-edited JSON.
8. Decide whether the field belongs in `update()`'s whitelist (`text, author, source, note, link,
   category`). `update()` bumps `updatedAt`, which means *the content was edited*. A reaction to a
   quote rather than an edit of it gets its own method instead — see `setFavorite`, which
   deliberately doesn't bump it.
9. Leave the top-level `version` at `1` while changes stay backwards compatible, i.e. optional
   fields that normalize to a default.

## UI state

10. View state (`editingId`, `filterFavorites`, `favSnapshot`, `filterCategory`, `composeFav`)
    lives in module-level vars and is **deliberately not persisted**. Opening the app into a
    filtered or partial view is indistinguishable from having lost your collection.
11. Any filter you add needs a guaranteed way back out. Groups and toggles disappear as they empty,
    so make sure emptying one can't strand the user in a view with no control left to clear it.
12. **Capture friction is the top risk.** Only the quote text is required. Anything you add to the
    compose form must be optional and editable later.

## Style

13. Match the surrounding code: 2-space indent, `var` and ES5 function expressions (no `let`,
    `const`, arrow functions or template literals), `render*` names for functions that build DOM.
14. Comments explain *why* a choice was made, especially where the obvious approach was rejected.
    Match that density — don't narrate what the code plainly does.

## Verify

15. Both checks must pass:

```bash
node --check app.js          # syntax only
```

```bash
# Every id the JS looks up must exist in the markup. This is the classic failure
# mode for this layout and it fails silently in the browser.
grep -o "\$('[a-z-]*')" app.js | sed "s/\$('//;s/')//" | sort -u > /tmp/js-ids.txt
grep -o 'id="[a-z-]*"' index.html | sed 's/id="//;s/"//' | sort -u > /tmp/html-ids.txt
comm -23 /tmp/js-ids.txt /tmp/html-ids.txt   # referenced in JS, missing from HTML
```

16. Logic inside `Store` can be tested without a browser by slicing the `Store` IIFE out of
    `app.js` and running it against a stub `window.localStorage`. Keep such a harness outside the
    repo — the project has no test runner and isn't gaining one.
17. Everything else is manual. Say plainly that rendering and CSS are unverified until someone
    opens `index.html` in Chrome by double-click, and state what to look at.
