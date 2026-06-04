# MIRAGE Standalone - Progress

> **Living Memory Document**: Updated at every development step.

---

## Current Status

- **Project**: MIRAGE Standalone
- **Phase**: Phase 5 - deployed and hardened
- **Current Task**: live on mirage.matheus.wiki; remaining optional work is Git auto-deploy + flipping the repo public
- **Last Updated**: 2026-06-04
- **Tests Passing**: yes (full 30-model sweep: 0 validation errors, 29/30 generate; realvisxl2-lcm is a slow cold-boot)

---

## Service Status

- Cloudflare Pages: live at mirage.matheus.wiki and mirage-56j.pages.dev (project `mirage`, direct-upload); auto-deploys on push to main via GitHub Actions
- Replicate API: token configured on the Pages project, production generations succeed
- Target domain mirage.matheus.wiki: live with valid SSL
- Rate limiting: RATE_LIMIT_KV bound in production, 20/hr per IP confirmed firing

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
- [x] Optional KV-based per-IP rate limit
- [x] Async create: Prefer: wait=10 on create, returns { id, status, output }
- [x] functions/api/status.js: GET /api/status?id= proxies prediction state, token stays server-side

### Phase 3: Rewire frontend
- [x] API URLs swapped (single POST /api/generate per model)
- [x] Frontend polls /api/status until succeeded (up to 6 min) so slow models do not hit the edge timeout
- [x] submit_session_data removed
- [x] taigacreatepost removed
- [x] get-images removed (Replicate URLs go direct to browser)

### Phase 4: Polish
- [x] README.md with deploy steps and cost/abuse warning
- [x] DEPLOY.md with detailed Cloudflare Pages walkthrough
- [x] Pushed to GitHub (matheusmaldaner/mirage, private, main branch, correctly attributed)
- [x] Local end-to-end smoke test passed via `wrangler pages dev`
- [x] Cloudflare Pages project live (direct upload)
- [x] Replicate token added as env var
- [x] mirage.matheus.wiki DNS pointed
- [x] First production generation
- [x] Auto-deploy on push wired via GitHub Actions (.github/workflows/deploy.yml runs wrangler pages deploy)
- [ ] Repo flipped to public (when ready)

