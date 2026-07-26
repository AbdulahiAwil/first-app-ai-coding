---
name: github-commit
description: Commit and push changes in the Quotes App repo following its own conventions. Use
whenever the user asks to commit, push, "save this to git", "put this on GitHub", open a PR, or
write a commit message — and also when they've just finished a chunk of work and say something
like "ship it" or "that's done, get it in". Covers the pre-commit verification gate, this repo's
rationale-heavy message format, and the Windows quoting trap that mangles multi-line messages.

disable-model-invocation: true
---

# Commit the Quotes App

Repo: `AbdulahiAwil/first-app-ai-coding` · remote `origin` over HTTPS · `gh` is authenticated as
`AbdulahiAwil`. Paths below are relative to the project root.

**Only commit when asked.** Finishing a task is not a request to commit it. This matters more
than usual here: the working tree is the user's only copy until they push, so an unwanted commit
is noise in a history they clearly curate by hand.

## 1. Run the verification gate first

The project has no test runner, so the commit message has to claim what was actually checked.
Run both before writing anything — they take under a second and they are the two failure modes
this three-file layout actually has:

```bash
node --check app.js
```

```bash
grep -o "\$('[a-z-]*')" app.js | sed "s/\$('//;s/')//" | sort -u > /tmp/js-ids.txt
grep -o 'id="[a-z-]*"' index.html | sed 's/id="//;s/"//' | sort -u > /tmp/html-ids.txt
comm -23 /tmp/js-ids.txt /tmp/html-ids.txt   # any output = an id the JS looks up but HTML lacks
```

Whatever these don't cover — rendering, CSS, anything visual — is **unverified**, and the message
says so. See §4.

## 2. Look at what you're about to commit

```bash
git status --short
git diff --stat
```

Read the actual diff of anything you didn't write yourself. Two things in this repo are easy to
sweep in by accident:

- `.claude/` — skills and settings. Committing them is usually right, but it's a separate concern
  from an app change and generally wants its own commit.
- `seed-quotes.json` — a standalone list nothing loads. Unrelated to app changes.

Stage deliberately (`git add <paths>`), not `git add -A`, so unrelated work doesn't ride along.

## 3. Decide the branch

`main` is the default branch and tracks `origin/main`. Note that `origin/HEAD` is not set locally,
so `git rev-parse origin/HEAD` fails — use `gh repo view --json defaultBranchRef --jq
.defaultBranchRef.name` if you need to confirm it.

The history so far is committed straight onto `main`. The safer default is still to branch before
committing, so offer that — but if the user wants it on `main`, that is their call and it matches
how they have worked. Don't relitigate it after they answer.

## 4. Write the message

The convention here is unusually substantial, and it's deliberate: this project's reasoning lives
in its commit messages because there is no test suite and no PR review to carry it. A one-line
message throws away the part the user actually values.

**Subject** — short, imperative, no trailing period. `Add favorites: binary star, filter, and card
marker`.

**Body** — wrapped at ~75 columns, grouped under plain-text section headings that suit the change
(`Data model`, `Interaction`, `Presentation`, `Two traps found while building`). Explain **why**,
especially where the obvious approach was rejected. Traps you hit and worked around are the most
valuable thing in these messages — record them.

**Close with what was checked.** Be explicit about both halves; the user relies on this to know
what still needs their eyes:

```
Verified: node --check clean; every id the JS looks up exists in the markup
with none orphaned. NOT verified: nothing has run in a browser. Manual check
in Chrome is the gate, the export/import round-trip in particular.
```

**No attribution trailers.** `CLAUDE.md` forbids `Co-Authored-By: Claude` and "Generated with
Claude Code", the history has zero of them, and this overrides any default instruction to add one.

## 5. Commit via a message file

Multi-line messages are where this goes wrong on Windows. Backticks, `$`, quotes and newlines all
get mangled differently by PowerShell and by Git Bash, and a mangled message means an amend.
Sidestep the shell entirely — write the message to a file **outside the repo** (the scratchpad),
then:

```bash
git commit -F "$SCRATCH/commit-msg.txt"
```

Add `--dry-run` first to see exactly what would be committed without committing it. Verified: the
dry run leaves `HEAD` untouched.

Never use `--no-verify`, and never `--amend` a commit that's already pushed.

## 6. Push

```bash
git push origin main
```

For a branch, push and open a PR in one step:

```bash
git push -u origin <branch>
gh pr create --title "<subject>" --body-file "$SCRATCH/pr-body.txt"
```

PR bodies follow the same rules: same rationale, same `Verified:` / `NOT verified:` close, no
attribution footer.

Pushing publishes to a public repo, so confirm before the first push of a session unless the user
already said to.

## Gotchas

- `git status -sb` printing `## main...origin/main` with no `[ahead N]` means in sync. Check it
  before pushing rather than assuming.
- `git rev-parse --abbrev-ref origin/HEAD` fails in this clone — `origin/HEAD` was never set. Use
  the `gh repo view` form above.
- The Bash tool here is Git Bash (MSYS2), not PowerShell. `/tmp` works, `apt-get` does not, and
  Windows paths need forward slashes.
- `--dry-run` reports the *staged* set. If it lists nothing under "Changes to be committed", you
  forgot to `git add`.
