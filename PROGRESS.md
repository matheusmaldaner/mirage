# MIRAGE Standalone - Progress

> **Living Memory Document**: Updated at every development step.

---

## Current Status

- **Project**: MIRAGE Standalone
- **Phase**: Phase 4 - polish
- **Current Task**: awaiting Cloudflare Pages connect (manual step in CF dashboard)
- **Last Updated**: 2026-05-29
- **Tests Passing**: local wrangler smoke test PASS (static + function wiring verified)

---

## Service Status

- Cloudflare Pages: not deployed yet
- Replicate API: pending token + first call
- Target domain mirage.matheus.wiki: not pointed yet

---

## Phase Checklist

### Phase 0: Skeleton
- [x] Project tree
- [x] PLAN.md
- [x] PROGRESS.md
- [x] README.md
- [x] LICENSE (MIT)
- [x] .env.example
- [x] .gitignore
- [x] Port model catalog (js/constants.js verbatim from old)

### Phase 1: Static port
- [x] CSS copied (header, compare_models, models_display, report_form, scss/bootstrapmods)
- [x] Images copied (favicon, flags, gifs, onboarding, model-teasers)
- [x] Collapsed base.html + compare_models_english.html into single index.html (no Django blocks needed)
- [x] Auth UI stripped (no register/login)
- [x] Forum links stripped (no forum.weaudit.org references)
- [x] Removed multi-step report forms (Discourse-bound)

### Phase 2: Pages Function
- [x] functions/api/generate.js wiring
- [x] Replicate sync call via Prefer: wait, fallback poll
- [x] Optional KV-based per-IP rate limit
- [x] Response shape matching existing JS (`Status: Completed`, `ImageUrls: [...]`)

### Phase 3: Rewire frontend
- [x] API URLs swapped (single POST /api/generate per model)
- [x] Collapsed multi-call init+poll pattern into one synchronous fetch
- [x] submit_session_data removed
- [x] taigacreatepost removed
- [x] get-images removed (Replicate URLs go direct to browser)

### Phase 4: Polish
- [x] README.md with deploy steps
- [x] DEPLOY.md with detailed Cloudflare Pages walkthrough
- [x] Pushed to GitHub (matheusmaldaner/mirage, private, main branch, correctly attributed)
- [x] Local end-to-end smoke test passed via `wrangler pages dev`
- [ ] Cloudflare Pages project connected (manual step)
- [ ] Replicate token added as env var
- [ ] mirage.matheus.wiki DNS pointed
- [ ] First production generation
- [ ] Repo flipped to public (when ready)

---

## Completed Tasks

- Project tree created - 2026-05-29 - mirage/, src/, functions/, public/ scaffolded
- PLAN.md written - 2026-05-29 - per CarnegieMellon CLAUDE.md format
- PROGRESS.md initialized - 2026-05-29

---

## Decisions Log

- Static-first approach over React SPA - 2026-05-29 - existing UI is already vanilla HTML + JS, no value in rewriting in React, lower complexity for self-hosters
- Drop NexHacks liquid-glass reskin per operator direction - 2026-05-29 - preserve continuity with the paper demo
- Synchronous /api/generate over async polling for v1 - 2026-05-29 - simpler code, accept timeout risk on slow models, revisit if needed
- Rate limiting is opt-in via KV binding presence - 2026-05-29 - self-hosters who do not need limits should not have to configure KV

---

## Risk Register

- Replicate model versions deprecate - low - bump version hash in constants.js - watching
- Pages Function timeout on slow models (Aura Flow 25s, SD3.5L 9s) - medium - synchronous call may exceed Pages Function CPU budget - watching
- Replicate cost overrun on live demo - medium - per-IP rate limit + documented cap - mitigated

---

## Session Notes

### Session: 2026-05-29
**Completed**: project plan and progress doc
**Current State**: skeleton on disk, no files copied yet
**Next Steps**: copy CSS, JS, images, templates from WeAudit-Mirage; strip Django template syntax; write the Pages Function; rewire frontend
