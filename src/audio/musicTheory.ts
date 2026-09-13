import { NoteInfo, NoteName, ScaleType } from '../types';

export const NOTE_NAMES: NoteName[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

export const NOTE_NAMES_SPANISH: Record<NoteName, string> = {
  C: 'Do',
  'C#': 'Do♯',
  D: 'Re',
  'D#': 'Re♯',
  E: 'Mi',
  F: 'Fa',
  'F#': 'Fa♯',
  G: 'Sol',
  'G#': 'Sol♯',
  A: 'La',
  'A#': 'La♯',
  B: 'Si',
};

// Scale interval definitions (semitones from root)
export const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11], // Major / Jónica
  minor: [0, 2, 3, 5, 7, 8, 10], // Natural minor / Eólica
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const SCALE_LABELS: Record<ScaleType, string> = {
  major: 'Mayor Natural',
  minor: 'Menor Natural',
  harmonic_minor: 'Menor Armónica',
  pentatonic_major: 'Pentatónica Mayor',
  pentatonic_minor: 'Pentatónica Menor',
  blues: 'Escala Blues',
  dorian: 'Dórico',
  mixolydian: 'Mixolidio',
  chromatic: 'Cromática (Todas las notas)',
};

// Krumhansl-Kessler Key Profiles (empirical stability weights for major and minor)
// Order corresponds to scale degree: tonic, b2, 2, b3, 3, 4, b5, 5, b6, 6, b7, 7
export const KRUMHANSL_MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];

export const KRUMHANSL_MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

// Convert frequency (Hz) to fractional MIDI note number
export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

// Convert MIDI note number to frequency (Hz)
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Convert frequency to full NoteInfo
export function freqToNote(freq: number): NoteInfo | null {
  if (!freq || freq < 40 || freq > 2500) return null;
  const midiFractional = freqToMidi(freq);
  const roundedMidi = Math.round(midiFractional);
  const cents = Math.round((midiFractional - roundedMidi) * 100);

  const noteIndex = ((roundedMidi % 12) + 12) % 12;
  const name = NOTE_NAMES[noteIndex];
  const octave = Math.floor(roundedMidi / 12) - 1;
  const targetFrequency = midiToFreq(roundedMidi);

  return {
    name,
    nameSpanish: `${NOTE_NAMES_SPANISH[name]}${octave}`,
    midi: roundedMidi,
    octave,
    frequency: targetFrequency,
    cents,
  };
}

// Get array of note names in a given key root and scale type
export function getScaleNotes(root: NoteName, scaleType: ScaleType): NoteName[] {
  const rootIndex = NOTE_NAMES.indexOf(root);
  if (rootIndex === -1) return [];
  const intervals = SCALE_INTERVALS[scaleType] || SCALE_INTERVALS.major;
  return intervals.map((interval) => NOTE_NAMES[(rootIndex + interval) % 12]);
}

// Find the closest note in a given scale to a target frequency
export function findClosestScaleNote(
  freq: number,
  root: NoteName,
  scaleType: ScaleType
): { targetFreq: number; noteName: NoteName; targetMidi: number; centsDiff: number } {
  const currentMidi = freqToMidi(freq);
  const rootIndex = NOTE_NAMES.indexOf(root);
  const intervals = SCALE_INTERVALS[scaleType] || SCALE_INTERVALS.chromatic;
  const allowedPitchClasses = new Set(
    intervals.map((int) => (rootIndex + int) % 12)
  );

  let bestMidi = Math.round(currentMidi);
  let minDistance = Infinity;

  // Search around current MIDI +/- 6 semitones
  for (let m = Math.floor(currentMidi) - 6; m <= Math.ceil(currentMidi) + 6; m++) {
    const pitchClass = ((m % 12) + 12) % 12;
    if (allowedPitchClasses.has(pitchClass)) {
      const dist = Math.abs(m - currentMidi);
      if (dist < minDistance) {
        minDistance = dist;
        bestMidi = m;
      }
    }
  }

  const targetFreq = midiToFreq(bestMidi);
  const noteName = NOTE_NAMES[((bestMidi % 12) + 12) % 12];
  const centsDiff = (currentMidi - bestMidi) * 100;

  return {
    targetFreq,
    noteName,
    targetMidi: bestMidi,
    centsDiff,
  };
}
