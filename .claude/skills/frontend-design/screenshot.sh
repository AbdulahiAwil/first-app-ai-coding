#!/usr/bin/env bash
# Render the Quotes App headlessly and write a PNG you can actually look at.
#
# The app has no server and no build, so there is nothing to "start" -- but it
# also shows an empty page unless localStorage has quotes in it. This seeds a
# realistic collection first, then screenshots the app against that same
# browser profile.
#
# Everything happens in a throwaway copy under $TMPDIR. The repo is never
# touched and no file is added to it.
#
# Usage:  bash .claude/skills/frontend-design/screenshot.sh [outfile.png] [WIDTHxHEIGHT]
set -euo pipefail

OUT="${1:-$PWD/../shot.png}"
SIZE="${2:-1100x1400}"
W="${SIZE%x*}"; H="${SIZE#*x}"

# Run from the project root -- the three files must be siblings.
for f in index.html app.js style.css; do
  [ -f "$f" ] || { echo "error: $f not found. Run this from the project root." >&2; exit 1; }
done

CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
[ -x "$CHROME" ] || CHROME="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
[ -x "$CHROME" ] || { echo "error: chrome.exe not found at either Program Files path." >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/app" "$WORK/profile"
cp index.html app.js style.css "$WORK/app/"

# chrome.exe is a native Windows binary and cannot resolve the MSYS paths that
# mktemp hands back (/tmp/tmp.XXXX). Everything passed to Chrome -- URLs and
# --user-data-dir alike -- goes through cygpath -m first, which yields a
# Windows path that still uses forward slashes, exactly what file:// wants.
WIN_WORK="$(cygpath -m "$WORK")"

# The seeder must sit beside index.html: Chrome scopes file:// localStorage by
# directory, so a seeder anywhere else writes to a bucket the app cannot read.
cat > "$WORK/app/seed.html" <<'SEEDEOF'
<!doctype html><meta charset="utf-8"><title>seed</title><body><pre id="o">seeding</pre><script>
var now = new Date().toISOString();
function q(id, text, author, source, category, note, fav, day) {
  return { id:id, text:text, author:author, source:source, note:note, link:'',
           category:category, tags:[], favorite:fav, favoritedAt: fav?now:'',
           createdAt:'2026-07-'+day+'T10:00:00.000Z', updatedAt:now };
}
// Deliberately covers: two categories with >1 member (so counts show), a
// single-member category, an uncategorized quote (so that chip appears), and
// two favorites -- one of which is also categorized, which is the only way to
// see that the gold edge outranks the category edge.
var data = { version:1, quotes:[
  q('s1','The unexamined life is not worth living.','Socrates','Apology','Philosophy','Kept coming back to this one.',true,'20'),
  q('s2','Simplicity is the soul of efficiency.','Austin Freeman','','Craft','',false,'21'),
  q('s3','Labo qaawan isma qaado','','Maah-maah','Proverbs','Two naked people cannot carry each other.',false,'22'),
  q('s4','We are what we repeatedly do. Excellence, then, is not an act, but a habit.','Will Durant','The Story of Philosophy','Philosophy','',true,'23'),
  q('s5','Make it work, make it right, make it fast.','Kent Beck','','Craft','',false,'24'),
  q('s6','A quote with no category at all, to prove the Uncategorized chip appears.','','','','',false,'25')
]};
try {
  localStorage.setItem('quotesapp.v1', JSON.stringify(data));
  document.getElementById('o').textContent = 'OK ' + JSON.parse(localStorage.getItem('quotesapp.v1')).quotes.length;
} catch (e) { document.getElementById('o').textContent = 'FAIL ' + e.message; }
</script></body>
SEEDEOF

# Two invocations sharing one profile. A single load cannot work: the page has
# to already have data when app.js runs, and app.js reads localStorage at load.
WIN_OUT="$(cygpath -m "$(mkdir -p "$(dirname "$OUT")" && cd "$(dirname "$OUT")" && pwd)")/$(basename "$OUT")"

"$CHROME" --headless=new --disable-gpu --user-data-dir="$WIN_WORK/profile" \
  --window-size=600,200 --screenshot="$WIN_WORK/seed.png" \
  "file:///$WIN_WORK/app/seed.html" >/dev/null 2>&1

"$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$WIN_WORK/profile" \
  --window-size="$W,$H" --screenshot="$WIN_OUT" \
  "file:///$WIN_WORK/app/index.html" >/dev/null 2>&1

[ -s "$OUT" ] || { echo "error: no screenshot produced at $OUT" >&2; exit 1; }
# A page that failed to load still yields a PNG -- Chrome screenshots its own
# error page. Size is the cheap tell: the real app is ~90KB, the dark
# ERR_FILE_NOT_FOUND page is ~16KB.
BYTES=$(wc -c < "$OUT" | tr -d ' ')
[ "$BYTES" -gt 40000 ] || {
  echo "warning: $OUT is only ${BYTES} bytes -- that is probably Chrome's error page, not the app." >&2
  exit 1
}
echo "wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes, ${W}x${H})"
