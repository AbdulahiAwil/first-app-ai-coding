# Quotes app — plan

## Context

A personal app to store and retrieve quotes. Greenfield; the only existing file is a
working single-file draft of Stage 1 (see *Current state* below).

Decisions settled through discussion, which shape everything else:

- **Local web app in Chrome, opened by double-clicking `index.html`.** No server, no
  deploy, no accounts, no build step, no dependencies.
- **Hand-typed capture.** Quotes are typed or pasted in, mostly at a desk.
- **Three reasons to open it:** search a half-remembered line, resurface something at
  random, browse by author / source / tag. Explicitly *not* a tool for exporting quotes
  into other writing — it's a reading surface, so typography is load-bearing.
- **Hundreds of quotes, one machine.** No sync.
- **Data lives in browser storage**, chosen for zero install with eyes open about the risk.

Two risks drive the plan:

1. **Capture friction kills these apps.** If adding a quote feels like filling out a form,
   the collection stops growing. Hence: only the quote text is required, everything else is
   optional and editable later, and tagging never happens at capture time.
2. **Browser storage can vanish.** Clearing site data, a profile reset, or a new machine
   loses everything — and this collection accrues value over years, so it's most painful to
   lose late. Mitigation: export/import from the first version that stores anything real,
   plus a nudge to use it.

Intended outcome: a page you double-click, still add to in a year, and can't lose without
ignoring several warnings.

---

## File structure

Three files, siblings in the project root:

| File | Contains |
|---|---|
| `index.html` | Markup only — header, compose form, list container, hidden file input, import dialog. Links the other two. |
| `style.css` | All styling. |
| `app.js` | All behaviour, in one IIFE: storage module, DOM helpers, notices, compose, list rendering, export/import, and later search and browse. |

### The `file://` constraint — the one thing that can silently break this

Pages opened as `file://` are second-class citizens:

- `<link rel="stylesheet" href="style.css">` — **works.**
- `<script src="app.js" defer></script>` as a *classic* script — **works.**
- `<script type="module">` — **does not work.** ES modules are fetched under CORS rules and
  `file://` fails them. Same reason `fetch()` on a local file is blocked.

**Therefore `app.js` must be a classic script: no `import`, no `export`, no `type="module"`.**
It stays wrapped in one IIFE with `'use strict'`, exactly as it is now. If `app.js` outgrows
one file later, the split is more `<script src>` tags in order — not modules.

This is a real trade for the three-file layout: module scoping is off the table, so keep
everything inside the single IIFE rather than leaking globals.

---

## Current state — Stage A done, Stage B awaiting a browser

Split completed: `index.html` (markup + `<link>`/`<script src defer>`), `style.css` (196
lines), `app.js` (458 lines, one classic-script IIFE).

