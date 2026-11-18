# Handoff — ideogrammar fork (Moss Image support, style templates & wildcards)

Project: fork `DigitalBeer/ideogrammar` (upstream `rlemson7/ideogrammar`).
Local clone: `D:\aitools\ideogrammar-fork\ideogrammar-fork`.
Branches: `moss-image-export` (Moss work, pushed) → `wildcards-templates` (this work, cut from it; local only).

## Goal
Make the Ideogram prompt editor also produce Moss Image JSON prompts, matching the official ComfyUI
KJNodes builders, and improve the LLM Generate/Refine tools. Then add menu-driven style templates and a
Dynamic-Prompts-style wildcard system that work in both formats.

## Done on `moss-image-export`
- Moss export/import, Copy/Download per model, Moss-only aspect ratios, MP control in the layout header.
  Checked: byte-identical to the KJNodes `Ideogram4PromptBuilderKJ` / `MossImagePromptBuilderKJ` functions on the same boxes.
- Full-frame Moss `panel` restored (on by default, "Moss frame panel" toggle). This fixed the borders and black bars; user confirmed in ComfyUI.
- Lossless editor round trips (labelled caption parts, `_editor.elements`, role tags), optional Indented copy.
- Generate/Refine: target-model guidance, locks, review (Before/After table) + undo, layout check & fixes,
  variations picker, refine-only-selected, combined quick changes, saved presets, Generate options,
  improve description, ask-first questions, templates, Subjects-only image mode.

## Done on `wildcards-templates`
- `wildcards.js`: engine (Dynamic Prompts syntax + guards, chance, rules, unique lists, per-slot / per-field
  salts, YAML reader). `node --test tests/*.test.mjs`: 20 tests pass.
- `wildcards-data.js`: 48 starter lists, 3 rules, 12 templates. Venue and sportswear follow `${sport}` via guards.
- Data model: per-element `style` (lighting, camera, lens, wardrobe, pose, environment, mood, details) exported
  as labelled sentences in the Ideogram desc / Moss caption and split back out on import. `wild` (sources, seed,
  locks, salts) is saved in state, setups and the Ideogram download's `_editor`.
- `wildcards-ui.js`: Roll button + menu, Templates picker/editor, element Style section, picks popover
  (lock / re-roll pick or variable / detach), Wildcard manager (lists, rules, syntax, import/export
  .txt/.yaml/.json/.zip), AI polish, Roll ×N, batch ZIP, auto-roll before copy/download/render,
  queue re-roll, wildcards in the Generate description, Style template in Generate options, folder sync.
- `comfy_proxy.py`: `/ideogrammar/wildcards[/<path>]` and `/ideogrammar/templates[/<name>.json]`
  (`--wildcards-dir`, `--templates-dir`).
- README: "Style templates & wildcards" section with test steps.
- Follow-up: built-in Help (`help.html`, header **?**, Help buttons in the modals), 🧭 Template wizard with
  per-field list suggestions, template preview images (upload / current render; stored in
  `ideogrammar.tplPreviews`, included in export and folder sync), "Rolls from" list chips on template cards
  and "Used by templates" in the list editor (`wildcards-wizard.js`).
- Checked in the browser: template apply + review, roll / lock / re-roll, both exports clean of raw syntax,
  Ideogram download and Moss round trips, ZIP (stored + deflate) import/export, YAML import, batch ZIP,
  AI polish with a fake model (review + undo), Roll ×N, template editor, rules editor, and folder sync against a
  real proxy (push, pull, conflict prompt, deletes both ways, read-only YAML packs, path traversal refused).

## Not done
- No run against the user's real LLM: neither the Moss-era Generate/Refine features nor the wildcard AI polish (fake model only).
- `wildcards-templates` has no PR (pushed to the fork; later commits may not be). `moss-image-export` has no PR into the fork's `main`.
- The UI was checked in the desktop layout only, not on a phone-width screen.

## Next steps
1. needs user: try the "Style templates & wildcards → Testing it" steps in `README.md`, including AI polish with your model.
2. Fix anything the real model gets wrong (`WC_POLISH_PROMPT` in `wildcards-ui.js`; `SYSTEM_PROMPT` in `llmcore.js`).
3. needs user: push `wildcards-templates` and decide on PRs into the fork's `main`.

## To resume
- Static preview for manual mode: `python -m http.server 8765` in the clone → http://localhost:8765 (hard refresh).
  ComfyUI mode and folder sync need `comfy_proxy.py`.
- Commits/pushes only to the fork's branches; never push upstream; PRs need user approval.

## Do not redo
- Moss output follows the KJ nodes, EXCEPT the full-frame `panel` (needed: Moss infers the frame from box extents).
- Copy is compact JSON by default (official default); indented is opt-in.
- Ideogram official types are `obj`/`text` only; the editor keeps richer types via `_editor` and subject inference.
- `js-yaml` couldn't be downloaded (blocked), so `wildcards.js` has its own small YAML reader for wildcard packs.
- `wildcards-ui.js` runs after the inline script and shares its globals (`state`, `render`, `proposeChange`…);
  top-level names there must not clash with `index.html` (everything is prefixed `wc`).
- Python edits via heredoc broke on quoting in this shell — write scripts to a file and run them.
- Inline `\n` written through Python non-raw strings became real newlines in JS once — check escapes.
