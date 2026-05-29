# MIRAGE Standalone

**Project**: Open-source standalone of MIRAGE (Multi-model Interface for Reviewing & Auditing Generative Text-to-Image AI), reusing the existing Mirage UI from the CMU/WeAudit research codebase but with the AWS Lambda + S3 + DynamoDB + Discourse backend replaced by a single Cloudflare Pages Function that calls the Replicate API directly.

**Duration**: ~1 working session for v1
**Team Size**: 1

> **Current Status**: See [PROGRESS.md](./PROGRESS.md) for live tracking.

---

# Project Overview

## The Problem
1. The current Mirage demo runs on AWS infrastructure that is being shut down after a breach.
2. The current code expects an AWS account, Lambda functions, S3 buckets, DynamoDB tables, and a live Discourse forum.
3. We want one open-source repo a researcher can clone, drop in a Replicate token, deploy to Cloudflare Pages for free, and have a working Mirage demo at their own URL within minutes.

## The Solution
Copy the existing Mirage HTML, CSS, JavaScript, and model catalog verbatim. Replace every call to `vtsuohpeo0.execute-api.us-east-1.amazonaws.com/Prod/*` with a call to `/api/generate`, served by a Cloudflare Pages Function that holds the Replicate token and applies a per-IP rate limit. Drop user accounts, drop the forum integration, drop the session data capture. Images come from Replicate's CDN and live only in the browser tab.

---

# Core Features

## 1. Model comparison grid
User types a prompt, picks up to 4 models from the existing 27-model catalog, hits Generate, sees a grid of 8 images per model rendered from Replicate URLs. Identical to the existing `compare_models_english.html` flow.

## 2. Replicate proxy with rate limit
Single Pages Function at `/api/generate`. Accepts `{ model_id, version, prompt, num, params }`. Server holds the Replicate API token (env var `REPLICATE_API_TOKEN`). Per-IP rate limit via Cloudflare KV namespace (env var `RATE_LIMIT_KV`). Default cap configurable (env var `RATE_LIMIT_PER_HOUR`, default 20). Rate limit is opt-in: if no KV binding exists, the proxy passes through without limiting (useful for self-hosters who do not need it).

## 3. Self-host fork story
README walks a fork through: get a Replicate token, fork the repo, connect it to Cloudflare Pages, set the env var, deploy. No CMU-specific URLs, no AWS, no Docker, no Django, no Python.

---

# Technical Architecture

```
+----------------------+          +-----------------------+
| Browser (mirage.     |  POST    | Cloudflare Pages      |
| matheus.wiki)        | /api/    | Function              |
| - prompt + models    | generate | functions/api/        |
| - shows result grid  | -------> | generate.ts           |
+----------------------+          |  - read env token     |
        ^                         |  - check KV rate limit|
        |                         |  - call Replicate     |
        |  image URLs             +----------+------------+
        |  (Replicate CDN)                   |
        |                                    v
        |                         +-----------------------+
        +-------------------------+ Replicate API         |
                                  | replicate.predictions |
                                  +-----------------------+
```

No database. No S3. No Discourse. No user accounts. Browser state is the only state.

---

# Implementation Phases

## Phase 0: Skeleton
- [ ] Project tree (functions/, public-or-root html/css/js)
- [ ] PLAN.md, PROGRESS.md, README.md, LICENSE (MIT), .env.example, .gitignore
- [ ] Port model catalog (`js/constants.js`) verbatim from WeAudit-Mirage

## Phase 1: Static port
- [ ] Copy CSS verbatim (header.css, compare_models.css, models_display.css, report_form.css, scss/bootstrapmods.css)
- [ ] Copy images directory verbatim
- [ ] Port `base.html` to plain HTML (remove Django `{% load static %}`, `{% block %}`, `{% if user.is_authenticated %}`)
- [ ] Port `landing_page.html` and `instructions_english.html` to plain HTML
- [ ] Port `compare_models_english.html` to plain HTML
- [ ] Strip register/login buttons from the header
- [ ] Strip forum-related links / scripts
- [ ] Optional: keep `text_to_image_arena.html`, `compare_models_portuguese.html`, `instructions_portuguese.html` for parity

