/**
 * Scan Sound Effects — Web Audio API (no external files needed)
 *
 * Provides auditory feedback for POS scanning operations:
 *  • initAudio()    — MUST be called once during a user-gesture (e.g. button click)
 *  • scanBeep()     — short high-pitched beep on successful scan detection
 *  • successChime() — two-tone ascending chime when item is added to cart
 *  • errorBuzz()    — low buzzy tone when scan fails or item is rejected
 *
 * All sounds are generated via OscillatorNode so they work offline and
 * add zero network overhead.
 *
 * IMPORTANT: Chrome's autoplay policy requires AudioContext to be created
 * or resumed during a direct user gesture (click/tap).  Call initAudio()
 * in the button handler that starts scanning, so that later callbacks
 * (camera QR detection, API responses) can play sounds freely.
 */

let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      // AudioContext not supported — fail silently
      return null;
    }
  }
  return ctx;
}

/**
 * Initialise (or resume) the AudioContext.  Call this inside a click/tap
 * handler so Chrome allows audio playback in subsequent async callbacks.
 */
export function initAudio() {
  const audio = getAudioContext();
  if (audio && audio.state === 'suspended') {
    audio.resume().catch(() => {});
  }
}

/** Play a tone through the Web Audio API. */
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.5,
) {
  const audio = getAudioContext();
  if (!audio || audio.state !== 'running') return;

  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  // Ramp up quickly to avoid initial click
  gain.gain.setValueAtTime(0.001, audio.currentTime);
  gain.gain.linearRampToValueAtTime(volume, audio.currentTime + 0.01);
  // Fade out to avoid end click
  gain.gain.setValueAtTime(volume, audio.currentTime + duration - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(audio.currentTime);
  oscillator.stop(audio.currentTime + duration);
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Short beep when the camera detects a QR code (before lookup).
 * ~150 ms, 1200 Hz sine — classic barcode-scanner feel.
 */
export function scanBeep() {
  playTone(1200, 0.15, 'sine', 0.5);
}

/**
 * Two-tone ascending chime when item is successfully added to cart.
 * 880 Hz → 1320 Hz (musical fifth), ~120 ms each.
 */
export function successChime() {
  playTone(880, 0.12, 'sine', 0.5);
  setTimeout(() => playTone(1320, 0.18, 'sine', 0.5), 130);
}

/**
 * Low buzzy tone when a scan fails or the item is rejected.
 * 200 Hz square wave, ~300 ms — unmistakably "error".
 */
export function errorBuzz() {
  playTone(200, 0.3, 'square', 0.35);
}

/**
 * Celebratory three-tone ascending chime when a sale is completed.
 * C5 → E5 → G5 (major triad), ~150 ms each — a satisfying "ka-ching".
 */
export function saleCompleteChime() {
  playTone(523, 0.12, 'sine', 0.45);       // C5
  setTimeout(() => playTone(659, 0.12, 'sine', 0.45), 140);  // E5
  setTimeout(() => playTone(784, 0.22, 'sine', 0.5), 280);   // G5 (sustained)
}
