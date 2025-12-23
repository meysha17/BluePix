
// Javascripts/upload.js

const WIDTH = 1176, HEIGHT = 1470, HALF = HEIGHT / 2;

const el = {
  canvas: document.getElementById('finalCanvas'),
  ctx: document.getElementById('finalCanvas')?.getContext('2d'),
  fileInput: document.getElementById('uploadPhotoInput'),
  uploadBtn: document.getElementById('uploadPhoto'),
  readyBtn: document.getElementById('readyButton'),
  overlay: document.getElementById('frameOverlay'),
};

if (!el.canvas || !el.ctx) {
  alert('Canvas tidak ditemukan. Pastikan ada <canvas id="finalCanvas">');
  throw new Error('finalCanvas missing');
}

// =========================
// ambil frame pilihan
// =========================
const params = new URLSearchParams(location.search);
let saved = {};
try { saved = JSON.parse(localStorage.getItem('selectedFrame') || '{}'); } catch {}

const frameSrc =
  params.get('frameSrc') ||
  saved.src ||
  'Assets/fish-photobooth/camerapage/frame.png';

// overlay preview (DOM)
if (el.overlay) {
  el.overlay.src = frameSrc;
  el.overlay.onerror = () => {
    console.error('Frame overlay gagal load:', frameSrc);
    el.overlay.src = 'Assets/fish-photobooth/camerapage/frame.png';
  };
}

// preload frame untuk ditaruh ke canvas saat finalize
const frameImg = new Image();
frameImg.crossOrigin = 'anonymous';
frameImg.src = frameSrc;

// =========================
// state untuk 2 slot foto
// =========================
const slots = [
  { img: null, offsetX: 0, offsetY: 0, scale: 1 }, // TOP
  { img: null, offsetX: 0, offsetY: 0, scale: 1 }, // BOTTOM
];

let uploadStage = 0; // 0 -> upload top, 1 -> upload bottom, 2 -> done

// drag state
let dragging = false;
let activeSlot = 0;         // slot yg sedang di-drag (0 top / 1 bottom)
let lastX = 0, lastY = 0;

// =========================
// helper
// =========================
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function slotFromCanvasY(y) {
  return y < HALF ? 0 : 1;
}

/**
 * Draw image "cover" ke area target (W x H) + bisa digeser via offsetX/offsetY
 * offsetX/offsetY dalam px (destination space), disimpan per slot.
 */

function drawCover(img, x, y, w, h, offsetX, offsetY, userScale = 1) {
  const iw = img.width, ih = img.height;

  // cover scale minimum
  const baseScale = Math.max(w / iw, h / ih);
  const scale = baseScale * userScale;

  const dw = iw * scale;
  const dh = ih * scale;

  // posisi tengah + offset user
  let dx = x + (w - dw) / 2 + offsetX;
  let dy = y + (h - dh) / 2 + offsetY;

  // clamp supaya area slot tetap ketutup (nggak ada bolong)
  dx = clamp(dx, x + (w - dw), x);
  dy = clamp(dy, y + (h - dh), y);

  // ✅ INI KUNCI: clip ke area slot (biar nggak nyebrang)
  el.ctx.save();
  el.ctx.beginPath();
  el.ctx.rect(x, y, w, h);
  el.ctx.clip();

  el.ctx.drawImage(img, dx, dy, dw, dh);

  el.ctx.restore();

  return { dx, dy, dw, dh };
}


