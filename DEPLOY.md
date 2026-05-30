# Cloudflare Pages Deploy

This is the exact click path to get mirage.matheus.wiki live on Cloudflare Pages with the Replicate token proxied through a Pages Function.

## Prerequisites

- Cloudflare account (free)
- Replicate API token from https://replicate.com/account/api-tokens
- The matheus.wiki domain already on Cloudflare DNS (or willing to add it)

## Step 1: Connect the repo

1. Cloudflare dashboard > Workers & Pages > Create
2. Pages tab > Connect to Git
3. Authorize GitHub if first time. Select the `matheusmaldaner/mirage` repo (private is fine, Cloudflare reads it via GitHub App).
4. Set up project:
   - Project name: `mirage` (this becomes mirage.pages.dev)
   - Production branch: `main`
   - Framework preset: None
   - Build command: (leave empty)
   - Build output directory: `/` (or empty)
5. Save and Deploy.

First deploy takes about 1 minute. You'll get a `https://mirage.pages.dev` URL.

## Step 2: Add the Replicate token

1. Pages project > Settings > Environment variables
2. Add to Production AND Preview:
   - Name: `REPLICATE_API_TOKEN`
   - Value: your `r8_...` token
   - Type: Secret
3. Save. The next deploy will pick it up. Trigger a redeploy under Deployments > "Retry deployment" if you don't want to wait for a git push.

## Step 3 (optional but recommended): rate limiting

Without this, every visitor can burn unlimited Replicate credits on your token.

1. Cloudflare dashboard > Workers & Pages > KV
2. Create namespace: name `mirage-rate-limit`
3. Pages project > Settings > Functions > KV namespace bindings
4. Add binding:
   - Variable name: `RATE_LIMIT_KV`
   - KV namespace: `mirage-rate-limit`
5. Environment variables > add:
   - Name: `RATE_LIMIT_PER_HOUR`
   - Value: `20` (or whatever cap you want per IP per hour)
6. Save and redeploy.

Without `RATE_LIMIT_KV` bound, the proxy is unlimited (intended for self-hosters who don't need rate limiting).

## Step 4: Custom domain

1. Pages project > Custom domains > Set up a custom domain
2. Enter `mirage.matheus.wiki`
3. Cloudflare auto-creates the CNAME if matheus.wiki is already on Cloudflare DNS. If it isn't, follow Cloudflare's instructions to add a CNAME at your DNS provider pointing `mirage.matheus.wiki` to `mirage.pages.dev`.
4. Wait 1-5 min for cert provisioning. Site is live at https://mirage.matheus.wiki.

## Step 5: Smoke test

Visit the live URL.

1. Open dev tools > Network tab
2. Pick 1-2 cheap models (SDXL Lightning 4-Step is fast)
3. Type a prompt, hit Generate
4. Watch network: `POST /api/generate` should return 200 with a JSON body containing `ImageUrls: [...]`
5. The grid populates with images from `replicate.delivery/...` URLs

If `/api/generate` returns 500:
- Check Pages > Functions > Real-time logs
- Most common cause: `REPLICATE_API_TOKEN` not set or has typo

If 429: rate limit hit. Check KV namespace data or raise `RATE_LIMIT_PER_HOUR`.

## Step 6: Make repo public (when you're ready to publish)

Currently private. When ready:

1. github.com/matheusmaldaner/mirage > Settings > Danger Zone > Change visibility > Make public
2. Cloudflare connection survives the visibility flip.
3. Update README's "live demo" link if pointing somewhere else.

## Cost ceiling

- Cloudflare Pages: free for the project. Free tier includes 100K Pages Function requests per day, 500 builds per month.
- Replicate: per-second compute pricing per model. SDXL Lightning is ~$0.002/image; older SD models ~$0.003/image. With `RATE_LIMIT_PER_HOUR=20` and 8 images per call, worst case is ~$0.32 per IP per hour.
- Cloudflare KV: 1K writes/day free, $0.50/M after. With 20 generations/hour cap, even 100 daily active users stay well under 1K writes/day.

## Troubleshooting

- 503 on `/api/generate` with `cpu_exceeded`: Replicate model took longer than the Pages Function CPU limit. Pick faster models for the live demo, or upgrade to Pages Functions paid for higher limits.
- DNS doesn't resolve for mirage.matheus.wiki: confirm matheus.wiki is on Cloudflare nameservers; otherwise the CNAME route is needed.
- Generate button does nothing: check browser console for JS errors. Most likely a model version got deprecated on Replicate. Update the `version` hash in `js/constants.js` for that model.
