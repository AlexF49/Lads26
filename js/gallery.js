import { supabase } from './supabaseClient.js';
import { SUPABASE_URL } from './config.js';

const STORAGE_KEY = 'lads26_player_id';
const BUCKET = 'gallery-photos';

const statusEl = document.getElementById('status');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const gridEl = document.getElementById('gallery-grid');
const lightboxEl = document.getElementById('lightbox');
const lightboxImgEl = document.getElementById('lightbox-img');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('status--error', isError);
}

function publicUrl(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function loadGallery() {
  const { data, error } = await supabase
    .from('photos')
    .select('id, storage_path, caption, created_at, players ( name )')
    .order('created_at', { ascending: false });

  if (error) {
    setStatus(`Could not load gallery: ${error.message}`, true);
    return;
  }

  setStatus('');
  gridEl.innerHTML = data
    .map(
      (p) => `
    <button type="button" class="gallery-tile" data-url="${publicUrl(p.storage_path)}">
      <img src="${publicUrl(p.storage_path)}" alt="${p.caption ?? 'Lads 2026 photo'}" loading="lazy" />
    </button>`
    )
    .join('');

  gridEl.querySelectorAll('[data-url]').forEach((btn) => {
    btn.addEventListener('click', () => {
      lightboxImgEl.src = btn.dataset.url;
      lightboxEl.hidden = false;
    });
  });
}

lightboxEl.addEventListener('click', () => {
  lightboxEl.hidden = true;
  lightboxImgEl.src = '';
});

uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const files = [...fileInput.files];
  if (!files.length) return;

  const playerId = localStorage.getItem(STORAGE_KEY);
  let uploaded = 0;

  for (const file of files) {
    setStatus(`Uploading ${uploaded + 1} of ${files.length}…`);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || 'image/jpeg',
    });
    if (uploadError) {
      setStatus(`Could not upload ${file.name}: ${uploadError.message}`, true);
      continue;
    }

    const { error: insertError } = await supabase.from('photos').insert({
      storage_path: path,
      uploaded_by: playerId || null,
    });
    if (insertError) {
      setStatus(`Uploaded but could not save ${file.name}: ${insertError.message}`, true);
      continue;
    }
    uploaded += 1;
  }

  fileInput.value = '';
  setStatus(uploaded === files.length ? `Uploaded ${uploaded} photo${uploaded === 1 ? '' : 's'} ✓` : `Uploaded ${uploaded} of ${files.length}`);
  loadGallery();
});

async function init() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    window.location.href = 'index.html';
    return;
  }
  setStatus('Loading…');
  await loadGallery();
}

init();
