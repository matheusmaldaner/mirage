# MIRAGE

<p align="center">
  <img src="images/mirage-readme-banner.svg" alt="MIRAGE banner" width="100%">
</p>

Multi-model Interface for Reviewing & Auditing Generative Text-to-Image AI.

**Links:** [Deployed software](https://mirage.matheus.wiki) · [CI'25 paper](https://arxiv.org/abs/2511.21547) · [HCOMP'24 paper](https://arxiv.org/abs/2503.19252)

This is the open-source standalone version of [MIRAGE](https://arxiv.org/abs/2511.21547). The original demo ran on AWS Lambda + S3 + DynamoDB. This repo strips all of that out and runs on Cloudflare Pages with a single Pages Function that proxies the Replicate API.

No accounts, no database, no forum. The browser is the only state.

## What you need to deploy your own

1. A free Cloudflare account
2. A Replicate API token from https://replicate.com/account/api-tokens
3. Optional: a Cloudflare KV namespace if you want per-IP rate limiting

## Deploy

1. Fork this repo
2. In Cloudflare dashboard: Workers & Pages > Create > Pages > Connect to Git, pick your fork
3. Build settings: framework preset = None, build command = empty, build output directory = `/`
4. Environment variables (Production and Preview):
   - `REPLICATE_API_TOKEN` = your token
   - `RATE_LIMIT_PER_HOUR` = optional integer, default 20
5. Optional: in Pages project settings > Functions > KV namespace bindings, bind a KV namespace as `RATE_LIMIT_KV`. If you skip this step rate limiting is off and every request goes straight to Replicate.
6. Save and deploy. The first deploy gives you a `*.pages.dev` URL. Point a custom domain at it under Pages > Custom domains.

## Local dev

```
npm install -g wrangler
wrangler pages dev . --compatibility-date=2024-01-01
```

Set `REPLICATE_API_TOKEN` in a local `.dev.vars` file.

## How it works

`functions/api/generate.js` accepts POST with `{ model_name, model_version_id, prompt, num, ...params }`. It sends a synchronous Replicate prediction with the `Prefer: wait` header, polls if the request is still running after the initial wait, and returns `{ Status: "Completed", ImageUrls: [...] }` so the frontend code stays simple.

`js/constants.js` is the model catalog, ported verbatim from the original Mirage. Add or remove models by editing this file. The version hash on each model pins to a specific Replicate version.

`js/compare.js` handles model selection, generation, and result rendering. There is no auth, no DB, no result persistence beyond the current page.

## Citing

This codebase accompanies two prior papers:

- [Seeing Twice: How Side-by-Side T2I Comparison Changes Auditing Strategies](https://arxiv.org/abs/2511.21547) (ACM Collective Intelligence 2025)
- [MIRAGE: Multi-model Interface for Reviewing and Auditing Generative Text-to-Image AI](https://arxiv.org/abs/2503.19252) (AAAI HCOMP 2024)

```
@inproceedings{maldaner2025seeingtwice_ci,
  title     = {Seeing Twice: How Side-by-Side T2I Comparison Changes Auditing Strategies},
  author    = {Kunzler Maldaner, Matheus and Deng, Wesley Hanwen and Hong, Jason I. and Holstein, Ken and Eslami, Motahhare},
  booktitle = {Proceedings of the ACM Collective Intelligence (Poster & Demo Track)},
  year      = {2025}
}

@inproceedings{maldaner2024mirage_hcomp,
  title     = {MIRAGE: Multi-model Interface for Reviewing and Auditing Generative Text-to-Image AI},
  author    = {Kunzler Maldaner, Matheus and Deng, Wesley Hanwen and Hong, Jason I. and Holstein, Ken and Eslami, Motahhare},
  booktitle = {Proceedings of the AAAI Conference on Human Computation and Crowdsourcing (HCOMP), Work-in-Progress Track},
  year      = {2024}
}
```

## License

MIT. See [LICENSE](./LICENSE).
