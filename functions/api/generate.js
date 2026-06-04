// cloudflare pages function: async replicate proxy with optional per-ip rate limit
//
// POST /api/generate creates a prediction and returns { id, status, output } right away,
// with a short server-side wait so fast models come back already finished. slow models
// return status "processing" and the browser polls GET /api/status?id=... until done, so no
// single request stays open long enough to hit cloudflare's edge timeout.
//
// env bindings expected:
//   REPLICATE_API_TOKEN   - string, required
//   RATE_LIMIT_PER_HOUR   - string of integer, optional, default 20
//   RATE_LIMIT_KV         - kv namespace binding, optional. if absent, rate limiting is off

const REPLICATE_URL = 'https://api.replicate.com/v1/predictions';
// seconds replicate holds the create request before returning (max 60); fast models finish here
const CREATE_WAIT_SECONDS = 10;

// each model is sent only { prompt } plus its own image-count field, clamped to the maximum the
// pinned model version actually accepts. these were read from each version's replicate input
// schema (which is immutable per version), so encoding them statically stays correct. everything
// else uses replicate's per-model defaults, which avoids 422s from params a model does not accept.
// verified 2026-06-03. models not listed use DEFAULT_COUNT; a null value means the model has no
// batch field and always returns a single image.
const DEFAULT_COUNT = { key: 'num_outputs', max: 4 };
const COUNT_OVERRIDES = {
  'fofr/latent-consistency-model': { key: 'num_images', max: 8 },
  'fofr/sticker-maker': { key: 'number_of_images', max: 8 },
  'fofr/aura-flow': { key: 'number_of_images', max: 8 },
  'playgroundai/playground-v2-1024px-aesthetic': null,
  'nvidia/sana': null,
  'black-forest-labs/flux-1.1-pro': null,
  'recraft-ai/recraft-v3': null,
  'stability-ai/stable-diffusion-3.5-large': null,
  'luma/photon': null,
  'luma/photon-flash': null,
};

export async function onRequestPost({ request, env }) {
  if (!env.REPLICATE_API_TOKEN) {
    return jsonResponse({ error: 'server missing REPLICATE_API_TOKEN' }, 500);
  }

  // rate limit
  const limitResult = await checkRateLimit(request, env);
  if (limitResult) {
    return limitResult;
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'invalid json body' }, 400);
  }

  const { model_name, model_version_id, prompt, num } = body || {};

  if (!model_name || !prompt) {
    return jsonResponse({ error: 'model_name and prompt are required' }, 400);
  }

  const requested = Math.max(1, Math.min(parseInt(num, 10) || 1, 8));

  // send only the prompt plus the model's own count field; let replicate default everything else
  const input = { prompt };
  const count = Object.prototype.hasOwnProperty.call(COUNT_OVERRIDES, model_name)
    ? COUNT_OVERRIDES[model_name]
    : DEFAULT_COUNT;
  if (count) {
    input[count.key] = Math.min(requested, count.max);
  }

  // create the prediction; prefer a short wait so quick models return already finished
  const createRes = await fetch(REPLICATE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Prefer': `wait=${CREATE_WAIT_SECONDS}`,
    },
    body: JSON.stringify(model_version_id && model_version_id !== 'X'
      ? { version: model_version_id, input }
      : { input, model: model_name }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    return jsonResponse({ error: 'replicate rejected the request', detail: text }, createRes.status);
  }

  // return the prediction's current state; the browser polls /api/status if it is not done yet
  return jsonResponse(predictionState(await createRes.json()));
}

// normalizes a replicate prediction into the small shape the frontend polls on
function predictionState(p) {
  return {
    id: p.id,
    status: p.status,
    output: p.output == null ? null : (Array.isArray(p.output) ? p.output : [p.output]),
    error: p.error || null,
  };
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

async function checkRateLimit(request, env) {
  if (!env.RATE_LIMIT_KV) {
    return null;
  }
  const limit = parseInt(env.RATE_LIMIT_PER_HOUR || '20', 10);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const hourBucket = Math.floor(Date.now() / 3600000);
  const key = `rate:${ip}:${hourBucket}`;
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || '0', 10);
  if (current >= limit) {
    return jsonResponse({
      error: 'rate limit exceeded',
      limit_per_hour: limit,
      retry_after_seconds: 3600 - (Math.floor(Date.now() / 1000) % 3600),
    }, 429);
  }
  // increment, expire at the end of the hour bucket
  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 3700 });
  return null;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
