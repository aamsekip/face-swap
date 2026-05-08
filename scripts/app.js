const state = {
  targetFile: null,
  portraitFile: null,
  uploadId: null,
  lastPrompt: '',
  lastGeneratePayload: null,
  progressTimer: null,
};

const basePrompt = 'Replace the face in the target thumbnail with the face from the uploaded portrait while preserving original pose, lighting, composition, expression, cinematic quality, and background. Make the result realistic, seamless, detailed, and natural.';

const els = {
  form: document.querySelector('#faceSwapForm'),
  targetInput: document.querySelector('#targetInput'),
  portraitInput: document.querySelector('#portraitInput'),
  targetPreview: document.querySelector('#targetPreview'),
  portraitPreview: document.querySelector('#portraitPreview'),
  portraitCropPreview: document.querySelector('#portraitCropPreview'),
  cropPlaceholder: document.querySelector('#cropPlaceholder'),
  faceValidationText: document.querySelector('#faceValidationText'),
  promptInput: document.querySelector('#promptInput'),
  resetBtn: document.querySelector('#resetBtn'),
  generateBtn: document.querySelector('#generateBtn'),
  beforeImage: document.querySelector('#beforeImage'),
  afterImage: document.querySelector('#afterImage'),
  afterWrap: document.querySelector('#afterWrap'),
  compareSlider: document.querySelector('#compareSlider'),
  compareEmpty: document.querySelector('#compareEmpty'),
  downloadBtn: document.querySelector('#downloadBtn'),
  copyPromptBtn: document.querySelector('#copyPromptBtn'),
  copyPromptHero: document.querySelector('#copyPromptHero'),
  finalPromptText: document.querySelector('#finalPromptText'),
  loadingOverlay: document.querySelector('#loadingOverlay'),
  progressBar: document.querySelector('#progressBar'),
  retryBtn: document.querySelector('#retryBtn'),
  toast: document.querySelector('#toast'),
  historyGrid: document.querySelector('#historyGrid'),
  refreshHistory: document.querySelector('#refreshHistory'),
};

function showToast(message, type = 'success') {
  els.toast.textContent = message;
  els.toast.className = `toast show ${type}`;
  window.setTimeout(() => els.toast.classList.remove('show'), 4200);
}

function setPreview(input, preview, file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.hidden = false;

  if (input === els.targetInput) {
    els.beforeImage.src = url;
    els.compareEmpty.style.display = 'none';
  }

  if (input === els.portraitInput) {
    els.portraitCropPreview.src = url;
    els.portraitCropPreview.hidden = false;
    els.cropPlaceholder.hidden = true;
    validatePortraitFace(file);
  }
}

function validateFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  const maxMb = 8;
  if (!allowed.includes(file.type)) {
    throw new Error('Format gambar harus JPG, PNG, atau WEBP.');
  }
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`Ukuran gambar maksimal ${maxMb}MB.`);
  }
}

async function validatePortraitFace(file) {
  if (!('FaceDetector' in window)) {
    els.faceValidationText.textContent = 'Browser belum mendukung FaceDetector. Pastikan portrait hanya berisi 1 wajah utama yang jelas.';
    return;
  }

  try {
    const image = await createImageBitmap(file);
    const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
    const faces = await detector.detect(image);

    if (faces.length === 1) {
      els.faceValidationText.textContent = 'Validasi wajah: 1 wajah utama terdeteksi.';
      els.faceValidationText.style.color = 'var(--success)';
    } else if (faces.length === 0) {
      els.faceValidationText.textContent = 'Tidak ada wajah terdeteksi. Gunakan portrait yang lebih jelas.';
      els.faceValidationText.style.color = 'var(--danger)';
    } else {
      els.faceValidationText.textContent = `${faces.length} wajah terdeteksi. Gunakan foto dengan hanya 1 wajah utama.`;
      els.faceValidationText.style.color = 'var(--danger)';
    }
  } catch {
    els.faceValidationText.textContent = 'Validasi wajah browser gagal. Lanjutkan hanya jika portrait berisi 1 wajah utama.';
  }
}

function handleFileInput(input, key, preview) {
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      validateFile(file);
      state[key] = file;
      setPreview(input, preview, file);
      showToast(`${file.name} siap digunakan.`);
    } catch (error) {
      input.value = '';
      state[key] = null;
      showToast(error.message, 'error');
    }
  });
}

