// cloudflare pages function: synchronous replicate proxy with optional per-ip rate limit
//
// env bindings expected:
//   REPLICATE_API_TOKEN   - string, required
//   RATE_LIMIT_PER_HOUR   - string of integer, optional, default 20
//   RATE_LIMIT_KV         - kv namespace binding, optional. if absent, rate limiting is off

const REPLICATE_URL = 'https://api.replicate.com/v1/predictions';
const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 2000;

// per-model parameter overrides ported from the old django mirageFunction.py
// these win over whatever the client sends so the call actually validates at replicate
const MODEL_OVERRIDES = {
  'bytedance/sdxl-lightning-4step': {
    width: 1024, height: 1024, scheduler: 'K_EULER',
    guidance_scale: 0, negative_prompt: 'worst quality, low quality',
    num_inference_steps: 4, max_outputs: 1,
  },
  'ai-forever/kandinsky-2.2': {
    width: 1024, height: 1024, scheduler: 'K_EULER',
    guidance_scale: 0, negative_prompt: 'worst quality, low quality',
    num_inference_steps: 20,
  },
  'playgroundai/playground-v2-1024px-aesthetic': {
    width: 1024, height: 1024, scheduler: 'K_EULER_ANCESTRAL',
    guidance_scale: 3, negative_prompt: 'worst quality, low quality',
    num_inference_steps: 50, max_outputs: 1,
  },
  'lucataco/ssd-1b': {
    width: 768, height: 768, scheduler: 'K_EULER',
    guidance_scale: 9, negative_prompt: 'worst quality, low quality',
    num_inference_steps: 20,
  },
  'adirik/realvisxl-v4.0': {
    width: 768, height: 768, scheduler: 'K_EULER',
    guidance_scale: 4, negative_prompt: 'worst quality, low quality',
    num_inference_steps: 25,
  },
  'fofr/latent-consistency-model': {
    width: 768, height: 768, scheduler: 'K_EULER',
    guidance_scale: 4, negative_prompt: 'worst quality, low quality',
    num_inference_steps: 25, max_outputs: 1, num_key: 'num_images',
  },
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

  // apply model-specific overrides if known, else default params
  const ov = MODEL_OVERRIDES[model_name] || {};
  const requested = Math.max(1, Math.min(parseInt(num, 10) || 1, 8));
  const maxOut = ov.max_outputs || 8;
  const numImages = Math.min(requested, maxOut);
  const numKey = ov.num_key || 'num_outputs';

  const input = {
    prompt,
    width: ov.width || 768,
    height: ov.height || 768,
    scheduler: ov.scheduler || 'K_EULER',
    guidance_scale: ov.guidance_scale ?? 7.5,
    num_inference_steps: ov.num_inference_steps || 20,
    negative_prompt: ov.negative_prompt || '',
    [numKey]: numImages,
  };

  // create the prediction with prefer: wait so replicate holds the connection until it's done
  const createRes = await fetch(REPLICATE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait',
    },
    body: JSON.stringify(model_version_id && model_version_id !== 'X'
      ? { version: model_version_id, input }
      : { input, model: model_name }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    return jsonResponse({ error: 'replicate rejected the request', detail: text }, createRes.status);
  }

  let prediction = await createRes.json();

  // poll if still running after the wait window
  let attempts = 0;
  while ((prediction.status === 'starting' || prediction.status === 'processing') && attempts < MAX_POLL_ATTEMPTS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    attempts++;
    const pollRes = await fetch(prediction.urls.get, {
      headers: { 'Authorization': `Token ${env.REPLICATE_API_TOKEN}` },
    });
    if (!pollRes.ok) {
      return jsonResponse({ error: 'replicate poll failed' }, 502);
    }
    prediction = await pollRes.json();
  }

  if (prediction.status !== 'succeeded') {
    return jsonResponse({
      error: 'generation did not succeed',
      status: prediction.status,
      detail: prediction.error || null,
    }, 502);
  }

  const output = Array.isArray(prediction.output) ? prediction.output : [prediction.output];

  // shape matches the legacy expectation from the django version so the frontend stays simple
  return jsonResponse({
    Status: 'Completed',
    ImageUrls: output,
    output,
    model_name,
    model_version_id,
  });
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
