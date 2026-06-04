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

// newer official replicate models use prompt-first schemas and reject the legacy
// scheduler/guidance_scale/num_inference_steps/num_outputs/negative_prompt params.
// `params` is sent verbatim with the prompt; `num_key` is the batch field
// (null means the model only ever returns a single image).
const PROMPT_FIRST_MODELS = {
  'black-forest-labs/flux-1.1-pro': { params: { aspect_ratio: '1:1' }, num_key: null },
  'recraft-ai/recraft-v3': { params: {}, num_key: null },
  'stability-ai/stable-diffusion-3.5-large': { params: { aspect_ratio: '1:1' }, num_key: null },
  'luma/photon': { params: { aspect_ratio: '1:1' }, num_key: null },
  'luma/photon-flash': { params: { aspect_ratio: '1:1' }, num_key: null },
  'fofr/aura-flow': { params: {}, num_key: 'number_of_images', max_outputs: 8 },
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

  let input;
  if (PROMPT_FIRST_MODELS[model_name]) {
    // prompt-first official model: only send params it actually accepts
    const cfg = PROMPT_FIRST_MODELS[model_name];
    input = { prompt, ...cfg.params };
    if (cfg.num_key) {
      input[cfg.num_key] = Math.min(requested, cfg.max_outputs || 8);
    }
  } else {
    // legacy stable-diffusion-style model: apply overrides over the shared default
    const ov = MODEL_OVERRIDES[model_name] || {};
    const numImages = Math.min(requested, ov.max_outputs || 8);
    const numKey = ov.num_key || 'num_outputs';
    input = {
      prompt,
      width: ov.width || 768,
      height: ov.height || 768,
      scheduler: ov.scheduler || 'K_EULER',
      guidance_scale: ov.guidance_scale ?? 7.5,
      num_inference_steps: ov.num_inference_steps || 20,
      negative_prompt: ov.negative_prompt || '',
      [numKey]: numImages,
    };
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
