
// ==============================
// constants
// ==============================
const WIDTH = 1176;
const HEIGHT = 1470;
const HALF = HEIGHT / 2;

// kalau mau auto pindah ke final tanpa klik Ready, ubah true
const AUTO_REDIRECT_TO_FINAL = false;

// ==============================
// dom elements
// ==============================
const elements = {
  booth: document.getElementById('booth'),                         // container photobooth
  video: document.getElementById('liveVideo'),
  canvas: document.getElementById('finalCanvas'),
  ctx: document.getElementById('finalCanvas')?.getContext('2d'),
  takePhotoBtn: document.getElementById('takePhoto'),
  readyBtn: document.getElementById('readyButton'),
  countdownEl: document.querySelector('.countdown-timer'),
  frameOverlayEl: document.querySelector('.frame-overlay'),
  logoEl: document.querySelector('.logo')
};

let photoStage = 0; // 0 = top, 1 = bottom, 2 = done

// ==============================
// helper: amanin element wajib
// ==============================
function assertRequiredElements() {
  const required = ['booth', 'video', 'canvas', 'ctx', 'takePhotoBtn', 'countdownEl'];
  const missing = required.filter(k => !elements[k]);
  if (missing.length) {
    console.error('Missing elements:', missing);
    alert('Halaman camera belum lengkap. Cek ID/kelas: ' + missing.join(', '));
    return false;
  }
  return true;
}

// ==============================
// posisi video (setengah atas/bawah) di dalam booth
// ==============================
const moveVideoToHalf = (i) => {
  const { booth, video } = elements;

  // pastikan container relative
  if (booth) booth.style.position = booth.style.position || 'relative';

  video.style.display = 'block';
  video.style.position = 'absolute';
  video.style.left = '0';
  video.style.width = '100%';
  video.style.height = '50%';
  video.style.objectFit = 'cover';

  // taruh di atas / bawah
  video.style.top = i === 0 ? '0' : '50%';
};

// ==============================
// countdown 3..2..1.. shoot
// ==============================
const startCountdown = (callback) => {
  let count = 3;
  const { countdownEl } = elements;

  countdownEl.textContent = count;
  countdownEl.style.display = 'flex';

  const intervalId = setInterval(() => {
    count--;
    if (count > 0) {
      countdownEl.textContent = count;
    } else {
      clearInterval(intervalId);
      countdownEl.style.display = 'none';
      callback();
    }
  }, 1000);
};

// ==============================
// BACA FRAME PILIHAN (dari menu/home.js)
// ==============================
function getSelectedFrameSrc() {
  const params = new URLSearchParams(location.search);

  // 1) dari query ?frameSrc=
  const qs = params.get('frameSrc');
  if (qs) return qs;

  // 2) dari localStorage selectedFrame
  try {
    const saved = JSON.parse(localStorage.getItem('selectedFrame') || '{}');
    if (saved?.src) return saved.src;
  } catch {}

  // 3) fallback default
  return 'Assets/fish-photobooth/camerapage/frame.png';
}

const frameSrc = getSelectedFrameSrc();

// set overlay tampilan di camera.html (biar user lihat frame yg dipilih)
if (elements.frameOverlayEl) {
  elements.frameOverlayEl.src = frameSrc;
}

// buat image untuk overlay final di canvas
const frameImage = new Image();
frameImage.crossOrigin = 'anonymous';
frameImage.src = frameSrc;

// ==============================
// capture video ke canvas (atas lalu bawah)
// ==============================
const capturePhoto = () => {
  const { video, ctx, takePhotoBtn } = elements;
  const yOffset = photoStage === 0 ? 0 : HALF;

  const vW = video.videoWidth;
  const vH = video.videoHeight;

  // jaga-jaga kalau metadata belum siap
  if (!vW || !vH) {
    // coba lagi sebentar
    setTimeout(() => capturePhoto(), 150);
    return;
  }

  // crop video agar proporsional terhadap setengah kanvas
  const targetAspect = WIDTH / HALF;
  const vAspect = vW / vH;

  let sx, sy, sw, sh;

  if (vAspect > targetAspect) {
    // video lebih lebar -> potong kiri kanan
    sh = vH;
    sw = vH * targetAspect;
    sx = (vW - sw) / 2;
    sy = 0;
  } else {
    // video lebih tinggi -> potong atas bawah
    sw = vW;
    sh = vW / targetAspect;
    sx = 0;
    sy = (vH - sh) / 2;
  }

  // mirror horizontal (kamera depan) dan gambar ke setengah kanvas
  ctx.save();
  ctx.translate(WIDTH, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, sw, sh, 0, yOffset, WIDTH, HALF);
  ctx.restore();

  photoStage++;

  if (photoStage === 1) {
    // jepretan pertama beres -> pindah video ke bawah
    moveVideoToHalf(1);
    takePhotoBtn.disabled = false;
  } else if (photoStage === 2) {
    finalizePhotoStrip();
  }
};

