import { supabase } from './supabaseClient.js';
import { SUPABASE_URL } from './config.js';

const STORAGE_KEY = 'lads26_player_id';
const BUCKET = 'gallery-photos';
const CURRENT_YEAR = 2026;

const statusEl = document.getElementById('status');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const yearTabsEl = document.getElementById('year-tabs');
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

let allPhotos = [];
let activeYear = CURRENT_YEAR;

function renderGrid() {
  const photos = allPhotos.filter((p) => p.year === activeYear);
  gridEl.innerHTML = photos.length
    ? photos
        .map(
          (p) => `
    <button type="button" class="gallery-tile" data-url="${publicUrl(p.storage_path)}">
      <img src="${publicUrl(p.storage_path)}" alt="${p.caption ?? 'Lads 2026 photo'}" />
    </button>`
        )
        .join('')
    : `<p class="gallery-empty">No photos for ${activeYear} yet.</p>`;

  gridEl.querySelectorAll('[data-url]').forEach((btn) => {
    btn.addEventListener('click', () => {
      lightboxImgEl.src = btn.dataset.url;
      lightboxEl.hidden = false;
    });
  });
}

function renderYearTabs() {
  const years = [...new Set(allPhotos.map((p) => p.year))];
  if (!years.includes(CURRENT_YEAR)) years.push(CURRENT_YEAR);
  years.sort((a, b) => b - a);

  yearTabsEl.innerHTML = years
    .map((y) => `<button type="button" class="lb-tab${y === activeYear ? ' lb-tab--active' : ''}" data-year="${y}">${y}</button>`)
    .join('');

  yearTabsEl.querySelectorAll('[data-year]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeYear = parseInt(btn.dataset.year, 10);
      yearTabsEl.querySelectorAll('.lb-tab').forEach((b) => b.classList.remove('lb-tab--active'));
      btn.classList.add('lb-tab--active');
      renderGrid();
    });
  });
}

async function loadGallery() {
  const { data, error } = await supabase
    .from('photos')
    .select('id, storage_path, caption, year, created_at, players ( name )')
    .order('created_at', { ascending: false });

  if (error) {
    setStatus(`Could not load gallery: ${error.message}`, true);
    return;
  }

  setStatus('');
  allPhotos = data ?? [];
  const years = [...new Set(allPhotos.map((p) => p.year))];
  if (!years.includes(activeYear)) activeYear = years.length ? Math.max(...years) : CURRENT_YEAR;
  renderYearTabs();
  renderGrid();
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
      year: CURRENT_YEAR,
    });
    if (insertError) {
      setStatus(`Uploaded but could not save ${file.name}: ${insertError.message}`, true);
      continue;
    }
    uploaded += 1;
  }

  fileInput.value = '';
  setStatus(uploaded === files.length ? `Uploaded ${uploaded} photo${uploaded === 1 ? '' : 's'} ✓` : `Uploaded ${uploaded} of ${files.length}`);
  activeYear = CURRENT_YEAR;
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
