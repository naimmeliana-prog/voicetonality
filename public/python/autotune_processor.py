#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
autotune_processor.py - Correccion Tonal de Archivos de Audio
=============================================================================
Aplica un efecto de autotune a un archivo de audio (WAV, MP3, FLAC, etc.).
Permite configurar:
 - key: Tonalidad fundamental ('C', 'C#', 'D', ..., 'B')
 - scale: Tipo de escala ('major', 'minor', 'pentatonic', 'chromatic', 'blues')
 - correction_speed: Velocidad de corrección (0.0 = instantáneo/robótico estilo Cher/T-Pain,
                     1.0 = suave/natural)
 - pitch_range: Rango/intensidad de corrección (0.0 = sin cambio, 1.0 = afinación completa)

Requisitos:
    pip install numpy scipy soundfile librosa

Uso por línea de comandos:
    python autotune_processor.py entrada.wav salida.wav --key C --scale major --speed 0.2 --range 1.0
"""

import argparse
import math
import numpy as np
import soundfile as sf
import librosa
from scipy.ndimage import uniform_filter1d

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

SCALES = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'pentatonic': [0, 2, 4, 7, 9],
    'chromatic': list(range(12)),
    'blues': [0, 3, 5, 6, 7, 10],
}

def hz_to_midi(freq):
    """Convierte frecuencia en Hz a número de nota MIDI."""
    if freq <= 0 or np.isnan(freq):
        return 0.0
    return 69.0 + 12.0 * math.log2(freq / 440.0)

def get_scale_notes_midi(key='C', scale='major', octave_min=1, octave_max=7):
    """Genera lista de notas MIDI permitidas para la escala y tonalidad dada."""
    root_idx = NOTE_NAMES.index(key.upper().replace('DB', 'C#').replace('EB', 'D#').replace('GB', 'F#').replace('AB', 'G#').replace('BB', 'A#'))
    intervals = SCALES.get(scale.lower(), SCALES['chromatic'])
    
    valid_midi = []
    for octv in range(octave_min, octave_max + 1):
        base_midi = (octv + 1) * 12 + root_idx
        for interval in intervals:
            valid_midi.append(base_midi + interval)
    return np.array(sorted(valid_midi), dtype=float)

def find_closest_scale_note(midi_val, allowed_midi_notes):
    """Encuentra la nota más cercana dentro de la escala permitida."""
    idx = np.abs(allowed_midi_notes - midi_val).argmin()
    return allowed_midi_notes[idx]

def apply_autotune(
    audio_path_or_array,
    output_path=None,
    sr=None,
    key='C',
    scale='major',
    correction_speed=0.2,
    pitch_range=1.0,
    fmin=65.0,
    fmax=880.0
):
    """
    Aplica el efecto de autotune a un audio.
    
    Parámetros:
      - audio_path_or_array: Ruta al archivo de audio o arreglo numpy (1D o 2D)
      - output_path: Ruta para guardar el resultado WAV (opcional)
      - sr: Frecuencia de muestreo (si se pasa arreglo numpy)
      - key: Tonalidad musical ('C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B')
      - scale: 'major', 'minor', 'pentatonic', 'chromatic'
      - correction_speed: 0.0 (efecto duro instantáneo) a 1.0 (transición vocal suave)
      - pitch_range: 0.0 (sin efecto) a 1.0 (100% afinado hacia la nota objetivo)
      - fmin, fmax: Rango de búsqueda de frecuencia fundamental (Hz)
      
    Retorna:
      (audio_sintonizado, sample_rate)
    """
    # 1. Cargar el audio
    if isinstance(audio_path_or_array, str):
        y, sample_rate = librosa.load(audio_path_or_array, sr=sr, mono=False)
    else:
        y = np.array(audio_path_or_array, dtype=np.float32)
        sample_rate = sr or 44100

    is_stereo = (y.ndim == 2 and y.shape[0] == 2)
    y_mono = librosa.to_mono(y) if is_stereo else y

    # 2. Escala de notas permitidas en MIDI
    allowed_midi = get_scale_notes_midi(key=key, scale=scale)

    # 3. Extracción de frecuencia fundamental (F0) con algoritmo pYIN
    hop_length = 512
    f0, voiced_flag, _ = librosa.pyin(
        y_mono,
        fmin=fmin,
        fmax=fmax,
        sr=sample_rate,
        hop_length=hop_length
    )

    # 4. Cálculo del desplazamiento tonal frame a frame
    n_frames = len(f0)
    semitone_shifts = np.zeros(n_frames, dtype=np.float32)

    for i in range(n_frames):
        freq = f0[i]
        if voiced_flag[i] and freq > 0 and not np.isnan(freq):
            cur_midi = hz_to_midi(freq)
            target_midi = find_closest_scale_note(cur_midi, allowed_midi)
            diff_semitones = target_midi - cur_midi
            semitone_shifts[i] = diff_semitones * float(pitch_range)
        else:
            semitone_shifts[i] = 0.0

    # 5. Aplicar pitch correction speed (suavizado temporal)
    if correction_speed > 0.01:
        window_size = int(1 + correction_speed * 16)
        semitone_shifts = uniform_filter1d(semitone_shifts, size=window_size, mode='nearest')

    # 6. Síntesis por Pitch-Shifting en bloques
    chunk_size = hop_length * 8
    total_samples = y.shape[-1]
    channels = [y[0], y[1]] if is_stereo else [y]
    out_channels = []

    for ch in channels:
        ch_out = np.copy(ch)
        for start in range(0, total_samples, chunk_size):
            end = min(start + chunk_size, total_samples)
            frame_idx = min(start // hop_length, n_frames - 1)
            shift = float(semitone_shifts[frame_idx])
            
            if abs(shift) >= 0.05:
                segment = ch[start:end]
                if len(segment) >= 256:
                    shifted_seg = librosa.effects.pitch_shift(
                        segment,
                        sr=sample_rate,
                        n_steps=shift,
                        bins_per_octave=12
                    )
                    fade_len = min(128, len(shifted_seg))
                    if fade_len > 0:
                        fade_in = np.linspace(0, 1, fade_len)
                        shifted_seg[:fade_len] = shifted_seg[:fade_len] * fade_in + segment[:fade_len] * (1 - fade_in)
                    ch_out[start:end] = shifted_seg[:len(segment)]
        out_channels.append(ch_out)

    final_audio = np.stack(out_channels) if is_stereo else out_channels[0]

    if output_path:
        sf.write(output_path, final_audio.T if is_stereo else final_audio, sample_rate)
        print(f"[OK] Archivo afinado guardado en: {output_path}")

    return final_audio, sample_rate

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Aplica AutoTune a un archivo de audio con parametros ajustables.")
    parser.add_argument("input", help="Ruta del archivo de audio de entrada (.wav, .mp3, etc.)")
    parser.add_argument("output", help="Ruta del archivo de salida (.wav)")
    parser.add_argument("--key", default="C", choices=NOTE_NAMES, help="Nota fundamental (por defecto 'C')")
    parser.add_argument("--scale", default="major", choices=list(SCALES.keys()), help="Tipo de escala (por defecto 'major')")
    parser.add_argument("--speed", type=float, default=0.2, help="Velocidad de correccion: 0.0 (robotico) a 1.0 (natural)")
    parser.add_argument("--range", type=float, default=1.0, help="Cantidad/rango de correccion: 0.0 (sin efecto) a 1.0 (completo)")

    args = parser.parse_args()
    print(f"[*] Procesando: {args.input} -> {args.output}")
    print(f"[*] Tonalidad: {args.key} {args.scale} | Velocidad: {args.speed} | Intensidad: {args.range}")
    apply_autotune(
        args.input,
        output_path=args.output,
        key=args.key,
        scale=args.scale,
        correction_speed=args.speed,
        pitch_range=args.range
    )
