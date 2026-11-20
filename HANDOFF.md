# Handoff — Ideogrammar (fork DigitalBeer/ideogrammar)

Folder: `D:\aitools\ideogrammar-fork\ideogrammar-fork` · branch `template-cast` (from `main`, nothing committed yet; left checked out so the user can try it through their proxy)

## Goal
Browser editor for Ideogram 4 / Moss Image JSON prompts, with style templates, Dynamic-Prompts wildcards,
AI generate/refine, and rendering through the user's own ComfyUI workflows via `comfy_proxy.py`.

## State
- All PRs up to #19 are merged; no open PRs. Untracked `start-proxy.bat` is the user's own file: never commit it.
- Recent work, all merged and tested in the preview (mocked AI replies where an AI model was needed):
  - Settings backup to proxy DB (`prefs-sync.js`, `/ideogrammar/prefs` in `comfy_proxy.py`).
  - Lists + templates in one window, list subcategories, template categories, `__` list autocomplete (`wildcards-studio.js`, `wildcards-ui.js`).
  - Template-aware Improve/Generate/Refine (`wcLinkGenerated`, `wcAfterRefine`, `wcStripWearing` in `wildcards-ui.js`).
  - Plain-sentence captions (`proseClause`/`joinDescExtras` in `llmcore.js`, toggle `#proseCaptions`), overlap warnings (`wcTemplateOverlaps`), tag check (`checkTags` in `index.html`).

- On branch `template-cast`, uncommitted, tested in the preview (renders and AI replies mocked):
  - Template casts: `wildcards-cast.js` (new). `cast` array on templates; `wcApplyCast` (called from `wcApplyTemplateTo`),
    `wcRollCast` (called at the start of `wcRollInto`), `wcCastEdited` (moved/resized/locked = user's own). Editor section in
    `wcOpenTemplateEditor`; casts on built-ins sports-broadcast, street-photo, concert. Saved via `el.wild.cast` (`normElWild`, `elWildOut`).
  - Background vs high-level description: `wcSyncSetting` appends/replaces a "Setting: …" sentence from a rolled background
    (`st.wild.setting`, menu toggle "Description follows rolled background"); `wcStripSetting` after Generate with a template
    that rolls the background; consistency rule added to `SYSTEM_PROMPT` (llmcore.js); `wcRefineDirective` mentions the sentence.
  - List categories: click a category name to rename/move/delete it (`wcCategoryEditor`, `wcMoveCategory`, `wcForgetCategory`);
    renames rewrite `__cat/…__` references in templates, lists and rules.
  - 🖼 Render previews button (Templates footer, `wcRenderPreviews` in wildcards-wizard.js): applies each template to the current
    setup, renders through the user's ComfyUI workflow, stores the result as its preview.
  - help.html updated for all four.

## Not done
- None of the above run against the user's real ComfyUI or AI model.
- Template/AI features never run against the user's real AI model (a llama.cpp server on the LAN, port 8080).

## Next steps
1. needs user: try the `template-cast` branch through their proxy (casts, category editing, setting sentence), then say
   "commit" / "push + PR".
2. needs user: press 🖼 Render previews in the Templates window (uses their ComfyUI and GPU; one render per template).
3. needs user: run one Improve → Generate → Refine with their real model and report results.

## To resume
- Tests: `node --test tests/*.test.mjs` (20 pass; they cover the wildcard engine only, not casts). Syntax check of inline JS: extract `<script>` blocks and run `node --check`.
- Preview: `.claude/launch.json` → `ideogrammar` (static, port 8791). For proxy features, run `comfy_proxy.py --port 8793 --db-path <scratch db>`;
  never point tests at the user's real DB (`.ideogrammar.db`) or proxy (port 8189).
- The user's proxy serves files from this folder: whatever branch is checked out is what they see. Switch back to `main` after work.
- Work on a feature branch; push and open a PR only when the user says "push + PR"; the user merges.
  Auto-fix watches PRs. Do not stack PRs (#14 merged into its base branch, not main).

## Do not redo
- Lists hold bare values; linking words go in template fields (lists stay reusable).
- Separate side-by-side dialogs failed (editor opened behind lists); one window (`studioOverlay`) replaced them.
- Rolls clear palettes set by an earlier roll (`palRolled`); hand-picked palettes stay.
- Proxy rewrites Origin (ComfyUI 403s otherwise); `/object_info/<class>` per class (the full one is 22 MB).
