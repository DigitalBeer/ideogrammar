# Handoff — ideogrammar fork (Moss Image support)

Project: fork `DigitalBeer/ideogrammar` (upstream `rlemson7/ideogrammar`), branch `moss-image-export`.
Local clone: inside the Claude session folder `ideogrammar/` (temporary — deleted with the session).

## Goal
Make the Ideogram prompt editor also produce Moss Image JSON prompts, matching the official ComfyUI
KJNodes builders, and improve the LLM Generate/Refine tools.

## Done (all in `index.html`, `llmcore.js`, `README.md`)
- Moss export/import, Copy/Download per model, Moss-only aspect ratios, MP control in layout header.
  Checked: byte-identical to KJNodes `Ideogram4PromptBuilderKJ` / `MossImagePromptBuilderKJ` functions on the same boxes.
- Full-frame Moss `panel` restored (default on, toggle "Moss frame panel") — fixed borders/black bars; user confirmed in ComfyUI.
- Lossless editor round trips (labelled caption parts, `_editor.elements`, role tags), optional Indented copy.
- Generate/Refine: target-model guidance, locks, review (Before/After table) + undo, layout check & fixes,
  variations picker, refine-only-selected, grouped/combined quick changes, saved presets, Generate options,
  improve description, ask-first questions, templates, Subjects-only image mode.
  Checked: browser tests with a mocked LLM only.

## Not done
- No run against the user's real LLM for the Generate/Refine features (only mock-tested).
- No PR from `moss-image-export` to the fork's `main`.

## Git (as of last check)
- Working tree clean; branch up to date with `origin/moss-image-export` (last commit a49d588). No open PRs.

## Next steps
1. needs user: test the latest features in a local clone: `git pull` on `moss-image-export`, open `index.html`
   (or run `comfy_proxy.py` for ComfyUI mode), try the test steps in `README.md` → "AI changes" / "More Generate & Refine tools".
2. Fix anything the real model breaks (prompts live in `llmcore.js` `SYSTEM_PROMPT` and `index.html` `TARGET_GUIDANCE`).
3. needs user: decide whether to open a PR into the fork's `main`
   (`gh pr create --repo DigitalBeer/ideogrammar --base main --head moss-image-export --fill`).
4. Optional ideas not built: none outstanding from the agreed list.

## To resume
- Static preview for manual mode: `python -m http.server 8765 -d ideogrammar` → http://localhost:8765
  (hard-refresh; ComfyUI mode needs `comfy_proxy.py`).
- Commits/pushes only to `moss-image-export` on the fork; never push upstream; PRs need user approval.

## Do not redo
- Moss output follows the KJ nodes, EXCEPT the full-frame `panel` (needed: Moss infers the frame from box extents).
- Copy is compact JSON by default (official default); indented is opt-in.
- Ideogram official types are `obj`/`text` only; editor keeps richer types via `_editor` and subject inference.
- Python edits via heredoc broke on quoting in this shell — write scripts to a file and run them.
- Inline `\n` written through Python non-raw strings became real newlines in JS once — check escapes.
