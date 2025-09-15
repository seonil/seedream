const form = document.getElementById('gen-form');
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const aspectEl = document.getElementById('aspect_ratio');

async function filesToDataUrls(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return null;
  const promises = files.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  }));
  const arr = await Promise.all(promises);
  return arr.length === 1 ? arr[0] : arr;
}

function setBusy(busy) {
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = busy;
  statusEl.textContent = busy ? 'Generating image(s)...' : '';
}

function clearOutput() { outputEl.innerHTML = ''; }

function renderImages(dataArr, responseFormat) {
  for (const item of dataArr) {
    const card = document.createElement('div');
    card.className = 'card';

    const imgWrap = document.createElement('a');
    imgWrap.className = 'img-wrap';
    imgWrap.target = '_blank';

    const img = document.createElement('img');
    let href = '#';
    if (responseFormat === 'url' && item.url) {
      href = item.url;
      img.src = item.url;
    } else if (responseFormat === 'b64_json' && item.b64_json) {
      img.src = `data:image/jpeg;base64,${item.b64_json}`;
      href = img.src;
    } else if (item.url) {
      href = item.url;
      img.src = item.url;
    }
    imgWrap.href = href;
    imgWrap.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const size = document.createElement('span');
    size.textContent = item.size || '';
    const dl = document.createElement('a');
    dl.href = href; dl.textContent = 'Open';
    meta.appendChild(size);
    meta.appendChild(dl);

    card.appendChild(imgWrap);
    card.appendChild(meta);
    outputEl.appendChild(card);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setBusy(true);
  clearOutput();
  try {
    const model = document.getElementById('model').value.trim();
    const prompt = document.getElementById('prompt').value.trim();
    const response_format = document.getElementById('response_format').value;
    const size = document.getElementById('size').value.trim();
    const watermark = document.getElementById('watermark').value === 'true';
    const count = document.getElementById('count').valueAsNumber || 1;
    const gen_mode = document.getElementById('gen_mode').value;
    const seq = document.getElementById('seq').value;
    const max_images = document.getElementById('max_images').valueAsNumber;
    const seed = document.getElementById('seed').value === '' ? undefined : Number(document.getElementById('seed').value);
    const guidance_scale = document.getElementById('guidance_scale').value === '' ? undefined : Number(document.getElementById('guidance_scale').value);
    const files = document.getElementById('images').files;

    const image = await filesToDataUrls(files);

    const body = { model, prompt, response_format, watermark, images_count: count, mode: gen_mode };
    if (image) body.image = image;
    if (size) body.size = size;
    // Batch images: Prefer 'count' input. If >1 and model supports (seedream-4.0), set seq auto and max_images=count.
    let effectiveCount = Math.max(1, Math.min(15, Number(count) || 1));
    const supportsBatch = model.startsWith('seedream-4-0');
    if (effectiveCount > 1 && gen_mode === 'batch') {
      if (supportsBatch) {
        body.sequential_image_generation = 'auto';
        body.sequential_image_generation_options = { max_images: effectiveCount };
      } else {
        statusEl.textContent = '현재 모델은 다중 이미지 생성을 지원하지 않아 1장으로 진행합니다.';
      }
    } else if (gen_mode !== 'batch') {
      // Fall back to manual advanced control if user configured it
      if (seq) body.sequential_image_generation = seq;
      if (!Number.isNaN(max_images) && max_images > 0) {
        body.sequential_image_generation_options = { max_images };
      }
    }
    if (typeof seed === 'number' && !Number.isNaN(seed)) body.seed = seed;
    if (typeof guidance_scale === 'number' && !Number.isNaN(guidance_scale)) body.guidance_scale = guidance_scale;
    body.stream = false; // UI uses non-streaming mode for simplicity

    const resp = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await resp.json();
    if (!resp.ok) {
      console.error(json);
      throw new Error(json?.error?.message || 'Generation failed');
    }

    statusEl.textContent = `Generated: ${json?.usage?.generated_images ?? (json?.data?.length || 0)}`;
    renderImages(json.data || [], response_format);
  } catch (err) {
    statusEl.textContent = 'Error: ' + (err?.message || String(err));
  } finally {
    setBusy(false);
  }
});

// Aspect ratio → size helper
if (aspectEl) {
  aspectEl.addEventListener('change', () => {
    const v = aspectEl.value;
    if (!v) return; // Custom
    const sizeInput = document.getElementById('size');
    sizeInput.value = v;
  });
}
