#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
pitch_analyzer_realtime.py - Analizador de F0 y Desviacion en Tiempo Real
=============================================================================
Captura audio del micrófono en tiempo real utilizando sounddevice y aubio.
Muestra en vivo:
 - Frecuencia fundamental (F0 en Hertz)
 - Nota musical detectada (ej. A4, C#3)
 - Desviación en Cents (-50 a +50 cents)
 - Medidor gráfico interactivo en terminal con colores ANSI.
"""

import sys
import time
import math
import argparse
import numpy as np
import sounddevice as sd

HAVE_AUBIO = False
try:
    import aubio
    HAVE_AUBIO = True
except ImportError:
    pass

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

CLR_RESET = "\033[0m"
CLR_GREEN = "\033[92m"
CLR_YELLOW = "\033[93m"
CLR_CYAN = "\033[96m"
CLR_GRAY = "\033[90m"
CLR_BOLD = "\033[1m"

def freq_to_note_and_cents(freq, a4_ref=440.0):
    if freq <= 20.0 or math.isnan(freq):
        return None, 0, 0.0
    
    midi = 69.0 + 12.0 * math.log2(freq / a4_ref)
    nearest_midi = int(round(midi))
    cents_diff = int(round((midi - nearest_midi) * 100.0))
    
    note_idx = nearest_midi % 12
    octave = (nearest_midi // 12) - 1
    note_name = f"{NOTE_NAMES[note_idx]}{octave}"
    exact_freq = a4_ref * (2.0 ** ((nearest_midi - 69.0) / 12.0))
    return note_name, cents_diff, exact_freq

def render_cents_meter(cents):
    total_slots = 21
    center = total_slots // 2
    pos = int(round((cents + 50) / 100.0 * (total_slots - 1)))
    pos = max(0, min(total_slots - 1, pos))
    
    meter_chars = list("." * total_slots)
    meter_chars[center] = "|"
    meter_chars[pos] = "▲" if pos == center else "#"

    if abs(cents) <= 5:
        color = CLR_GREEN
        status = "AFINADO PERFECTO"
    elif cents > 0:
        color = CLR_YELLOW
        status = f"+{cents}¢ SOSTENIDO"
    else:
        color = CLR_CYAN
        status = f"{cents}¢ BEMOL"

    return f"{color}[{''.join(meter_chars)}] {status:<18}{CLR_RESET}"

def main():
    parser = argparse.ArgumentParser(description="Analizador de tono musical en tiempo real con microfono.")
    parser.add_argument("--sr", type=int, default=44100, help="Frecuencia de muestreo (Hz)")
    parser.add_argument("--buffer", type=int, default=1024, help="Tamaño del buffer de audio")
    parser.add_argument("--ref", type=float, default=440.0, help="Frecuencia A4 de referencia (Hz)")
    args = parser.parse_args()

    engine_name = "Aubio (YinFFT)" if HAVE_AUBIO else "NumPy Autocorrelation (Fallback)"
    print("=" * 65)
    print(f" {CLR_BOLD}ANALIZADOR DE TONO Y DESVIACION EN TIEMPO REAL{CLR_RESET}")
    print(f" Motor: {engine_name} | Referencia A4: {args.ref} Hz | Buffer: {args.buffer}")
    print(" Canta o habla cerca del microfono. Presiona Ctrl+C para salir.")
    print("=" * 65)

    if HAVE_AUBIO:
        pitch_o = aubio.pitch("yinfft", args.buffer * 2, args.buffer, args.sr)
        pitch_o.set_unit("Hz")
        pitch_o.set_silence(-42)
        pitch_o.set_tolerance(0.8)
    else:
        pitch_o = None

    def audio_callback(indata, frames, time_info, status):
        mono = indata[:, 0].astype(np.float32)
        f0 = 0.0
        if HAVE_AUBIO and pitch_o is not None:
            f0 = float(pitch_o(mono)[0])
            confidence = float(pitch_o.get_confidence())
            if confidence < 0.6 or f0 < 50 or f0 > 1500:
                f0 = 0.0
        else:
            rms = np.sqrt(np.mean(mono**2))
            if rms > 0.01:
                corr = np.correlate(mono, mono, mode='full')[len(mono)//2:]
                min_l = int(args.sr / 1000)
                max_l = int(args.sr / 60)
                if len(corr) >= max_l:
                    pk = min_l + np.argmax(corr[min_l:max_l])
                    if corr[pk] > 0.3 * corr[0]:
                        f0 = float(args.sr / pk)

        if f0 > 30.0:
            note, cents, exact = freq_to_note_and_cents(f0, a4_ref=args.ref)
            meter = render_cents_meter(cents)
            sys.stdout.write(
                f"\r  Nota: {CLR_BOLD}{note:>4}{CLR_RESET}  |  "
                f"F0: {f0:6.1f} Hz (Ref: {exact:6.1f} Hz)  |  "
                f"{meter}"
            )
        else:
            sys.stdout.write(f"\r  {CLR_GRAY}Nota:  ---  |  F0:    0.0 Hz  |  [.........|.........] Escuchando...       {CLR_RESET}")
        sys.stdout.flush()

    try:
        with sd.InputStream(channels=1, samplerate=args.sr, blocksize=args.buffer, callback=audio_callback):
            while True:
                time.sleep(0.05)
    except KeyboardInterrupt:
        print("\n\n[!] Detenido por el usuario.")
    except Exception as e:
        print(f"\n[ERROR]: {e}")

if __name__ == '__main__':
    main()
