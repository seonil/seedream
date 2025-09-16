const form = document.getElementById('gen-form');
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const aspectEl = document.getElementById('aspect_ratio');
const dropzone = document.getElementById('image-dropzone');
const imageInput = document.getElementById('images');
const browseButton = document.getElementById('browse-images');
const clearButton = document.getElementById('clear-images');
const dropzoneHint = document.getElementById('dropzone-hint');
const previewContainer = document.getElementById('reference-previews');
const presetButtons = Array.from(document.querySelectorAll('.preset-option'));
const dropzoneBaseHint = dropzoneHint ? dropzoneHint.textContent.trim() : '';
const PRESET_CATEGORY_LABELS = {
  expression: 'Expression',
  art_style: 'Art style',
  camera: 'Camera angle',
  lighting: 'Lighting & mood',
  quality: 'Quality & effects'
};
const MAX_REFERENCE_IMAGES = 10;
let referenceFiles = [];
let referenceIdCounter = 0;

updateDropzoneHint();
renderReferencePreviews();

presetButtons.forEach(button => {
  button.addEventListener('click', () => {
    button.classList.toggle('selected');
  });
});

if (previewContainer) {
  previewContainer.addEventListener('click', (event) => {
    const target = event.target.closest('.thumb');
    if (!target) return;
    const refId = target.getAttribute('data-ref-id');
    if (!refId) return;
    removeReferenceById(refId);
  });
}

async function filesToDataUrls(fileLike) {
  const files = Array.from(fileLike || []);
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

function clearOutput() {
  outputEl.innerHTML = '';
}

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
      img.src = 'data:image/jpeg;base64,' + item.b64_json;
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
    dl.href = href;
    dl.textContent = 'Open';
    meta.appendChild(size);
    meta.appendChild(dl);

    card.appendChild(imgWrap);
    card.appendChild(meta);
    outputEl.appendChild(card);
  }
}

function updateDropzoneHint() {
  if (!dropzoneHint) return;
  if (!referenceFiles.length) {
    dropzoneHint.textContent = dropzoneBaseHint || 'Up to 10 PNG or JPEG files';
  } else {
    dropzoneHint.textContent = 'Selected: ' + referenceFiles.length + ' / ' + MAX_REFERENCE_IMAGES;
  }
}

function renderReferencePreviews() {
  if (!previewContainer) return;
  previewContainer.innerHTML = '';
  referenceFiles.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.setAttribute('data-ref-id', item.id);
    button.setAttribute('aria-label', 'Remove reference image ' + (index + 1));

    const img = document.createElement('img');
    img.src = item.preview;
    img.alt = 'Reference ' + (index + 1);
    button.appendChild(img);

    previewContainer.appendChild(button);
  });
}

function revokePreview(item) {
  if (item && item.preview) {
    URL.revokeObjectURL(item.preview);
  }
}

function removeReferenceById(id) {
  const index = referenceFiles.findIndex(item => item.id === id);
  if (index === -1) return;
  const [removed] = referenceFiles.splice(index, 1);
  revokePreview(removed);
  renderReferencePreviews();
  updateDropzoneHint();
  statusEl.textContent = 'Removed reference image.';
}

function resetReferenceStore() {
  referenceFiles.forEach(revokePreview);
  referenceFiles = [];
  renderReferencePreviews();
  if (imageInput) imageInput.value = '';
  updateDropzoneHint();
}

function addReferenceFiles(files, { append = true } = {}) {
  const incoming = Array.from(files || []).filter(Boolean);
  if (!append) {
    resetReferenceStore();
  }
  if (!incoming.length) {
    updateDropzoneHint();
    return { added: 0, skippedType: 0, skippedLimit: 0 };
  }
  const valid = [];
  let skippedType = 0;
  for (const file of incoming) {
    if (file.type && file.type.startsWith('image/')) {
      valid.push(file);
    } else {
      skippedType += 1;
    }
  }
  const available = Math.max(0, MAX_REFERENCE_IMAGES - referenceFiles.length);
  const allowed = valid.slice(0, available);
  const skippedLimit = valid.length - allowed.length;
  const additions = allowed.map(file => ({
    file,
    id: 'ref-' + Date.now() + '-' + (referenceIdCounter++),
    preview: URL.createObjectURL(file)
  }));
  if (additions.length) {
    referenceFiles = referenceFiles.concat(additions);
  }
  renderReferencePreviews();
  updateDropzoneHint();
  return { added: additions.length, skippedType, skippedLimit };
}

function handleReferenceAddResult(result) {
  if (!result) return;
  const { skippedType, skippedLimit } = result;
  if (skippedType && skippedLimit) {
    statusEl.textContent = 'Only PNG or JPEG files are allowed and the limit is 10 images.';
  } else if (skippedType) {
    statusEl.textContent = 'Only PNG or JPEG images are allowed.';
  } else if (skippedLimit) {
    statusEl.textContent = 'You can upload up to 10 reference images.';
  }
}

