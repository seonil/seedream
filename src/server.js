import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ARK_API_KEY || '';
const API_BASE = (process.env.API_BASE || 'https://ark.ap-southeast.bytepluses.com').replace(/\/$/, '');
const GENERATE_URL = `${API_BASE}/api/v3/images/generations`;

app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(morgan('dev'));
app.set('trust proxy', 1);

// Optional: simple Basic Auth and IP allowlist for private access
const BASIC_USER = process.env.APP_USERNAME || '';
const BASIC_PASS = process.env.APP_PASSWORD || '';
const ALLOW_IPS = (process.env.ALLOW_IPS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  // IP allowlist (if provided)
  if (ALLOW_IPS.length) {
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || '').trim();
    if (!ALLOW_IPS.includes(ip)) {
      return res.status(403).send('Forbidden');
    }
  }
  // Basic Auth (if credentials are provided)
  if (!BASIC_USER || !BASIC_PASS) return next();
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Protected"');
    return res.status(401).send('Auth required');
  }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString();
  const idx = decoded.indexOf(':');
  const u = idx >= 0 ? decoded.slice(0, idx) : '';
  const p = idx >= 0 ? decoded.slice(idx + 1) : '';
  if (u === BASIC_USER && p === BASIC_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="Protected"');
  return res.status(401).send('Invalid credentials');
});

app.get('/health', (req, res) => {
  res.json({ ok: true, apiBase: API_BASE, hasKey: Boolean(API_KEY) });
});

// Proxy endpoint to avoid exposing API key in browser
app.post('/api/generate', async (req, res) => {
  if (!API_KEY) {
    return res.status(400).json({ error: { message: 'Missing ARK_API_KEY in server environment' } });
  }

  // Basic allowlist of fields
  const {
    model,
    prompt,
    image, // string or array
    size,
    seed,
    sequential_image_generation,
    sequential_image_generation_options,
    stream,
    guidance_scale,
    response_format,
    watermark
  } = req.body || {};

  if (!model || !prompt) {
    return res.status(400).json({ error: { message: 'model and prompt are required' } });
  }

  // Build payload matching API spec
  const payload = {
    model,
    prompt,
    // Default watermark to false unless explicitly overridden by client
    watermark: false,
  };

  if (image != null) payload.image = image; // supports string or array
  if (size) payload.size = size;
  if (typeof seed === 'number') payload.seed = seed;
  if (sequential_image_generation) payload.sequential_image_generation = sequential_image_generation; // 'auto' | 'disabled'
  if (sequential_image_generation_options) payload.sequential_image_generation_options = sequential_image_generation_options;
  if (typeof stream === 'boolean') payload.stream = stream; // default false
  if (typeof guidance_scale === 'number') payload.guidance_scale = guidance_scale; // not for seedream-4.0
  if (response_format) payload.response_format = response_format; // 'url' | 'b64_json'
  if (typeof watermark === 'boolean') payload.watermark = watermark;

  try {
    const resp = await axios.post(GENERATE_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      timeout: 120000, // 120s
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    res.status(resp.status).json(resp.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { error: { message: err.message } };
    res.status(status).json(data);
  }
});

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Fallback to index.html for root
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