### Phase 5: Open-source readiness and fixes
- [x] Repointed dead HCOMP'24 PDF link to arxiv 2503.19252
- [x] Stripped UNISINOS study framing from public instructions-pt.html (study version kept in gitignored local/)
- [x] Untracked audit/ and orphaned model-teaser images (kept on disk, gitignored)
- [x] Swapped README banner svg to png
- [x] Fixed 6 dead model versions (flux-1.1-pro, recraft-v3, sd-3.5-large, luma/photon, luma/photon-flash, aura-flow)
- [x] Added prompt-first input path for newer official models that reject legacy params
- [x] Fixed results never displaying (#model-container display:none was never lifted)
- [x] Reworked generation to async create + status polling
- [x] Fixed input 422s: send only { prompt } + each model's correct count field clamped to its real max (num_outputs capped at 4); full 30-model sweep verified

---

## Completed Tasks

- Project tree created - 2026-05-29 - mirage/, src/, functions/, public/ scaffolded
- PLAN.md written - 2026-05-29 - per CarnegieMellon CLAUDE.md format
- PROGRESS.md initialized - 2026-05-29
- Open-source readiness audit + fixes - 2026-06-03 - dead link, PT study text, audit/ untracked, cost warning
- Model catalog repair - 2026-06-03 - 6 official models had dead version pins and prompt-first schemas, all verified against Replicate
- Display bug fix - 2026-06-03 - revealed hidden #model-container so results render
- Async rework - 2026-06-03 - /api/generate + /api/status, frontend polling, removes slow-model timeout
- Production deploy - 2026-06-03 - direct upload of clean git archive to Pages project mirage, verified live
- Input/count 422 fix - 2026-06-04 - many models now cap num_outputs at 4 or use different count fields; switched to minimal { prompt } + per-model count, verified across all 30 models, redeployed
- realvisxl2-lcm warm-up note - 2026-06-04 - added an italic EN/PT hover note instead of dropping the slow model
- Auto-deploy via GitHub Actions - 2026-06-04 - .github/workflows/deploy.yml deploys to Pages on push to main; secrets CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID set
- Perceived latency optimizations - 2026-06-04 - Refactored model preloader to only fetch teasers; localized teaser images to eliminate 3rd-party CDN latency/expiration; removed unused jQuery/Poppins; added progressive reveal (wait-for-all=false) and async/lazy image loading to improve LCP/CLS
- SEO Visibility & Growth Audit (P0 fixes) - 2026-06-04 - Generated SEO_AUDIT.md; added robots.txt, sitemap.xml, llms.txt; injected canonical, OG, and Twitter metadata into all HTML pages; gated deployment on SEO files.

---

## Decisions Log

- Static-first approach over React SPA - 2026-05-29 - existing UI is already vanilla HTML + JS, no value in rewriting in React, lower complexity for self-hosters
- Drop NexHacks liquid-glass reskin per operator direction - 2026-05-29 - preserve continuity with the paper demo
- Synchronous /api/generate for v1 - 2026-05-29 - simpler code, accept timeout risk on slow models (revisited 2026-06-03)
- Rate limiting is opt-in via KV binding presence - 2026-05-29 - self-hosters who do not need limits should not have to configure KV
- Switch to async create + poll - 2026-06-03 - slow batch models (aura-flow at 8 images ~4 min) exceeded Cloudflare's edge timeout; polling /api/status removes the ceiling without capping or fan-out
- Prompt-first input path for newer official models - 2026-06-03 - flux/recraft/sd3.5/luma/aura-flow reject scheduler/guidance/steps/num_outputs/negative_prompt; send only params they accept
- Keep aura-flow uncapped - 2026-06-03 - async handles its long runtime, so no need to cap or drop it
- Deploy via direct wrangler upload - 2026-06-03 - Pages project is not Git-connected, so push does not auto-deploy; upload a clean git archive to avoid shipping untracked secrets
- Minimal { prompt } + count input over a fixed param blob - 2026-06-04 - Replicate tightened many model schemas (num_outputs max 4, different count keys, dropped params); sending only prompt + the model's own count field lets each model use its defaults and avoids 422s
- Request 4 images instead of 8 - 2026-06-04 - Replicate caps most models at 4, so 4 keeps the comparison grid uniform and halves aura-flow runtime

---

## Risk Register

- Replicate model versions deprecate - medium - materialized: 6 official models had dead version pins, fixed 2026-06-03; recheck periodically - mitigated
- Pages Function timeout on slow models - medium - resolved by async create + status polling, no request stays open long - resolved
- Replicate cost overrun on live demo - medium - per-IP rate limit + documented cap + cost/abuse warning in README - mitigated
- No auto-deploy - low - resolved 2026-06-04 via GitHub Actions (.github/workflows/deploy.yml); push to main now deploys automatically - resolved
- Cloudflare token rotation breaks CI - low - the deploy token is also the CLOUDFLARE_API_TOKEN repo secret; after rotating, update the secret with `gh secret set CLOUDFLARE_API_TOKEN` or auto-deploy fails - watching
- realvisxl2-lcm slow cold-boot - low - creates without error but did not finish within 200s twice; async gives it 6 min, but a cold first user may time out; redundant with other realvisxl variants so a drop candidate - watching

---

## Session Notes

### Session: 2026-05-29
**Completed**: project plan and progress doc
**Current State**: skeleton on disk, no files copied yet
**Next Steps**: copy CSS, JS, images, templates from WeAudit-Mirage; strip Django template syntax; write the Pages Function; rewire frontend

### Session: 2026-06-03
**Completed**: open-source readiness fixes; repaired 6 dead model versions and their input schemas; fixed the hidden-results display bug; reworked generation to async create + /api/status polling; deployed to production via direct upload and verified mirage.matheus.wiki end-to-end
**Current State**: live and working on mirage.matheus.wiki, repo still private at fa26420
**Next Steps**: rotate the Cloudflare API token used for deploy; optionally connect Git integration for auto-deploy; flip repo public when ready

### Session: 2026-06-04
**Completed**: traced a second 422 class (models now cap num_outputs at 4, use different count keys, or reject sent params); reworked the function to send minimal { prompt } + per-model count; ran a full 30-model sweep (0 validation errors, 29/30 generate); redeployed and verified ssd-1b and stable-diffusion live
**Current State**: all 30 models validate on production at a3f8737; only realvisxl2-lcm is a slow cold-boot
**Next Steps**: decide whether to drop realvisxl2-lcm; rotate the Cloudflare token; connect Git for auto-deploy; flip public