function collectPresetSelections() {
  const selections = {};
  for (const button of presetButtons) {
    if (!button.classList.contains('selected')) continue;
    const slug = button.getAttribute('data-preset-category') || 'other';
    const label = PRESET_CATEGORY_LABELS[slug] || slug;
    if (!selections[label]) {
      selections[label] = [];
    }
    selections[label].push(button.getAttribute('data-preset-value'));
  }
  return selections;
}

function formatPresetSummary(selections) {
  const entries = Object.entries(selections);
  if (!entries.length) return '';
  return entries.map(([category, items]) => category + ': ' + items.join(', ')).join('\n');
}

if (browseButton && imageInput) {
  browseButton.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', () => {
    const result = addReferenceFiles(imageInput.files, { append: false });
    handleReferenceAddResult(result);
    imageInput.value = '';
  });
}

if (clearButton) {
  clearButton.addEventListener('click', () => {
    if (!referenceFiles.length) {
      statusEl.textContent = 'No reference images to clear.';
      return;
    }
    resetReferenceStore();
    statusEl.textContent = 'Cleared reference images.';
  });
}

if (dropzone) {
  const leave = () => dropzone.classList.remove('dragover');
  dropzone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  dropzone.addEventListener('dragleave', () => {
    leave();
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    leave();
    const files = e.dataTransfer ? e.dataTransfer.files : null;
    const result = addReferenceFiles(files);
    handleReferenceAddResult(result);
  });
  dropzone.addEventListener('paste', (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const files = items.map(item => item.kind === 'file' ? item.getAsFile() : null).filter(Boolean);
    if (files.length) {
      e.preventDefault();
      const result = addReferenceFiles(files);
      handleReferenceAddResult(result);
    }
  });
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (browseButton) browseButton.click();
    }
  });
  dropzone.addEventListener('click', (e) => {
    if (e.target === dropzone && browseButton) {
      browseButton.click();
    }
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setBusy(true);
  clearOutput();
  try {
    const model = document.getElementById('model').value.trim();
    let prompt = document.getElementById('prompt').value.trim();
    const response_format = document.getElementById('response_format').value;
    const size = document.getElementById('size').value.trim();
    const watermark = document.getElementById('watermark').value === 'true';
    const count = document.getElementById('count').valueAsNumber || 1;
    const gen_mode = document.getElementById('gen_mode').value;
    const seq = document.getElementById('seq').value;
    const max_images = document.getElementById('max_images').valueAsNumber;
    const seedValue = document.getElementById('seed').value;
    const guidanceValue = document.getElementById('guidance_scale').value;
    const seed = seedValue === '' ? undefined : Number(seedValue);
    const guidance_scale = guidanceValue === '' ? undefined : Number(guidanceValue);

    const presets = collectPresetSelections();
    const presetSummary = formatPresetSummary(presets);
    if (presetSummary) {
      prompt = prompt + '\n\n[Preset options]\n' + presetSummary;
    }

    const image = await filesToDataUrls(referenceFiles.map(item => item.file));

    const body = { model, prompt, response_format, watermark, images_count: count, mode: gen_mode };
    if (image) body.image = image;
    if (size) body.size = size;
    let effectiveCount = Math.max(1, Math.min(15, Number(count) || 1));
    const supportsBatch = model.startsWith('seedream-4-0');
    if (effectiveCount > 1 && gen_mode === 'batch') {
      if (supportsBatch) {
        body.sequential_image_generation = 'auto';
        body.sequential_image_generation_options = { max_images: effectiveCount };
      } else {
        statusEl.textContent = 'Current model does not support batch image generation; using 1 image instead.';
      }
    } else if (gen_mode !== 'batch') {
      if (seq) body.sequential_image_generation = seq;
      if (!Number.isNaN(max_images) && max_images > 0) {
        body.sequential_image_generation_options = { max_images };
      }
    }
    if (typeof seed === 'number' && !Number.isNaN(seed)) body.seed = seed;
    if (typeof guidance_scale === 'number' && !Number.isNaN(guidance_scale)) body.guidance_scale = guidance_scale;
    body.stream = false;

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

    statusEl.textContent = 'Generated: ' + (json?.usage?.generated_images ?? (json?.data?.length || 0));
    renderImages(json.data || [], response_format);
  } catch (err) {
    statusEl.textContent = 'Error: ' + (err?.message || String(err));
  } finally {
    setBusy(false);
  }
});

if (aspectEl) {
  aspectEl.addEventListener('change', () => {
    const v = aspectEl.value;
    if (!v) return;
    const sizeInput = document.getElementById('size');
    sizeInput.value = v;
  });
}