// ==============================
// finalize: overlay frame pilihan + simpan + lanjut
// ==============================
const finalizePhotoStrip = () => {
  const { video, ctx, canvas, takePhotoBtn, readyBtn } = elements;

  // sembunyikan video (biar hasil keliatan)
  video.style.display = 'none';

  // tombol capture dimatikan
  if (takePhotoBtn) {
    takePhotoBtn.disabled = true;
    takePhotoBtn.style.display = 'none';
  }

  const finish = () => {
    // overlay PNG transparan menutupi seluruh kanvas
    ctx.drawImage(frameImage, 0, 0, WIDTH, HEIGHT);

    // simpan ke localStorage -> dipakai final.js / final.html
    const dataURL = canvas.toDataURL('image/png');
    try { localStorage.setItem('photoStrip', dataURL); } catch {}

    // stop kamera track
    const stream = elements.video.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());

    // tampilkan tombol Ready (sesuai camera.html kamu)
    if (readyBtn) {
      readyBtn.style.display = 'inline-flex';
      readyBtn.disabled = false;

      readyBtn.onclick = () => {
        window.location.href = 'final.html';
      };
    }

    // opsi auto redirect
    if (AUTO_REDIRECT_TO_FINAL) {
      setTimeout(() => (window.location.href = 'final.html'), 250);
    }
  };

  if (frameImage.complete) {
    finish();
  } else {
    frameImage.onload = finish;
    frameImage.onerror = () => {
      // kalau frame gagal load, tetap simpan tanpa overlay
      const dataURL = canvas.toDataURL('image/png');
      try { localStorage.setItem('photoStrip', dataURL); } catch {}

      const stream = elements.video.srcObject;
      if (stream) stream.getTracks().forEach(t => t.stop());

      if (readyBtn) {
        readyBtn.style.display = 'inline-flex';
        readyBtn.disabled = false;
        readyBtn.onclick = () => (window.location.href = 'final.html');
      }

      if (AUTO_REDIRECT_TO_FINAL) {
        setTimeout(() => (window.location.href = 'final.html'), 250);
      }
    };
  }
};

// ==============================
// setup kamera
// ==============================
const setupCamera = () => {
  navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 2560 },
      height: { ideal: 1440 },
      facingMode: 'user'
    },
    audio: false
  })
  .then(stream => {
    elements.video.srcObject = stream;

    // tunggu metadata biar videoWidth/videoHeight siap
    elements.video.onloadedmetadata = () => {
      elements.video.play();
      moveVideoToHalf(0);
    };
  })
  .catch(err => alert('Camera access failed: ' + err));
};

// ==============================
// event handlers
// ==============================
const setupEventListeners = () => {
  const { takePhotoBtn } = elements;

  // tombol capture: countdown -> capture
  takePhotoBtn.addEventListener('click', () => {
    if (photoStage > 1) return; // sudah 2 jepretan
    takePhotoBtn.disabled = true;
    startCountdown(capturePhoto);
  });

  // reposition video saat resize
  window.addEventListener('resize', () => {
    if (photoStage === 0) moveVideoToHalf(0);
    else if (photoStage === 1) moveVideoToHalf(1);
  });

  // logo redirect
  if (elements.logoEl) {
    elements.logoEl.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
};

// ==============================
// init
// ==============================
const initPhotoBooth = () => {
  if (!assertRequiredElements()) return;

  // siapkan canvas putih di awal
  elements.ctx.fillStyle = '#fff';
  elements.ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // hide ready button dulu (sesuai HTML kamu)
  if (elements.readyBtn) {
    elements.readyBtn.disabled = true;
    elements.readyBtn.style.display = 'none';
  }

  setupCamera();
  setupEventListeners();
};

document.addEventListener('DOMContentLoaded', initPhotoBooth);
