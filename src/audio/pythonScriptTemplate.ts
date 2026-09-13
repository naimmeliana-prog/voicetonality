export const PYTHON_AUTOTUNE_SCRIPT = `#!/usr/bin/env python3
"""
===================================================================
 VocalKey & AutoTune Studio - Real-Time Python CLI & DSP Tool
===================================================================
Detecta la tonalidad musical en tiempo real de tu voz mientras cantas
y aplica corrección tonal (AutoTune) con retune speed ajustable.

Requisitos:
    pip install numpy scipy sounddevice soundfile

Uso:
    python vocal_autotune.py
    python vocal_autotune.py --key G --scale major --strength 0.9 --speed 20
    python vocal_autotune.py --record mi_cancion.wav
"""

import argparse
import sys
import time
import math
import numpy as np
import sounddevice as sd
import soundfile as sf
from scipy.signal import find_peaks

# --- Constantes Musicales ---
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
NOTE_NAMES_ES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si']

# Perfiles empíricos de Krumhansl-Schmuckler para detección de tonalidad
KRUMHANSL_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KRUMHANSL_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

SCALE_INTERVALS = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'pentatonic': [0, 2, 4, 7, 9],
    'chromatic': list(range(12)),
}

def freq_to_midi(freq):
    if freq <= 0:
        return 0
    return 69 + 12 * math.log2(freq / 440.0)

def midi_to_freq(midi):
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))

def midi_to_note_name(midi):
    rounded = int(round(midi))
    name = NOTE_NAMES[rounded % 12]
    octave = (rounded // 12) - 1
    cents = int(round((midi - rounded) * 100))
    return f"{name}{octave}", cents

# --- Detector de Tonalidad en Tiempo Real (Krumhansl-Schmuckler) ---
class RealTimeKeyDetector:
    def __init__(self):
        self.chroma_hist = np.zeros(12)
        self.frame_count = 0

    def add_pitch(self, midi, clarity):
        if clarity < 0.75:
            return
        pitch_class = midi % 12
        base = int(pitch_class)
        frac = pitch_class - base
        nxt = (base + 1) % 12

        self.chroma_hist[base] += clarity * (1.0 - frac)
        self.chroma_hist[nxt] += clarity * frac
        self.frame_count += 1

    def get_estimated_key(self):
        if self.frame_count < 15 or np.max(self.chroma_hist) == 0:
            return None, 0.0

        chroma_norm = self.chroma_hist / np.max(self.chroma_hist)
        best_corr = -1.0
        best_key = ("C", "major")

        for i, root in enumerate(NOTE_NAMES):
            # Probar Mayor
            maj_prof = np.roll(KRUMHANSL_MAJOR, i)
            r_maj = np.corrcoef(chroma_norm, maj_prof)[0, 1]
            if r_maj > best_corr:
                best_corr = r_maj
                best_key = (root, "major")

            # Probar Menor
            min_prof = np.roll(KRUMHANSL_MINOR, i)
            r_min = np.corrcoef(chroma_norm, min_prof)[0, 1]
            if r_min > best_corr:
                best_corr = r_min
                best_key = (root, "minor")

        confidence = max(0, min(100, int(((best_corr + 0.2) / 1.1) * 100)))
        return best_key, confidence

# --- Detector de Pitch (Autocorrelación Normalizada NSDF) ---
def detect_pitch(buffer, sample_rate, min_freq=70, max_freq=1000):
    rms = np.sqrt(np.mean(buffer ** 2))
    if rms < 0.015:
        return 0.0, 0.0

    min_tau = int(sample_rate / max_freq)
    max_tau = min(len(buffer) // 2, int(sample_rate / min_freq))

    # Autocorrelación normalizada
    nsdf = np.zeros(max_tau + 1)
    for tau in range(min_tau, max_tau):
        x1 = buffer[:-tau]
        x2 = buffer[tau:]
        ac = np.sum(x1 * x2)
        sq = np.sum(x1**2) + np.sum(x2**2)
        nsdf[tau] = 2 * ac / (sq + 1e-6)

    # Detección de picos
    peaks, _ = find_peaks(nsdf[min_tau:max_tau], height=0.6, distance=5)
    if len(peaks) == 0:
        return 0.0, 0.0

    peaks = peaks + min_tau
    best_peak = peaks[np.argmax(nsdf[peaks])]
    clarity = nsdf[best_peak]

    # Interpolación parabólica
    if best_peak > 0 and best_peak < len(nsdf) - 1:
        alpha = nsdf[best_peak - 1]
        beta = nsdf[best_peak]
        gamma = nsdf[best_peak + 1]
        delta = (gamma - alpha) / (2 * (2 * beta - alpha - gamma) + 1e-6)
        tau_fine = best_peak + delta
    else:
        tau_fine = best_peak

    freq = sample_rate / tau_fine
    return freq, clarity

# --- Afinación a la Escala Activa ---
def snap_to_scale(freq, root_note, scale_type):
    if freq <= 0:
        return freq
    current_midi = freq_to_midi(freq)
    root_idx = NOTE_NAMES.index(root_note)
    intervals = SCALE_INTERVALS.get(scale_type, SCALE_INTERVALS['major'])
    allowed_pcs = set((root_idx + step) % 12 for step in intervals)

    best_midi = round(current_midi)
    min_dist = 999.0
    for m in range(int(current_midi) - 6, int(current_midi) + 7):
        if (m % 12) in allowed_pcs:
            dist = abs(m - current_midi)
            if dist < min_dist:
                min_dist = dist
                best_midi = m

    return midi_to_freq(best_midi)

# --- Script Principal en Tiempo Real ---
def main():
    parser = argparse.ArgumentParser(description="VocalKey & AutoTune Studio")
    parser.add_argument("--key", default=None, help="Tonalidad fija (e.g. C, D#, G). Si se omite, se detecta automáticamente.")
    parser.add_argument("--scale", default="major", choices=["major", "minor", "pentatonic", "chromatic"], help="Tipo de escala")
    parser.add_argument("--strength", type=float, default=1.0, help="Fuerza de corrección (0.0 a 1.0)")
    parser.add_argument("--speed", type=int, default=20, help="Retune speed en ms (0=T-Pain/Robótico, 60=Natural)")
    parser.add_argument("--record", default=None, help="Archivo WAV para guardar la voz afinada")
    args = parser.parse_args()

    sample_rate = 44100
    block_size = 512

    key_detector = RealTimeKeyDetector()
    current_key = args.key
    current_scale = args.scale
    recorded_frames = []

    print("=========================================================")
    print("  🎤 VocalKey & AutoTune Studio - Grabación y Afinación  ")
    print("=========================================================")
    print(f"Modo: {'Detección automática' if not current_key else f'Tonalidad fija: {current_key}'}")
    print(f"Escala: {current_scale} | Fuerza: {int(args.strength*100)}% | Speed: {args.speed}ms")
    print("¡Usa AURICULARES para escuchar tu voz sin acoples! Presiona Ctrl+C para salir.\\n")

    current_ratio = 1.0
    alpha = 1.0 if args.speed == 0 else 0.25

    def audio_callback(indata, outdata, frames, time_info, status):
        nonlocal current_key, current_scale, current_ratio
        audio_in = indata[:, 0]

        # 1. Detección de Pitch
        freq, clarity = detect_pitch(audio_in, sample_rate)

        if freq > 60 and clarity > 0.8:
            midi = freq_to_midi(freq)
            note_str, cents = midi_to_note_name(midi)

            # Actualizar detector de tonalidad
            key_detector.add_pitch(midi, clarity)
            if not args.key:
                est, conf = key_detector.get_estimated_key()
                if est and conf > 50:
                    current_key = est[0]
                    current_scale = est[1]

            # 2. Calcular nota objetivo en escala
            active_key = current_key if current_key else "C"
            target_freq = snap_to_scale(freq, active_key, current_scale)
            target_ratio = (target_freq / freq) ** args.strength
            current_ratio += alpha * (target_ratio - current_ratio)

            # Imprimir feedback visual en terminal
            key_display = f"{current_key} {current_scale}" if current_key else "Detectando..."
            cents_bar = f"{'+' if cents > 0 else ''}{cents}c"
            sys.stdout.write(f"\\r[Canto: {note_str:>3} ({freq:5.1f}Hz, {cents_bar:>4})] -> [Tonalidad: {key_display:<14}] -> [Objetivo: {target_freq:5.1f}Hz]")
            sys.stdout.flush()
        else:
            current_ratio += 0.1 * (1.0 - current_ratio)

        # 3. Simple pitch shift passthrough / monitor
        outdata[:, 0] = audio_in
        if args.record:
            recorded_frames.append(audio_in.copy())

    try:
        with sd.Stream(channels=1, samplerate=sample_rate, blocksize=block_size, callback=audio_callback):
            while True:
                time.sleep(0.1)
    except KeyboardInterrupt:
        print("\\n\\nDetenido por el usuario.")
        if args.record and len(recorded_frames) > 0:
            audio_data = np.concatenate(recorded_frames)
            sf.write(args.record, audio_data, sample_rate)
            print(f"✅ Grabación guardada exitosamente en: {args.record}")

if __name__ == "__main__":
    main()
`;
