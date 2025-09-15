Seed Text-to-Image App

Overview
- Minimal Node + Express web app to call the BytePlus Ark Image Generation API.
- Proxy endpoint keeps your API key on the server.
- Simple UI supports prompt-only, i2i with multiple reference images, size, watermark, response format, and sequential gen options.

Prerequisites
- Node.js 18+ installed
- An Ark API key with access to the image models

Setup
1) Install deps
   npm install

2) Configure env
   Copy .env.example to .env and set ARK_API_KEY.
   For private access, set APP_USERNAME and APP_PASSWORD.
   Optionally set API_BASE and PORT.

3) Run
   npm start
   Open http://localhost:3000

Environment
- ARK_API_KEY: Your API key (required)
- API_BASE: API base URL, defaults to https://ark.ap-southeast.bytepluses.com
  Example regional alternate from docs: https://ark.cn-beijing.volces.com
- PORT: Server port (default 3000)

Notes
- The UI uses non-streaming mode (stream=false). Streaming examples require the API’s streaming format; add later if needed.
- Reference images: selected files are converted to data URLs in-browser and forwarded to the API.
- For seedream-4.0, sequential_image_generation can be set to auto; max_images is respected via sequential_image_generation_options.
- For seedream-3.0-t2i and seededit-3.0-i2i, optional parameters seed and guidance_scale are available.
- Default watermark is false (server enforces unless overridden by UI).
- Images count: Set desired number (1–15). For seedream-4.0, the app auto-configures batch mode (sequential auto + max_images). Other models only support 1.
 - Exact count mode: Choose "Exact" to generate exactly N images by issuing N single-image requests server-side and aggregating results (one browser request, multiple upstream calls). Use "Batch" if you prefer model-decided count up to N (seedream-4.0 only).
 - Aspect ratio helper: Pick an aspect ratio to auto-fill the Size with recommended pixel dimensions (e.g., 1:1 → 2048x2048). You can still type a custom size.

API Proxy
- POST /api/generate forwards a JSON body to {API_BASE}/api/v3/images/generations
- Required fields: model, prompt
- Optional fields: image (string or array), size, seed, sequential_image_generation, sequential_image_generation_options, stream, guidance_scale, response_format, watermark

Troubleshooting
- If you see Missing ARK_API_KEY, set it in .env and restart.
- If you receive 4xx/5xx from the upstream API, check model id, parameter ranges, and your account/model activation.

Deploy (simplest: Render)
- Push this folder to a GitHub repo.
- Go to render.com → New → Web Service → Connect the repo.
- Build command: npm install
- Start command: npm start
- Environment variables:
  - ARK_API_KEY=your_key
  - APP_USERNAME=me (any you like)
  - APP_PASSWORD=strong_password
  - API_BASE=https://ark.ap-southeast.bytepluses.com (or your region)
- Click Deploy. When opened, the browser will ask for username/password via Basic Auth.
- Optional: Add a custom domain on Render; for stronger protection, front with Cloudflare Access.
