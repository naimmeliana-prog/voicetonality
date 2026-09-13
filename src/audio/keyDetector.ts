import { KeyCandidate, KeyDetectionResult, NoteName } from '../types';
import {
  KRUMHANSL_MAJOR_PROFILE,
  KRUMHANSL_MINOR_PROFILE,
  NOTE_NAMES,
  NOTE_NAMES_SPANISH,
  getScaleNotes,
} from './musicTheory';

// Compute Pearson correlation between two vectors of equal length
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return 0;
  return numerator / denominator;
}

export class KeyDetector {
  private chromaHistogram: number[] = new Array(12).fill(0);
  private voicedFrameCount: number = 0;
  private claritySum: number = 0;

  /**
   * Feed a detected pitch frame to the key detector
   * @param midiFractional Fractional MIDI note (e.g. 60.2)
   * @param clarity Periodicity / clarity score (0 to 1)
   * @param weight Frame weight (duration / volume)
   */
  public addPitchFrame(midiFractional: number, clarity: number, weight: number = 1.0) {
    if (clarity < 0.7) return;

    // Pitch class in 0..11
    const pitchClass = ((midiFractional % 12) + 12) % 12;
    const baseBin = Math.floor(pitchClass);
    const fraction = pitchClass - baseBin;
    const nextBin = (baseBin + 1) % 12;

    // Distribute weight smoothly between adjacent pitch bins according to cents
    const contribution = clarity * weight;
    this.chromaHistogram[baseBin] += contribution * (1 - fraction);
    this.chromaHistogram[nextBin] += contribution * fraction;

    this.voicedFrameCount++;
    this.claritySum += clarity;
  }

  /**
   * Evaluate the accumulated chroma against Krumhansl-Schmuckler profiles
   */
  public estimateKey(): KeyDetectionResult {
    // If not enough voiced frames yet, return null
    if (this.voicedFrameCount < 15) {
      return {
        estimatedKey: null,
        alternatives: [],
        chromaProfile: [...this.chromaHistogram],
        totalVoicedFrames: this.voicedFrameCount,
        clarityAvg: this.voicedFrameCount > 0 ? this.claritySum / this.voicedFrameCount : 0,
      };
    }

    // Normalize chroma histogram
    const maxVal = Math.max(...this.chromaHistogram);
    const normalizedChroma = this.chromaHistogram.map((v) => (maxVal > 0 ? v / maxVal : 0));

    const candidates: KeyCandidate[] = [];

    // Test all 12 Major keys
    for (let rootIndex = 0; rootIndex < 12; rootIndex++) {
      const root = NOTE_NAMES[rootIndex];
      // Rotate the empirical major profile to start at rootIndex
      const shiftedProfile: number[] = [];
      for (let i = 0; i < 12; i++) {
        shiftedProfile.push(KRUMHANSL_MAJOR_PROFILE[(i - rootIndex + 12) % 12]);
      }

      const r = pearsonCorrelation(normalizedChroma, shiftedProfile);
      candidates.push({
        root,
        mode: 'major',
        nameSpanish: `${NOTE_NAMES_SPANISH[root]} Mayor`,
        correlation: r,
        confidence: Math.max(0, Math.min(100, Math.round(((r + 0.2) / 1.1) * 100))),
        scaleNotes: getScaleNotes(root, 'major'),
      });
    }

    // Test all 12 Minor keys
    for (let rootIndex = 0; rootIndex < 12; rootIndex++) {
      const root = NOTE_NAMES[rootIndex];
      // Rotate the empirical minor profile to start at rootIndex
      const shiftedProfile: number[] = [];
      for (let i = 0; i < 12; i++) {
        shiftedProfile.push(KRUMHANSL_MINOR_PROFILE[(i - rootIndex + 12) % 12]);
      }

      const r = pearsonCorrelation(normalizedChroma, shiftedProfile);
      candidates.push({
        root,
        mode: 'minor',
        nameSpanish: `${NOTE_NAMES_SPANISH[root]} menor`,
        correlation: r,
        confidence: Math.max(0, Math.min(100, Math.round(((r + 0.2) / 1.1) * 100))),
        scaleNotes: getScaleNotes(root, 'minor'),
      });
    }

    // Sort descending by correlation score
    candidates.sort((a, b) => b.correlation - a.correlation);

    const estimatedKey = candidates[0] || null;
    const alternatives = candidates.slice(1, 4);

    return {
      estimatedKey,
      alternatives,
      chromaProfile: normalizedChroma,
      totalVoicedFrames: this.voicedFrameCount,
      clarityAvg: this.claritySum / this.voicedFrameCount,
    };
  }

  public reset() {
    this.chromaHistogram = new Array(12).fill(0);
    this.voicedFrameCount = 0;
    this.claritySum = 0;
  }
}
