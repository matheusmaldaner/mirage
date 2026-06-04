// cloudflare pages function: GET /api/status?id=... returns a replicate prediction's current state.
// the browser polls this after POST /api/generate hands back a still-running prediction, so the
// replicate token never reaches the client and no request stays open waiting on a slow model.

const REPLICATE_URL = 'https://api.replicate.com/v1/predictions';

export async function onRequestGet({ request, env }) {
  if (!env.REPLICATE_API_TOKEN) {
    return jsonResponse({ error: 'server missing REPLICATE_API_TOKEN' }, 500);
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return jsonResponse({ error: 'id query parameter is required' }, 400);
  }

  const res = await fetch(`${REPLICATE_URL}/${encodeURIComponent(id)}`, {
    headers: { 'Authorization': `Token ${env.REPLICATE_API_TOKEN}` },
  });

  if (!res.ok) {
    const text = await res.text();
    return jsonResponse({ error: 'replicate status lookup failed', detail: text }, res.status);
  }

  return jsonResponse(predictionState(await res.json()));
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
