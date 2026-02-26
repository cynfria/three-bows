/**
 * Bow Detector — MediaPipe Pose Landmarker (npm package)
 *
 * Calibrates the neutral nose-Y position over the first ~1s of frames,
 * then detects a bow when the nose drops BOW_DROP below that baseline.
 *
 * State machine: CALIBRATING → UPRIGHT → BOWING → RETURNING → UPRIGHT
 */

import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// How far (in normalised 0-1 frame height) the nose must drop from
// the calibrated neutral to count as a bow.
const BOW_DROP      = 0.09;  // 9% of frame height drop triggers bow
const RETURN_DROP   = 0.04;  // must come back to within 4% of neutral
const DEBOUNCE_MS   = 500;   // minimum ms between bows
const CALIB_FRAMES  = 20;    // ~0.7 s at 30 fps

const STATES = { CALIBRATING: 'CALIBRATING', UPRIGHT: 'UPRIGHT', BOWING: 'BOWING', RETURNING: 'RETURNING' };

export class BowDetector {
  constructor({ onBow, onStateChange, onCalibrated }) {
    this.onBow         = onBow;
    this.onStateChange = onStateChange;
    this.onCalibrated  = onCalibrated;   // called once calibration is done

    this.state         = STATES.CALIBRATING;
    this.lastBowTime   = 0;
    this.bowCount      = 0;
    this.neutralNoseY  = null;
    this.calibSamples  = [];

    this.stream        = null;
    this.animFrame     = null;
    this.landmarker    = null;
    this.videoEl       = null;
    this.running       = false;
  }

  async start(videoEl) {
    this.videoEl = videoEl;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      videoEl.srcObject = this.stream;
      await new Promise(r => { videoEl.onloadedmetadata = r; });
      await videoEl.play();
    } catch (err) {
      console.warn('Camera unavailable:', err);
      return false;
    }

    try {
      await this._initLandmarker();
    } catch (err) {
      console.error('MediaPipe failed to load:', err);
      return false;
    }

    this.running = true;
    this._loop();
    return true;
  }

  async _initLandmarker() {
    // WASM files are large — fetch from CDN, JS bundle comes from npm.
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    this.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }

  _loop() {
    if (!this.running) return;

    if (this.landmarker && this.videoEl?.readyState >= 2) {
      try {
        const results = this.landmarker.detectForVideo(this.videoEl, performance.now());
        const pts = results?.landmarks?.[0];
        if (pts) this._process(pts);
      } catch (_) {
        // suppress per-frame errors
      }
    }

    this.animFrame = requestAnimationFrame(() => this._loop());
  }

  _process(lm) {
    const nose = lm[0];
    if (!nose) return;

    const noseY = nose.y;

    // ── Calibration phase ────────────────────────────────────────────────
    if (this.state === STATES.CALIBRATING) {
      this.calibSamples.push(noseY);
      if (this.calibSamples.length >= CALIB_FRAMES) {
        // Median is more robust than mean against outlier frames
        const sorted = [...this.calibSamples].sort((a, b) => a - b);
        this.neutralNoseY = sorted[Math.floor(sorted.length / 2)];
        this.state = STATES.UPRIGHT;
        this.onCalibrated?.();
        console.log('[BowDetector] calibrated neutralNoseY =', this.neutralNoseY);
      }
      return;
    }

    const drop = noseY - this.neutralNoseY; // positive = nose moved down (bowing)
    const now  = performance.now();

    switch (this.state) {
      case STATES.UPRIGHT:
        if (drop > BOW_DROP && now - this.lastBowTime > DEBOUNCE_MS) {
          this.state       = STATES.BOWING;
          this.lastBowTime = now;
          this.bowCount++;
          this.onBow(this.bowCount);
          this.onStateChange?.(STATES.BOWING, this.bowCount);
        }
        break;

      case STATES.BOWING:
        if (drop < BOW_DROP) {
          this.state = STATES.RETURNING;
          this.onStateChange?.(STATES.RETURNING, this.bowCount);
        }
        break;

      case STATES.RETURNING:
        if (drop < RETURN_DROP) {
          this.state = STATES.UPRIGHT;
          this.onStateChange?.(STATES.UPRIGHT, this.bowCount);
        }
        break;
    }
  }

  stop() {
    this.running = false;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.videoEl) this.videoEl.srcObject = null;
  }

  manualBow() {
    const now = performance.now();
    if (now - this.lastBowTime < DEBOUNCE_MS) return;
    this.lastBowTime = now;
    this.bowCount++;
    this.onBow(this.bowCount);
  }
}
