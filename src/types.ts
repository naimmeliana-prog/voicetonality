export type NoteName =
  | 'C'
  | 'C#'
  | 'D'
  | 'D#'
  | 'E'
  | 'F'
  | 'F#'
  | 'G'
  | 'G#'
  | 'A'
  | 'A#'
  | 'B';

export type ScaleType =
  | 'major'
  | 'minor'
  | 'harmonic_minor'
  | 'pentatonic_major'
  | 'pentatonic_minor'
  | 'blues'
  | 'dorian'
  | 'mixolydian'
  | 'chromatic';

export interface NoteInfo {
  name: NoteName;
  nameSpanish: string;
  midi: number;
  octave: number;
  frequency: number;
  cents: number;
}

export interface PitchDetectionResult {
  frequency: number;
  note: NoteInfo | null;
  clarity: number; // 0 to 1
  volume: number; // 0 to 1
  isVoiced: boolean;
}

export interface KeyCandidate {
  root: NoteName;
  mode: 'major' | 'minor';
  nameSpanish: string;
  confidence: number; // 0 to 100%
  correlation: number;
  scaleNotes: NoteName[];
}

export interface KeyDetectionResult {
  estimatedKey: KeyCandidate | null;
  alternatives: KeyCandidate[];
  chromaProfile: number[]; // 12 values
  totalVoicedFrames: number;
  clarityAvg: number;
}

export interface CompressorSettings {
  enabled: boolean;
  threshold: number; // dB, -60 to 0 (default: -24)
  ratio: number; // 1 to 20 (default: 4)
  knee: number; // 0 to 40 (default: 10)
  attack: number; // seconds, 0.001 to 0.1 (default: 0.003)
  release: number; // seconds, 0.05 to 1.0 (default: 0.15)
}

export interface LatencySettings {
  bufferSize: 256 | 512 | 1024;
  compensationMs: number; // 0 to 200 ms
}

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
  groupId?: string;
}

export interface AutoTuneSettings {
  enabled: boolean;
  strength: number; // 0 to 100
  retuneSpeedMs: number; // 0 (hard/t-pain) to 150 (natural)
  scaleType: ScaleType;
  keyRoot: NoteName;
  autoKeyTracking: boolean; // if true, uses detected key
  pitchRange: 'all' | 'soprano' | 'alto' | 'tenor' | 'bass';
  monitorVolume: number; // 0 to 1
  reverbAmount: number; // 0 to 1
  compressor: CompressorSettings;
  latency: LatencySettings;
  inputDeviceId?: string;
  outputDeviceId?: string;
}

export interface RecordingState {
  isRecording: boolean;
  durationSeconds: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
}

export interface RecordedTrack {
  id: string;
  name: string;
  createdAt: number;
  durationSeconds: number;
  blob: Blob;
  url: string;
  keyRoot?: NoteName;
  scaleType?: ScaleType;
  strength?: number;
  retuneSpeedMs?: number;
  sizeBytes: number;
}

export interface AutoTunePreset {
  id: string;
  name: string;
  tagline: string;
  description: string;
  iconName: 'zap' | 'sparkles' | 'activity' | 'flame' | 'feather' | 'bot';
  settings: {
    strength: number;
    retuneSpeedMs: number;
    reverbAmount?: number;
  };
}