function clearCanvasWhite() {
  el.ctx.clearRect(0, 0, WIDTH, HEIGHT);
  el.ctx.fillStyle = '#fff';
  el.ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function render() {
  clearCanvasWhite();

  // TOP slot
  if (slots[0].img) {
    drawCover(
      slots[0].img,
      0, 0, WIDTH, HALF,
      slots[0].offsetX, slots[0].offsetY,
      slots[0].scale
    );
  }

  // BOTTOM slot
  if (slots[1].img) {
    drawCover(
      slots[1].img,
      0, HALF, WIDTH, HALF,
      slots[1].offsetX, slots[1].offsetY,
      slots[1].scale
    );
  }

  // NOTE: frame overlay tampil via <img>, bukan digambar di sini.
  // frame baru digambar ke canvas saat finalize/ready.
}

function finalizeToCanvasAndSave() {
  // gambar frame ke canvas lalu simpan
  const finish = () => {
    el.ctx.drawImage(frameImg, 0, 0, WIDTH, HEIGHT);
    try {
      localStorage.setItem('photoStrip', el.canvas.toDataURL('image/png'));
    } catch {}
    window.location.href = 'final.html';
  };

  if (frameImg.complete) finish();
  else {
    frameImg.onload = finish;
    frameImg.onerror = () => {
      // kalau frame gagal load, tetap simpan tanpa overlay
      try {
        localStorage.setItem('photoStrip', el.canvas.toDataURL('image/png'));
      } catch {}
      window.location.href = 'final.html';
    };
  }
}

// =========================
// upload handlers
// =========================
function loadFileToSlot(file, slotIndex) {
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    URL.revokeObjectURL(url);

    slots[slotIndex].img = img;
    // reset offset biar mulai dari center
    slots[slotIndex].offsetX = 0;
    slots[slotIndex].offsetY = 0;
    slots[slotIndex].scale = 1;

    render();

    // update stage
    uploadStage = Math.min(uploadStage + 1, 2);

    if (uploadStage < 2) {
      el.uploadBtn.textContent = 'Upload Photo (2nd)';
    } else {
      el.uploadBtn.style.display = 'none';
      el.readyBtn.style.display = 'inline-block';
      el.readyBtn.disabled = false;
    }
  };

  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert('Gagal membaca gambar. Coba file lain ya.');
  };

  img.src = url;
}

// klik tombol upload
el.uploadBtn.addEventListener('click', () => el.fileInput.click());

// pilih file
el.fileInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  // uploadStage 0 -> slot 0 (top), 1 -> slot 1 (bottom)
  const slotIndex = uploadStage === 0 ? 0 : 1;
  loadFileToSlot(file, slotIndex);

  // reset input supaya bisa upload file yang sama lagi
  el.fileInput.value = '';
});

// Ready
el.readyBtn.addEventListener('click', () => {
  finalizeToCanvasAndSave();
});

// =========================
// DRAG: pointer events (mouse + touch)
// =========================
function canvasPointFromEvent(ev) {
  const rect = el.canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (WIDTH / rect.width);
  const y = (ev.clientY - rect.top) * (HEIGHT / rect.height);
  return { x, y };
}

el.canvas.addEventListener('pointerdown', (ev) => {
  // kalau belum ada gambar sama sekali, gak usah drag
  if (!slots[0].img && !slots[1].img) return;

  el.canvas.setPointerCapture(ev.pointerId);
  dragging = true;

  const p = canvasPointFromEvent(ev);
  activeSlot = slotFromCanvasY(p.y);

  // kalau slot itu belum ada gambar, pindah ke slot yg ada
  if (activeSlot === 0 && !slots[0].img && slots[1].img) activeSlot = 1;
  if (activeSlot === 1 && !slots[1].img && slots[0].img) activeSlot = 0;

  lastX = p.x;
  lastY = p.y;
});

el.canvas.addEventListener('pointermove', (ev) => {
  if (!dragging) return;
  if (!slots[activeSlot].img) return;

  const p = canvasPointFromEvent(ev);
  const dx = p.x - lastX;
  const dy = p.y - lastY;

  slots[activeSlot].offsetX += dx;
  slots[activeSlot].offsetY += dy;

  lastX = p.x;
  lastY = p.y;

  render();
});

function endDrag(ev) {
  dragging = false;
  try { el.canvas.releasePointerCapture(ev.pointerId); } catch {}
}

el.canvas.addEventListener('pointerup', endDrag);
el.canvas.addEventListener('pointercancel', endDrag);
el.canvas.addEventListener('pointerleave', () => { dragging = false; });

// =========================
// INIT
// =========================
document.addEventListener('DOMContentLoaded', () => {
  // hapus hasil lama tapi jangan sentuh selectedFrame
  try { localStorage.removeItem('photoStrip'); } catch {}
  clearCanvasWhite();
  render();

  // logo redirect
  const logo = document.querySelector('.logo');
  if (logo) logo.addEventListener('click', () => window.location.href = 'index.html');
});
``
