# MIRAGE Standalone - Progress

> **Living Memory Document**: Updated at every development step.

---

## Current Status

- **Project**: MIRAGE Standalone
- **Phase**: Phase 0 - skeleton
- **Current Task**: writing project files
- **Last Updated**: 2026-05-29
- **Tests Passing**: n/a (no tests yet)

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
- [ ] README.md
- [ ] LICENSE
- [ ] .env.example
- [ ] .gitignore
- [ ] Port model catalog

### Phase 1: Static port
- [ ] CSS copied
- [ ] Images copied
- [ ] base.html ported
- [ ] landing_page.html ported
- [ ] instructions_english.html ported
- [ ] compare_models_english.html ported
- [ ] Auth UI stripped
- [ ] Forum links stripped

### Phase 2: Pages Function
- [ ] generate.ts wiring
- [ ] Replicate sync call
- [ ] Rate limit
- [ ] Response shape matching existing JS

### Phase 3: Rewire frontend
- [ ] API URLs swapped
- [ ] Multi-call pattern collapsed
- [ ] submit_session_data removed
- [ ] taigacreatepost removed

### Phase 4: Polish
- [ ] README deploy steps
- [ ] First successful end-to-end generation
- [ ] Pushed to GitHub (matheusmaldaner/mirage)
- [ ] mirage.matheus.wiki DNS pointed

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