**Automated verification (no browser needed) — all passing:**
- `node --check app.js` clean.
- All 20 `id`s the JS looks up exist in the markup (cross-checked; a split's classic failure).
- A jsdom harness loads the real `index.html` + `app.js` together and drives the actual DOM
  event handlers through **26 assertions, all green**: load without throw, empty state,
  add (text-only + fully-filled), trim, version stamp, newest-first order, http-link anchor,
  inline edit + `updatedAt` bump, delete, export JSON, import merge (restores + dedups),
  import replace, malformed-file rejection leaving data intact.

**What jsdom CANNOT prove — needs real Chrome (this is the honest gap):**
1. `style.css` and `app.js` actually load over `file://` (jsdom was handed the files
   directly; it never exercised sibling fetching). Classic `<link>`/`<script src>` are
   expected to work from `file://` — this confirms it on the actual machine.
2. The page visually renders correctly (jsdom does no layout).
3. **localStorage survives a full Chrome restart** — the Stage 0 storage check, still open.
   jsdom's storage is a throwaway in-memory shim and proves nothing about disk persistence.

Items 1–2 are a ~30-second look; item 3 is Stage B proper and needs a quit-and-reopen.

---

## Stage A — Split into three files

Mechanical, no behaviour changes:

1. Move the contents of `<style>` into `style.css`; link it from `<head>`.
2. Move the contents of `<script>` into `app.js`; load it with
   `<script src="app.js" defer></script>`. `defer` means the DOM is ready when it runs, so
   the existing `$('...')` lookups at IIFE top-level stay valid.
3. `index.html` keeps markup only.

**Done when:** opening `index.html` by double-click gives a styled page that adds, edits,
deletes, exports and imports — with an empty browser console. A blank or unstyled page here
means the sibling files didn't load, and that's the `file://` constraint biting.

## Stage B — Verify Stage 1 for real *(the storage check, deferred from earlier)*

The original plan opened with a throwaway spike proving `localStorage` survives a full Chrome
restart on a `file://` page. That spike was cut at your request, so the check moves here —
same test, real quotes.

1. Add three quotes: one text-only, one with every field filled, one pasted with messy whitespace.
2. **Fully quit Chrome** — every window, and check the system tray.
3. Reopen `index.html`. All three are still there.
4. Export. Clear site storage via DevTools. Reload — empty, no errors. Import the file. All
   three are back.

**Do this the day Stage A lands, before typing in a real collection.** If step 3 fails,
stop: the fallback is a tiny local server serving the same three files, which costs a
launcher and changes nothing else here.

**Then live with it for a few days before Stage C.** Capture friction is the biggest risk
and the one I can't see from my side — a week of real use tells you whether the add form is
annoying, and that's far cheaper to fix before search and browse are built on top of it.

## Stage C — Search

In-memory over the quotes array. A few hundred objects, so no index and no library.

- Case- and punctuation-insensitive.
- Matches across text, author, source, and note.
- Light stem tolerance (hand-rolled suffix trimming) so `remembering` finds `remembered`.
- Matched terms highlighted in results.

**Done when:** a quote is findable from a half-remembered fragment typed with wrong
capitalization, stray punctuation, or a different word ending.

## Stage D — Browse

- Author, source, and tag views — each lists values with counts, drilling into a filtered list.
- Tag editing on existing quotes: free-form input autocompleting from tags already used.
  Free-form respects that tagging happens later, in a sorting mood; autocomplete is what
  prevents forty near-duplicate tags.
- An explicit **untagged** entry in the tag view.

**Done when:** "what did I save from that book" takes two clicks, and untagged quotes are
never silently hidden. The half-tagged-collection failure mode is *invisible omission* — the
fix is making the gap visible.

## Stage E — Front page

What the shortcut lands on: one random quote set large and well, with a reshuffle; the search
box; a way into browse. Weight randomness slightly against very recent additions so it
surfaces genuinely forgotten things.

**Done when:** landing on it is worth doing on a day with no specific errand.

## Stage F — Polish

- **Typography pass** — measure, leading, a serif for quote text. This is the surface you read.
- **Near-duplicate warning on add** — normalized comparison against existing text.
  Non-blocking: it informs, you decide.
- **Backup nudge** — unobtrusive banner after ~10 additions since the last export.
- **Desktop shortcut** to `index.html`, confirmed working.

---

## Data model

Stored under the namespaced key `quotesapp.v1` — Chrome shares one storage bucket across all
`file://` pages, so a bare key like `quotes` could collide with any other local page you open.

```json
{
  "version": 1,
  "quotes": [
    {
      "id": "…",
      "text": "…",            // required — the only required field
      "author": "",
      "source": "",           // book, talk, article, film
      "note": "",             // why you saved it
      "link": "",             // url, page number, timestamp
      "tags": [],
      "createdAt": "…",
      "updatedAt": "…"
    }
  ]
}
```

The top-level `version` costs nothing now and is what makes a future schema change survivable.

`app.js` keeps one storage module as the **sole** owner of `localStorage`; nothing else in
the file touches it. It refuses to overwrite data it couldn't parse, and surfaces a visible
error instead of failing silently.

---

## Verification

Stage A and Stage B above are the gate. Full end-to-end once Stage F lands:

1. Open `index.html` by double-click in Chrome — not a served URL. `file://` is the real
   environment and the only one worth testing in.
2. Console is empty on load.
3. Add three quotes (text-only / fully filled / messy whitespace).
4. Fully quit and reopen Chrome. All three survive.
5. Search a fragment of the middle one with wrong capitalization and a different word ending.
   It comes up, highlighted.
6. Tag two of them after the fact. Browse by tag and by author; confirm the untagged one shows
   under "untagged" rather than disappearing.
7. Export → clear storage in DevTools → reload (empty, no errors) → import → all back, tags intact.
8. Re-add an existing quote. The duplicate warning appears and is dismissable.
9. Launch from the desktop shortcut, land on the front page with a random quote.