## Phase 2: Pages Function
- [ ] `functions/api/generate.ts` accepting POST with model_id, version, prompt, num, params
- [ ] Replicate API call using fetch (no SDK), with model version pinning
- [ ] Synchronous wait via Replicate's polling pattern with sensible timeout
- [ ] Rate limit: read `RATE_LIMIT_KV` binding if present, key on `cf-connecting-ip` + hour bucket
- [ ] Return `{ output: [...image_urls] }` shape matching what the existing JS expects

## Phase 3: Rewire frontend
- [ ] In `compare_models_english.js`: replace all `https://vtsuohpeo0.execute-api...` URLs with `/api/generate`
- [ ] Collapse the multi-call pattern (start + poll + get-images) into one synchronous call
- [ ] Remove `submit_session_data` call (we are not collecting session data)
- [ ] Remove `taigacreatepost` call (no forum)
- [ ] Remove report-model button / report-form unless we want to keep an issue-link version

## Phase 4: Polish
- [ ] README with deploy steps for Cloudflare Pages
- [ ] `.env.example` with REPLICATE_API_TOKEN, RATE_LIMIT_PER_HOUR
- [ ] LICENSE (MIT)
- [ ] Self-test: pick a model, generate, confirm grid renders
- [ ] Optional: link to the CI'25 paper + HCOMP'24 WIP from README

---

# File Structure

```
mirage/
  README.md
  PLAN.md
  PROGRESS.md
  LICENSE
  .env.example
  .gitignore
  index.html              (landing)
  instructions.html
  compare.html            (the main app)
  arena.html              (optional)
  css/
    header.css
    compare_models.css
    models_display.css
    report_form.css
    scss/
      bootstrapmods.css
  js/
    constants.js          (27-model catalog, unchanged)
    compare.js            (renamed and reworked compare_models_english.js)
  images/
    favicon/
    (model teasers are remote Replicate URLs, no local copies needed)
  functions/
    api/
      generate.ts         (Cloudflare Pages Function: Replicate proxy + rate limit)
```

---

# Risk Analysis

## Critical Risks
- Replicate model versions go stale or get deprecated. Mitigation: bumping the version hash in `constants.js` is the only change needed, and the JS already falls back to default Stable Diffusion when a model fails.
- Cloudflare Pages Function CPU time limit (default 50ms wall, 10ms CPU; higher with paid plan). Replicate inference takes 5-25s and we need to await it. Mitigation: use `waitUntil` is wrong for this, we need the actual response, so use streaming or polling. Initial version: synchronous wait, accept that very slow models may time out. If this bites, switch to a polling design.
- Free Pages Functions egress and request limits. Mitigation: rate limit per IP, document the limits in README so forks can adjust.
- Replicate cost overrun on the live demo. Mitigation: per-IP rate limit, document the daily cap, optionally also a daily global cap stored in KV.

---

# Development Guidelines

- No emojis anywhere (code, comments, docs, commits) per project CLAUDE.md.
- Lowercase code comments with no trailing period.
- Brief commit messages, no `feat:` or `fix:` prefixes, no co-author attribution.
- Author all commits as `matheusmaldaner`.
- Keep README brief, no tables, no markdown decoration.

---

# References

- Existing Django Mirage: `WeAudit-Mirage/` in the CarnegieMellon repo
- Existing Lambda backend: `WeAudit-Stable-Diffusion/server/mirageFunction/mirageFunction.py`
- Cloudflare Pages Functions docs: https://developers.cloudflare.com/pages/functions/
- Replicate HTTP API: https://replicate.com/docs/reference/http
- CI'25 demo paper: https://arxiv.org/abs/2511.21547
- HCOMP'24 WIP: https://www.humancomputation.com/assets/wip_2024/HCOMP_24_WIP_4.pdf
