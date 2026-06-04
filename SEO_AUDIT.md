# SEO Visibility and Growth Audit

## Execution Contract

When running this audit against a project:

1. Discover the full project before writing anything. Read the stack, public routes, robots, sitemap, metadata, analytics, deployment config, and CI/CD workflows.
2. Fill in every `{PLACEHOLDER}` with project-specific findings. Remove placeholders that do not apply.
3. Do not stop after analysis. Complete every P0 action before moving to P1.
4. Create `PLAN.md` and `PROGRESS.md` at the project root and update `PROGRESS.md` continuously.
5. If blocked, continue all unblocked tasks and log the blocker with impact and next action.
6. Do not regress existing strengths. Preserve any passing baseline before patching gaps.

---

## Project Facts

- **Stack/rendering model:** Static HTML/JS with Cloudflare Pages API functions
- **Hosting/deploy model:** Cloudflare Pages with GitHub Actions CI/CD
- **Canonical domain intent:** https://mirage.matheus.wiki
- **Public route count:** 5
  - `/` (200)
  - `/compare.html` (200)
  - `/compare-pt.html` (200)
  - `/instructions.html` (200)
  - `/instructions-pt.html` (200)
- **Indexable route count:** 5 (All allowed by robots.txt and not noindex)
- **SEO files detected:** robots.txt, sitemap.xml, llms.txt
- **Analytics detected:** None currently installed
- **Monetization/conversion goals:** Academic citations, open-source usage
- **Content surfaces:** Landing page, instructions, generation interface

---

## Executive Summary

- **Overall posture:** The site is a lightweight, static client application that is fully indexable, discoverable by AI, and configured for correct crawl budgeting, though it currently lacks analytics.
- **Biggest strengths:** Fast static delivery, clean canonical URLs, no JavaScript required for core textual content (instructions/landing).
- **Biggest reach blockers:** Lack of analytics makes growth measurement impossible. No structured data for rich results.
- **Fastest wins:** Adding analytics to measure baseline engagement and tracking citations.
- **Highest-leverage strategic work:** Establishing conversion tracking for GitHub repo views or paper reads.

---

## Strengths Assessment

| Area | Finding | Evidence | Why it helps reach |
|---|---|---|---|
| Rendering | Static HTML | `index.html`, `compare.html` files | Crawlers get meaningful content immediately |
| Crawl policy | `robots.txt` allows all public pages | `robots.txt` `Allow: /` | Correct crawl budget allocation |
| Sitemap | Exists with canonical URLs | `sitemap.xml` | Complete URL inventory for search engines |
| Metadata | Title, description, canonical present | `index.html`, `compare.html` | Improves snippet quality and CTR |
| Social metadata | OG and Twitter tags present | `compare.html` source | High-quality social sharing previews |
| AI discoverability | `llms.txt` present | `llms.txt` at root | AI answer engine coverage |
| Performance | Deployed via edge (Cloudflare) | `deploy.yml` | Fast TTFB and reliable baseline for Core Web Vitals |
| Security | HTTPS via Cloudflare | Config via Pages | Trust and crawler safety |
| CI/CD | Deploy gated on SEO metadata check | `.github/workflows/deploy.yml` | Prevents SEO regressions shipping |

---

## Gaps Assessment

| Priority | Area | Finding | Evidence | Impact | Recommended action |
|---|---|---|---|---|---|
| **P1** | Structured data | Missing JSON-LD | No schema in HTML files | No rich result eligibility; AI crawlers lack context | Add Organization and WebSite schema to index.html |
| **P1** | Analytics | No GA4/GTM or tracking | No gtag/gtm pixels | Cannot measure or optimize growth | Add consent-aware analytics and conversion event taxonomy |
| **P1** | Search Console | Missing verification | No meta verification | Cannot monitor indexing, errors, or query data | Perform GSC and Bing Webmaster verification; submit sitemap |
| **P1** | Content ownership | Blog/news missing | No owned content hub | Authority constrained | Consider publishing AI research articles on the canonical domain |

---

## SEO Asset Inventory

| Asset | Exists? | Location | Quality | Notes |
|---|---|---|---|---|
| robots.txt | yes | `/robots.txt` | Good | Allows all, points to sitemap |
| sitemap.xml | yes | `/sitemap.xml` | Good | 5 canonical URLs, priority/changefreq set |
| llms.txt | yes | `/llms.txt` | Good | Maps repo, domains, and papers for AI crawlers |
| structured data | no | - | Missing | Need Organization / WebSite schema |
| canonical tags | yes | `index.html`, `compare*.html` | Good | Pointing to correct absolute URLs |
| OG/social metadata | yes | All HTML files | Good | Complete OG and Twitter tags present |

---

## Analytics and Monitoring Inventory

| System | Exists? | Location | Events/Data | Gaps |
|---|---|---|---|---|
| GA4/GTM | no | - | none | Add consent-aware tracking and event taxonomy |
| Search Console | no | - | none | Verify ownership; submit sitemap |
| Uptime/health | partial | Cloudflare dashboard | availability | Set up synthetic checks |

---

## Prioritized Action Plan

### P0 — Fix First (Completed)

- [x] Fix robots/crawl policy — Added `robots.txt` allowing all public pages.
- [x] Ship or fix sitemap — Added `sitemap.xml` with absolute canonical URLs and lastmod dates.
- [x] Unify canonical domain — Added `<link rel="canonical" ...>` to all HTML pages pointing to `mirage.matheus.wiki`.
- [x] Add route-level metadata — Unique title, description, OG, Twitter tags added to all public pages.
- [x] Add SEO CI validators — Deploys are now gated on the presence of SEO files (`robots.txt`, `sitemap.xml`, canonicals).
- [x] Add AI discoverability — Created `llms.txt` listing research papers and source repo.

### P1 — Next (metadata, measurement, conversion)

- [x] Add structured data — Organization/WebSite schema added to index.html.
- [x] Add security and cache headers — `_headers` file created for Cloudflare Pages (CSP, HSTS, caching).
- [ ] Add GSC and Bing verification — Verify ownership via Cloudflare DNS or file upload.
- [ ] Add consent-aware analytics — Track page views, generation events, and outbound clicks (e.g., paper links).

### P2 — Growth Experiments

- [ ] Build owned content hub — Publish short articles or updates on AI auditing under a `/blog` route.
- [ ] Add weekly growth pulse — Review traffic and academic citation growth.
