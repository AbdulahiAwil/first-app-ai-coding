---
name: frontend-design
description: Make visual changes to the Quotes App — colours, palette, typography, spacing, card
and chip styling, light/dark treatment, CSS layout. Use whenever the user asks to restyle, redesign,
"make it look better", "more colourful", adjust the palette, fix spacing, or change how anything on
the page looks. Also use before touching style.css for any reason. Explains the category colour
system, the specificity ordering the cards depend on, and how to actually look at the result with a
headless screenshot instead of guessing.
---

# Designing the Quotes App

Paths are relative to the project root. Read `CLAUDE.md` for the architecture; this covers the
visual layer specifically.

**Look at your work.** This project has no dev server and no browser in the loop, so a change to
`style.css` is unverified until it has been rendered. Three separate design changes shipped here
before anyone saw the page. Run the screenshot script (below) and open the PNG.

## See the result

```bash
bash .claude/skills/frontend-design/screenshot.sh /tmp/shot.png 1100x1400
```

Then read the PNG. It seeds a realistic collection into `localStorage` first — six quotes across
three categories, one uncategorized, two favorites, one of which is also categorized — because the
app renders an empty page otherwise and the empty page shows almost none of the design.

It works on a throwaway copy under `$TMPDIR`, so nothing is added to the repo. Takes about two
seconds.

To check a state the seed doesn't cover (a filter turned on, the editor open, a very long quote),
edit the `seed.html` heredoc inside the script rather than adding files to the project.

## What colour may and may not touch

The app is a reading surface and typography is load-bearing — that's a settled decision in
`plan.md`, not a preference. So:

- **Quote text stays dark on near-white.** `.quote blockquote` is Georgia at full contrast on
  `--card`. Don't tint it, don't reverse it, don't drop its contrast for the sake of a palette.
- **Colour lives in the chrome**: header rule, buttons, chips, card edges, focus rings, notices.
- **The page wash is pooled at the top**, where there is no text — `body` carries two soft radial
  gradients that fade out before the reading column starts.

There is no build step and no dependencies. Keep to system font stacks and hand-written CSS; don't
introduce a framework, a preprocessor, or a remote font.

## The category colour system

Colour here carries information — which group a quote is in — rather than decorating. The
mechanism is worth understanding before you change it:

- `style.css` defines eight slots, `.c0` through `.c7`, and each sets one custom property `--cat`.
- `app.js` has `categoryClass(name)`, which hashes a category name to a slot. **The JS never names
  a colour.** It picks a slot; the palette stays entirely in CSS.
- Chip, card edge, meta label and note bar all read `var(--cat)`, so a group cannot end up one
  colour in one place and another elsewhere.

To restyle the palette, edit the eight `--cat` values and nothing else. To change how names map to
slots, edit `categoryClass()` — but note the hash must stay deterministic, or a group changes
colour on reload.

Tints are derived rather than hand-picked:

```css
background: #fff;                                      /* fallback first */
background: color-mix(in srgb, var(--cat) 8%, #fff);
```

Always declare the plain fallback immediately before the `color-mix` line. Both `color-mix` uses in
the file follow that pattern.

## The card marker

The coloured bar on a card is a `::before` pseudo-element, inset vertically so it reads as a pill:

```css
.quote.has-cat::before { background: var(--cat); }
.quote.is-fav::before  { background: var(--gold); }   /* last: favorite wins */
```

Both selectors are 0-2-0, so **source order alone decides which colour a card that is both
categorized and starred gets**. Favorite wins deliberately: there is one marker and two things want
it, and the category is still legible on its own chip while the star isn't repeated anywhere else.

Three constraints shaped this, in case a future change tempts you back:

- **Not `border-left`** — a real border shifts the card's inner content 3px and misaligns it
  against every unmarked card.
- **Not an inset `box-shadow`** either, which is what it used to be. An inset shadow follows the
  card's `border-radius`, and once the radius went to 16px it tapered into a crescent at both
  corners. Invisible at 8px, obvious at 16px.
- Keeping the marker off `box-shadow` leaves that property free to carry elevation alone, which is
  why no state has to re-state the hover lift. If you ever move the marker back onto `box-shadow`,
  every marked state needs its own `:hover` rule re-stating *both* shadows or the lift disappears.

One more that saves time: the global `button:hover` is 0-1-1, which loses to any two-class rule.
That is why `.meta .cat` keeps its category colour on hover instead of turning accent-red.

## Layout coupling above the list

`#filter` (favorites) and `#categories` (groups) sit between the compose form and the list, and
their spacing is coupled. `#filter` carries a negative top margin to tuck under the form; when it's
empty, `#categories` has to take that job over:

```css
#filter:empty + #categories { margin-top: -1.25rem; }
#filter:not(:empty) + #categories { margin-top: -.75rem; }
```

If you change either margin, screenshot **both** states — with and without favorites — because
getting one right routinely breaks the other. `:empty` only matches when the host has literally no
children, which holds because `render()` clears with `textContent = ''`.

## Adding markup for a design change

`app.js` builds every node with the `el(tag, className, text)` helper and sets text via
`textContent`. **Never `innerHTML`** — quotes are arbitrary pasted text. To attach styling hooks,
add classes with `classList.add()` as `renderQuote` does. Rendering is a full rebuild with no
diffing, so there is no state to keep in sync; just make `render()` produce the right classes.

## Gotchas

- **`chrome.exe` cannot resolve MSYS paths.** `mktemp -d` returns `/tmp/tmp.XXXX`, and passing that
  to Chrome gives `ERR_FILE_NOT_FOUND`. Everything handed to Chrome goes through `cygpath -m`
  first. The script does this; if you write your own invocation, remember it.
- **A failed load still produces a PNG.** Chrome screenshots its own dark error page, so the script
  exiting 0 is not proof. File size is the tell — the real app is ~90KB, the error page ~16KB. The
  script now fails loudly under 40KB, but always open the image.
- **The seeder must sit beside `index.html`.** Chrome scopes `file://` localStorage by directory; a
  seeder elsewhere writes to a bucket the app cannot read. This is the same sharing behaviour that
  made the `quotesapp.v1` key namespace necessary in the first place.
- **Two Chrome invocations, not one.** `app.js` reads `localStorage` at load, so the data has to
  already be there. Seeding and screenshotting in one page load cannot work; the script shares one
  `--user-data-dir` across both runs instead.
- **Inset shadows taper on rounded corners.** An `inset` box-shadow follows `border-radius`, so any
  edge marker drawn that way pinches into a crescent as the radius grows. This is the kind of thing
  only a screenshot catches — it looked fine in the CSS and fine at the old radius.
- **Radius, shadow and spacing come from variables.** `--r-lg/md/sm` and `--shadow-1/2` are defined
  once at the top. Change those rather than hand-tuning individual rules, or the page drifts out of
  proportion with itself.