function setupDropZones() {
  document.querySelectorAll('.drop-zone').forEach((zone) => {
    const input = zone.querySelector('input');
    ['dragenter', 'dragover'].forEach((eventName) => {
      zone.addEventListener(eventName, (event) => {
        event.preventDefault();
        zone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((eventName) => {
      zone.addEventListener(eventName, () => zone.classList.remove('drag-over'));
    });
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event('change'));
    });
  });
}

function addQuickPrompts() {
  document.querySelectorAll('[data-prompt]').forEach((button) => {
    button.addEventListener('click', () => {
      const current = els.promptInput.value.trim();
      els.promptInput.value = current ? `${current}, ${button.dataset.prompt}` : button.dataset.prompt;
    });
  });
}

async function uploadImages() {
  const formData = new FormData();
  formData.append('target', state.targetFile);
  formData.append('portrait', state.portraitFile);

  const response = await fetch('/upload', { method: 'POST', body: formData });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Upload gagal.');
  state.uploadId = data.uploadId;
  return data.uploadId;
}

async function generateFaceSwap(uploadId, prompt) {
  state.lastGeneratePayload = { uploadId, prompt };
  const response = await fetch('/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, prompt }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Generate gagal.');
  return data.result;
}

function setLoading(isLoading, allowRetry = false) {
  els.loadingOverlay.hidden = !isLoading && !allowRetry;
  els.retryBtn.hidden = !allowRetry;
  els.generateBtn.disabled = isLoading;

  if (isLoading) {
    let progress = 8;
    els.progressBar.style.width = `${progress}%`;
    state.progressTimer = window.setInterval(() => {
      progress = Math.min(progress + Math.random() * 9, 92);
      els.progressBar.style.width = `${progress}%`;
    }, 600);
  } else {
    window.clearInterval(state.progressTimer);
    els.progressBar.style.width = allowRetry ? '100%' : '0%';
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!state.targetFile || !state.portraitFile) {
    showToast('Upload target dan portrait terlebih dahulu.', 'error');
    return;
  }

  try {
    setLoading(true);
    const uploadId = await uploadImages();
    const result = await generateFaceSwap(uploadId, els.promptInput.value.trim());
    renderResult(result);
    await loadHistory();
    setLoading(false);
    showToast('Face swap berhasil dibuat.');
  } catch (error) {
    setLoading(false, true);
    showToast(error.message, 'error');
  }
}

function renderResult(result) {
  const cacheBustUrl = `${result.url}?t=${Date.now()}`;
  els.afterImage.src = cacheBustUrl;
  els.afterWrap.style.width = `${els.compareSlider.value}%`;
  els.downloadBtn.href = result.url;
  els.downloadBtn.classList.remove('disabled');
  els.finalPromptText.textContent = result.prompt;
  state.lastPrompt = result.prompt;
  els.compareEmpty.style.display = 'none';
}

async function loadHistory() {
  const response = await fetch('/history');
  const data = await response.json();
  if (!response.ok) return;

  els.historyGrid.innerHTML = '';
  if (!data.history.length) {
    els.historyGrid.innerHTML = '<p class="muted">Belum ada history generate.</p>';
    return;
  }

  data.history.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'history-item';
    card.innerHTML = `
      <img src="${item.url}" alt="History result" loading="lazy" />
      <div><strong>${item.model}</strong><br /><small>${new Date(item.createdAt).toLocaleString('id-ID')}</small></div>
    `;
    card.addEventListener('click', () => renderResult(item));
    els.historyGrid.appendChild(card);
  });
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  showToast('Prompt berhasil disalin.');
}

function resetForm() {
  els.form.reset();
  state.targetFile = null;
  state.portraitFile = null;
  state.uploadId = null;
  [els.targetPreview, els.portraitPreview, els.portraitCropPreview].forEach((img) => {
    img.removeAttribute('src');
    img.hidden = true;
  });
  els.cropPlaceholder.hidden = false;
  els.faceValidationText.textContent = 'Validasi wajah akan berjalan otomatis di browser jika FaceDetector tersedia.';
  els.faceValidationText.style.color = 'var(--muted)';
  els.compareEmpty.style.display = 'grid';
  els.downloadBtn.classList.add('disabled');
  showToast('Upload direset.');
}

handleFileInput(els.targetInput, 'targetFile', els.targetPreview);
handleFileInput(els.portraitInput, 'portraitFile', els.portraitPreview);
setupDropZones();
addQuickPrompts();
loadHistory();

els.form.addEventListener('submit', handleSubmit);
els.resetBtn.addEventListener('click', resetForm);
els.compareSlider.addEventListener('input', () => { els.afterWrap.style.width = `${els.compareSlider.value}%`; });
els.copyPromptBtn.addEventListener('click', () => copyText(state.lastPrompt || basePrompt));
els.copyPromptHero.addEventListener('click', () => copyText(basePrompt));
els.refreshHistory.addEventListener('click', loadHistory);
els.retryBtn.addEventListener('click', async () => {
  els.retryBtn.hidden = true;
  if (!state.targetFile || !state.portraitFile) {
    showToast('Upload ulang gambar sebelum retry.', 'error');
    setLoading(false);
    return;
  }
  await handleSubmit(new Event('submit'));
});
