import { PitchDetectionResult } from '../types';
import { freqToNote } from './musicTheory';

export class PitchDetector {
  private bufferSize: number;
  private sampleRate: number;
  private rmsThreshold: number = 0.015; // Minimum energy for voice
  private clarityThreshold: number = 0.82; // Periodicity threshold for voiced speech
  private minFreq: number = 65; // C2 (~65Hz) lowest male vocal fundamental
  private maxFreq: number = 1100; // C6 (~1046Hz) high soprano fundamental
  private pitchHistory: number[] = [];
  private historyLength: number = 5;

  constructor(sampleRate: number = 44100, bufferSize: number = 2048) {
    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
  }

  public setSampleRate(sr: number) {
    this.sampleRate = sr;
  }

  public setVocalRange(range: 'all' | 'soprano' | 'alto' | 'tenor' | 'bass') {
    switch (range) {
      case 'soprano':
        this.minFreq = 220; // A3
        this.maxFreq = 1200; // D6
        break;
      case 'alto':
        this.minFreq = 160; // E3
        this.maxFreq = 880; // A5
        break;
      case 'tenor':
        this.minFreq = 110; // A2
        this.maxFreq = 600; // D5
        break;
      case 'bass':
        this.minFreq = 65; // C2
        this.maxFreq = 350; // F4
        break;
      case 'all':
      default:
        this.minFreq = 65;
        this.maxFreq = 1100;
        break;
    }
  }

  /**
   * Normalized Square Difference Function (NSDF) / MPM Pitch Extraction
   * @param buffer Time-domain audio samples (Float32Array)
   */
  public detect(buffer: Float32Array): PitchDetectionResult {
    // 1. Calculate RMS volume
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      sumSquares += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sumSquares / buffer.length);
    const volume = Math.min(1, rms * 5); // Normalized volume indicator

    if (rms < this.rmsThreshold) {
      return {
        frequency: 0,
        note: null,
        clarity: 0,
        volume,
        isVoiced: false,
      };
    }

    // 2. Minimum and maximum lag (tau) in samples based on min/max freq
    const minTau = Math.floor(this.sampleRate / this.maxFreq);
    const maxTau = Math.min(buffer.length / 2, Math.floor(this.sampleRate / this.minFreq));

    // 3. Compute Normalized Autocorrelation Function (NSDF)
    // nsdf[tau] = 2 * sum(x[t] * x[t+tau]) / (sum(x[t]^2) + sum(x[t+tau]^2))
    const nsdf = new Float32Array(maxTau + 1);

    for (let tau = minTau; tau <= maxTau; tau++) {
      let acf = 0;
      let div1 = 0;
      let div2 = 0;
      const limit = buffer.length - tau;
      for (let t = 0; t < limit; t++) {
        const x1 = buffer[t];
        const x2 = buffer[t + tau];
        acf += x1 * x2;
        div1 += x1 * x1;
        div2 += x2 * x2;
      }
      const divisor = div1 + div2;
      nsdf[tau] = divisor > 0.00001 ? (2 * acf) / divisor : 0;
    }

    // 4. Find key turning points (peaks) in the NSDF
    interface Peak {
      tau: number;
      value: number;
    }
    const peaks: Peak[] = [];

    // Find local maxima after zero-crossing
    let isPositive = false;
    for (let tau = minTau; tau < maxTau - 1; tau++) {
      if (nsdf[tau] > 0) {
        isPositive = true;
      } else {
        isPositive = false;
      }

      if (isPositive) {
        if (nsdf[tau] > nsdf[tau - 1] && nsdf[tau] >= nsdf[tau + 1]) {
          // Local maximum found
          peaks.push({ tau, value: nsdf[tau] });
        }
      }
    }

    if (peaks.length === 0) {
      return {
        frequency: 0,
        note: null,
        clarity: 0,
        volume,
        isVoiced: false,
      };
    }

    // Find highest peak
    let maxPeakValue = -1;
    for (const p of peaks) {
      if (p.value > maxPeakValue) {
        maxPeakValue = p.value;
      }
    }

    // Standard MPM threshold: pick the earliest peak that is at least 80-90% of max peak
    const cutoff = maxPeakValue * 0.85;
    let selectedPeak: Peak | null = null;
    for (const p of peaks) {
      if (p.value >= cutoff && p.value >= this.clarityThreshold * 0.75) {
        selectedPeak = p;
        break;
      }
    }

    if (!selectedPeak || selectedPeak.value < this.clarityThreshold) {
      return {
        frequency: 0,
        note: null,
        clarity: selectedPeak ? Math.max(0, selectedPeak.value) : 0,
        volume,
        isVoiced: false,
      };
    }

    // 5. Parabolic Interpolation around the peak for sub-sample precision
    const tau = selectedPeak.tau;
    const alpha = nsdf[tau - 1];
    const beta = nsdf[tau];
    const gamma = nsdf[tau + 1];

    const delta = (gamma - alpha) / (2 * (2 * beta - alpha - gamma));
    const refinedTau = tau + delta;
    let rawFreq = this.sampleRate / refinedTau;

    // Filter frequency sanity bounds
    if (rawFreq < this.minFreq || rawFreq > this.maxFreq) {
      return {
        frequency: 0,
        note: null,
        clarity: 0,
        volume,
        isVoiced: false,
      };
    }

    // 6. Median filtering over last few voiced frames to smooth out outliers
    this.pitchHistory.push(rawFreq);
    if (this.pitchHistory.length > this.historyLength) {
      this.pitchHistory.shift();
    }

    const sortedHistory = [...this.pitchHistory].sort((a, b) => a - b);
    const medianFreq = sortedHistory[Math.floor(sortedHistory.length / 2)];

    const note = freqToNote(medianFreq);

    return {
      frequency: Math.round(medianFreq * 10) / 10,
      note,
      clarity: Math.min(1, Math.max(0, selectedPeak.value)),
      volume,
      isVoiced: true,
    };
  }

  public reset() {
    this.pitchHistory = [];
  }
}
