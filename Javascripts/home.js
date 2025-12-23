
// ==============================
// constants (animasi assets)
// ==============================
const BUBBLE_FRAMES = [
  'Assets/fish-photobooth/homepage/animated-bubbles-home/bubble-1.png',
  'Assets/fish-photobooth/homepage/animated-bubbles-home/bubble-2.png',
  'Assets/fish-photobooth/homepage/animated-bubbles-home/bubble-3.png',
];

const PHOTOBOOTH_FRAMES = Array.from({ length: 16 }, (_, i) =>
  `Assets/fish-photobooth/homepage/animated-photobooth-mock/${i + 1}.png`
);

const PHOTOBOOTH_FRAME_INTERVAL = 200; // ms

// ==============================
// dom references
// ==============================
const selectButton = document.getElementById('select-button');
const bubbleEl = document.querySelector('.bubbles-mock');
const photoboothEl = document.querySelector('.photobooth-mock');
const logoEl = document.querySelector('.logo');

// ==============================
// bubble animation
// ==============================
let bubbleAnimating = false;
let currentBubbleFrame = 0;
let bubbleAnimationFrameId = null;

function animateBubbles() {
  if (!bubbleAnimating || !bubbleEl) return;
  bubbleEl.style.backgroundImage = `url('${BUBBLE_FRAMES[currentBubbleFrame]}')`;
  currentBubbleFrame = (currentBubbleFrame + 1) % BUBBLE_FRAMES.length;
  bubbleAnimationFrameId = setTimeout(() => {
    requestAnimationFrame(animateBubbles);
  }, 200);
}
function startBubbleAnimation() {
  if (!bubbleAnimating) {
    bubbleAnimating = true;
    animateBubbles();
  }
}
function stopBubbleAnimation() {
  bubbleAnimating = false;
  clearTimeout(bubbleAnimationFrameId);
}

// ==============================
// fish animations
// ==============================
const fishes = [
  { el: document.querySelector('.fish-mock-1'), rotation: 7.52, dir: -1 },
  { el: document.querySelector('.fish-mock-2'), rotation: 7.52, dir: 1 },
  { el: document.querySelector('.fish-mock-3'), rotation: 7.52, dir: -1 },
];

let fishAnimating = false;
let fishTimeouts = [];

function animateFish(index) {
  if (!fishAnimating) return;
  const fish = fishes[index];
  if (!fish.el) return;
  fish.el.style.transform = `rotate(${fish.rotation * fish.dir}deg)`;
  fish.dir *= -1;
  fishTimeouts[index] = setTimeout(() => {
    requestAnimationFrame(() => animateFish(index));
  }, 200);
}
function startFishAnimation() {
  if (fishAnimating) return;
  fishAnimating = true;
  fishes.forEach((_, i) => animateFish(i));
}
function stopFishAnimation() {
  fishAnimating = false;
  fishTimeouts.forEach(clearTimeout);
  fishes.forEach(f => {
    if (f.el) f.el.style.transform = 'rotate(0deg)';
  });
}

// ==============================
// main photobooth frame animation
// ==============================
const loadedFrames = PHOTOBOOTH_FRAMES.map(src => {
  const img = new Image();
  img.src = src;
  return img;
});
let currentFrame = 0;
let direction = 1;
let lastFrameTime = 0;

function animatePhotobooth(timestamp) {
  if (!photoboothEl) return;
  if (timestamp - lastFrameTime >= PHOTOBOOTH_FRAME_INTERVAL) {
    const frame = loadedFrames[currentFrame];
    if (frame.complete) {
      photoboothEl.style.backgroundImage = `url('${frame.src}')`;
      photoboothEl.style.transition = 'opacity 0.15s';
      photoboothEl.style.opacity = 1;

      currentFrame += direction;
      if (currentFrame === 0 || currentFrame === loadedFrames.length - 1) {
        direction *= -1;
      }
      lastFrameTime = timestamp;
    }
  }
  requestAnimationFrame(animatePhotobooth);
}
requestAnimationFrame(animatePhotobooth);

// ==============================
// safe navigation helper (logging optional)
// ==============================
function addSafeNavigation(button, url, id) {
  if (!button) return;
  button.addEventListener('click', e => {
    if (typeof gtag === 'function') {
      gtag('event', 'button_click', {
        button_id: id || button.id || 'no-id',
        button_text: button.innerText || 'no-text',
      });
    }
    e.preventDefault();
    setTimeout(() => (window.location.href = url), 100);
  });
}

// Landing → Menu
if (selectButton) {
  ['mouseenter', 'mousedown'].forEach(evt =>
    selectButton.addEventListener(evt, () => {
      startBubbleAnimation();
      startFishAnimation();
      startPhotostripAnimation();
    })
  );
  ['mouseleave', 'mouseup'].forEach(evt =>
    selectButton.addEventListener(evt, () => {
      stopBubbleAnimation();
      stopFishAnimation();
      stopPhotostripAnimation();
    })
  );
  addSafeNavigation(selectButton, 'menu.html');
}
// Logo → Index
addSafeNavigation(logoEl, 'index.html', 'logo');

// ==============================
// MENU: pilih frame -> Next -> pindah ke actions.html
// ==============================
(function initMenuFrameToNextPage() {
  const frameEls = document.querySelectorAll('#frameOptions .frame');
  const nextBtn = document.getElementById('next-button');
  if (!frameEls.length || !nextBtn) return; // bukan di menu

  let selectedFrame = null;
  try { localStorage.removeItem('selectedFrame'); } catch {}

  frameEls.forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#frameOptions .frame.selected').forEach(s => s.classList.remove('selected'));
      el.classList.add('selected');

      const fileName = el.getAttribute('data-frame');                      // ex: "frame1.png"
      const id  = (fileName || '').replace(/\.\w+$/,'') || (el.alt || 'frame');
      const src = el.src;                                                  // path penuh dari thumbnail (aman)
      const name = el.alt || id;

      selectedFrame = { id, src, name };
      try { localStorage.setItem('selectedFrame', JSON.stringify(selectedFrame)); } catch {}
      nextBtn.disabled = false;
    });
  });

  nextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!selectedFrame) return;
    const url = new URL('actions.html', window.location.origin);           // letakkan actions.html di ROOT
    url.searchParams.set('frameId', selectedFrame.id);
    url.searchParams.set('frameSrc', selectedFrame.src);
    location.href = url.toString();
  });
})();
