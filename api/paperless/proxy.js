/**
 * Paperless NGX Proxy — leitet Anfragen von HTTPS (Vercel) an den
 * lokalen Paperless-Server (HTTP) weiter, um Mixed-Content-Blockade zu umgehen.
 *
 * GET  /api/paperless/proxy?path=documents/&query=rechnung&page=1
 * POST /api/paperless/proxy?path=documents/post_document/  (multipart upload)
 *
 * Headers (vom Client):
 *   x-paperless-url:   http://192.168.178.184:8000
 *   x-paperless-token: <Paperless API Token>
 */

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Paperless-Url, X-Paperless-Token');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Paperless connection details
  const paperlessUrl = String(req.headers['x-paperless-url'] || '').replace(/\/+$/, '');
  const paperlessToken = String(req.headers['x-paperless-token'] || '');

  if (!paperlessUrl || !paperlessToken) {
    return res.status(400).json({ error: 'Missing x-paperless-url or x-paperless-token headers' });
  }

  // Target path from query
  const targetPath = String(req.query.path || '').replace(/^\//, '');
  if (!targetPath) {
    return res.status(400).json({ error: 'Missing path query parameter' });
  }

  const targetUrl = `${paperlessUrl}/api/${targetPath}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': `Token ${paperlessToken}`,
      },
    };

    // Forward request body for POST (upload)
    if (req.method === 'POST') {
      // Vercel parses the raw body — we need to forward it as-is
      // For multipart uploads, we need the raw body with content-type
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('multipart/form-data')) {
        fetchOptions.headers['Content-Type'] = contentType;
        fetchOptions.body = req.body; // Vercel provides parsed body for serverless
      } else if (req.body) {
        fetchOptions.headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(req.body);
      }
    }

    const upstream = await fetch(targetUrl, fetchOptions);

    // Forward response headers (especially Content-Type for binary)
    const upstreamContentType = upstream.headers.get('content-type');
    if (upstreamContentType) {
      res.setHeader('Content-Type', upstreamContentType);
    }

    // Check if binary response (thumbnails, downloads)
    if (upstreamContentType && !upstreamContentType.includes('application/json')) {
      const buffer = await upstream.arrayBuffer();
      return res.status(upstream.status).send(Buffer.from(buffer));
    }

    const json = await upstream.json();
    return res.status(upstream.status).json(json);
  } catch (err) {
    console.error('Paperless proxy error:', err);
    return res.status(502).json({ error: 'Paperless server unreachable', detail: err.message });
  }
};
