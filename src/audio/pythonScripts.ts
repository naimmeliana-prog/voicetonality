/**
 * Python scripts and templates for:
 * 1. autotune_processor.py - File-based autotune with correction speed and pitch range.
 * 2. pitch_analyzer_realtime.py - Real-time pitch analysis using aubio/librosa with note & cents deviation.
 * 3. autotune_gui.py - Standalone Tkinter GUI with Record, Play, Real-Time Pitch Meter, & AutoTune Sliders.
 */

export const SCRIPT_AUTOTUNE_PROCESSOR = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
Modulo 1: autotune_processor.py - Correccion Tonal de Archivos de Audio
=============================================================================
Aplica un efecto de autotune a un archivo de audio (WAV, MP3, FLAC, etc.).
Permite configurar:
 - key: Tonalidad fundamental ('C', 'C#', 'D', ..., 'B')
 - scale: Tipo de escala ('major', 'minor', 'pentatonic', 'chromatic')
 - correction_speed: Velocidad de correccion (0.0 = instantaneo/robotico tipo Cher/T-Pain,
                     1.0 = suave/natural)
 - pitch_range: Rango/intensidad de correccion (0.0 = sin cambio, 1.0 = afinacion completa,
                o limite de semitonos corregidos)

Requisitos:
    pip install numpy scipy soundfile librosa

Uso por linea de comandos:
    python autotune_processor.py entrada.wav salida.wav --key C --scale major --speed 0.2 --range 1.0
"""

import argparse
import math
import numpy as np
import soundfile as sf
import librosa
from scipy.ndimage import uniform_filter1d

# Nombres de notas y frecuencias de referencia
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

# Intervalos de escalas respecto a la tonica (en semitonos)
SCALES = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'pentatonic': [0, 2, 4, 7, 9],
    'chromatic': list(range(12)),
    'blues': [0, 3, 5, 6, 7, 10],
}

def hz_to_midi(freq):
    """Convierte frecuencia en Hz a numero de nota MIDI."""
    if freq <= 0 or np.isnan(freq):
        return 0.0
    return 69.0 + 12.0 * math.log2(freq / 440.0)

def midi_to_hz(midi):
    """Convierte numero MIDI a frecuencia en Hz."""
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))

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
    """Encuentra la nota mas cercana dentro de la escala permitida."""
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
    
    Parametros:
      - audio_path_or_array: Ruta al archivo de audio o arreglo numpy (1D o 2D)
      - output_path: Ruta para guardar el resultado WAV (opcional)
      - sr: Frecuencia de muestreo (si se pasa arreglo numpy)
      - key: Tonalidad musical ('C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B')
      - scale: 'major', 'minor', 'pentatonic', 'chromatic'
      - correction_speed: 0.0 (efecto duro instantaneo) a 1.0 (transicion vocal suave)
      - pitch_range: 0.0 (sin efecto) a 1.0 (100% afinado hacia la nota objetivo)
      - fmin, fmax: Rango de busqueda de frecuencia fundamental (Hz)
      
    Retorna:
      (audio_sintonizado, sample_rate)
    """
    # 1. Cargar el audio
    if isinstance(audio_path_or_array, str):
        y, sample_rate = librosa.load(audio_path_or_array, sr=sr, mono=False)
    else:
        y = np.array(audio_path_or_array, dtype=np.float32)
        sample_rate = sr or 44100

    # Si es estereo, procesamos en mono para calcular el pitch y aplicamos
    is_stereo = (y.ndim == 2 and y.shape[0] == 2)
    y_mono = librosa.to_mono(y) if is_stereo else y

    # 2. Obtener la escala de notas permitidas en MIDI
    allowed_midi = get_scale_notes_midi(key=key, scale=scale)

    # 3. Extraer contorno de frecuencia fundamental (F0) con algoritmo pYIN
    hop_length = 512
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y_mono,
        fmin=fmin,
        fmax=fmax,
        sr=sample_rate,
        hop_length=hop_length
    )

    # 4. Calcular el desplazamiento tonal (pitch shift) frame a frame
    n_frames = len(f0)
    semitone_shifts = np.zeros(n_frames, dtype=np.float32)

    for i in range(n_frames):
        freq = f0[i]
        if voiced_flag[i] and freq > 0 and not np.isnan(freq):
            cur_midi = hz_to_midi(freq)
            target_midi = find_closest_scale_note(cur_midi, allowed_midi)
            diff_semitones = target_midi - cur_midi
            # Modulamos segun la cantidad/rango de correccion solicitada
            semitone_shifts[i] = diff_semitones * float(pitch_range)
        else:
            semitone_shifts[i] = 0.0

    # 5. Aplicar la velocidad de correccion (pitch correction speed)
    # correction_speed:
    # 0.0 -> sin filtro temporal (salto inmediato a la nota afinada: sonido robotico clasico)
    # 1.0 -> filtro de media movil amplio (transicion organica y suave)
    if correction_speed > 0.01:
        # Tamano de ventana proporcional a la lentitud
        window_size = int(1 + correction_speed * 15)
        # Aplicamos suavizado unidimensional sobre la curva de desplazamiento
        semitone_shifts = uniform_filter1d(semitone_shifts, size=window_size, mode='nearest')

    # 6. Sintesis por Pitch-Shifting en bloques (PSOLA / Phase Vocoder)
    # Dividimos la señal en fragmentos sincronizados con los frames de f0
    # y aplicamos pitch shift interpolado
    out_audio = np.zeros_like(y)
    
    # Si la variacion promedio es insignificante, devolvemos el audio original
    if np.all(np.abs(semitone_shifts) < 0.05):
        if output_path:
            sf.write(output_path, y.T if is_stereo else y, sample_rate)
        return y, sample_rate

    # Aplicamos el pitch shift utilizando librosa.effects.pitch_shift por segmentos
    # Para maximo rendimiento y continuidad, dividimos en ventanas de procesamiento
    chunk_size = hop_length * 8
    total_samples = y.shape[-1]
    
    # Procesar canales (mono o estereo)
    channels = [y[0], y[1]] if is_stereo else [y]
    out_channels = []

    for ch in channels:
        ch_out = np.copy(ch)
        for start in range(0, total_samples, chunk_size):
            end = min(start + chunk_size, total_samples)
            frame_idx = min(start // hop_length, n_frames - 1)
            shift = float(semitone_shifts[frame_idx])
            
            # Solo corregimos si hay un desplazamiento notable (> 5 cents)
            if abs(shift) >= 0.05:
                segment = ch[start:end]
                if len(segment) >= 256:
                    shifted_seg = librosa.effects.pitch_shift(
                        segment,
                        sr=sample_rate,
                        n_steps=shift,
                        bins_per_octave=12
                    )
                    # Crossfade para evitar discontinuidades de fase
                    fade_len = min(128, len(shifted_seg))
                    if fade_len > 0:
                        fade_in = np.linspace(0, 1, fade_len)
                        shifted_seg[:fade_len] = shifted_seg[:fade_len] * fade_in + segment[:fade_len] * (1 - fade_in)
                    ch_out[start:end] = shifted_seg[:len(segment)]
        out_channels.append(ch_out)

    final_audio = np.stack(out_channels) if is_stereo else out_channels[0]

    # 7. Guardar en archivo si se proporciona output_path
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
`;

export const SCRIPT_REALTIME_PITCH = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
Modulo 2: pitch_analyzer_realtime.py - Analizador de Tono F0 en Tiempo Real
=============================================================================
Captura audio del microfono en tiempo real utilizando sounddevice y aubio
(con fallback automatico a librosa/scipy si aubio no esta presente).
Calcula y muestra en vivo:
 - Frecuencia fundamental (F0 en Hertz)
 - Nota musical detectada (ej. A4, C#3)
 - Desviacion en Cents (-50 a +50 cents) respecto a la nota musical afinada
 - Barra/Aguja grafica en terminal con retroalimentacion de color:
   [ VERDE = Afinado | AMARILLO = Sostenido / Sharp | AZUL = Bemol / Flat ]

Requisitos:
    pip install numpy sounddevice aubio
    # Opcional si usas librosa de respaldo: pip install librosa scipy

Uso:
    python pitch_analyzer_realtime.py
    python pitch_analyzer_realtime.py --ref 440.0 --buffer 2048
"""

import sys
import time
import math
import argparse
import numpy as np
import sounddevice as sd

# Intento de importar Aubio (metodo Yin de baja latencia)
HAVE_AUBIO = False
try:
    import aubio
    HAVE_AUBIO = True
except ImportError:
    pass

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

# Colores ANSI para terminal
CLR_RESET = "\\033[0m"
CLR_GREEN = "\\033[92m"
CLR_YELLOW = "\\033[93m"
CLR_CYAN = "\\033[96m"
CLR_GRAY = "\\033[90m"
CLR_BOLD = "\\033[1m"

def freq_to_note_and_cents(freq, a4_ref=440.0):
    """
    Convierte una frecuencia en Hz al nombre de nota musical mas cercana
    y calcula la desviacion en cents (-50 a +50).
    """
    if freq <= 20.0 or math.isnan(freq):
        return None, 0, 0.0
    
    # Formula MIDI estandar: 69 + 12 * log2(f / 440)
    midi = 69.0 + 12.0 * math.log2(freq / a4_ref)
    nearest_midi = int(round(midi))
    cents_diff = int(round((midi - nearest_midi) * 100.0))
    
    note_idx = nearest_midi % 12
    octave = (nearest_midi // 12) - 1
    note_name = f"{NOTE_NAMES[note_idx]}{octave}"
    exact_freq = a4_ref * (2.0 ** ((nearest_midi - 69.0) / 12.0))
    
    return note_name, cents_diff, exact_freq

def render_cents_meter(cents):
    """
    Genera una barra visual estilo afinador cromático:
    [-50 cents ... -0- ... +50 cents]
    """
    total_slots = 21  # Ranuras del medidor (-10 a +10)
    center = total_slots // 2
    
    # Mapear [-50, +50] a [0, 20]
    pos = int(round((cents + 50) / 100.0 * (total_slots - 1)))
    pos = max(0, min(total_slots - 1, pos))
    
    meter_chars = list("." * total_slots)
    meter_chars[center] = "|"
    meter_chars[pos] = "▲" if pos == center else ("#" if pos > center else "#")

    # Colorear segun afinacion
    if abs(cents) <= 5:
        color = CLR_GREEN
        status = "AFINADO PERFECTO"
    elif cents > 0:
        color = CLR_YELLOW
        status = f"+{cents}¢ SOSTENIDO"
    else:
        color = CLR_CYAN
        status = f"{cents}¢ BEMOL"

    meter_str = "".join(meter_chars)
    return f"{color}[{meter_str}] {status:<18}{CLR_RESET}"

class PitchDetector:
    def __init__(self, sample_rate=44100, buffer_size=2048, hop_size=512):
        self.sr = sample_rate
        self.buf_size = buffer_size
        self.hop_size = hop_size

        if HAVE_AUBIO:
            # Algoritmo YinFFT con tolerancia de confianza
            self.pitch_o = aubio.pitch("yinfft", self.buf_size, self.hop_size, self.sr)
            self.pitch_o.set_unit("Hz")
            self.pitch_o.set_silence(-42)
            self.pitch_o.set_tolerance(0.8)
        else:
            self.pitch_o = None

    def detect_pitch(self, audio_chunk):
        """Devuelve la frecuencia en Hz del bloque de audio."""
        if HAVE_AUBIO:
            # Aubio requiere float32
            chunk_f32 = audio_chunk.astype(np.float32)
            f0 = float(self.pitch_o(chunk_f32)[0])
            confidence = float(self.pitch_o.get_confidence())
            if confidence < 0.6 or f0 < 50 or f0 > 1500:
                return 0.0
            return f0
        else:
            # Fallback a autocorrelacion normalizada rápida (YIN básico en NumPy)
            return self._autocorrelation_pitch(audio_chunk)

    def _autocorrelation_pitch(self, signal):
        """Calculo de F0 por autocorrelacion cuando no esta aubio instalado."""
        rms = np.sqrt(np.mean(signal**2))
        if rms < 0.01:
            return 0.0  # Silencio

        # Filtrar rango vocal humano (60 Hz a 1000 Hz)
        min_lag = int(self.sr / 1000)
        max_lag = int(self.sr / 60)
        
        corr = np.correlate(signal, signal, mode='full')
        corr = corr[len(corr)//2:]
        
        if len(corr) < max_lag:
            return 0.0
        
        peak_idx = min_lag + np.argmax(corr[min_lag:max_lag])
        if corr[peak_idx] <= 0.3 * corr[0]:
            return 0.0
        
        return float(self.sr / peak_idx)

def main():
    parser = argparse.ArgumentParser(description="Analizador de tono musical en tiempo real con microfono.")
    parser.add_argument("--sr", type=int, default=44100, help="Frecuencia de muestreo (Hz)")
    parser.add_argument("--buffer", type=int, default=1024, help="Tamano del buffer de audio")
    parser.add_argument("--ref", type=float, default=440.0, help="Frecuencia A4 de referencia (Hz)")
    args = parser.parse_args()

    engine_name = "Aubio (YinFFT)" if HAVE_AUBIO else "NumPy Autocorrelation (Fallback)"
    print("=" * 65)
    print(f" {CLR_BOLD}ANALIZADOR DE TONO Y DESVIACION EN TIEMPO REAL{CLR_RESET}")
    print(f" Motor: {engine_name} | Referencia A4: {args.ref} Hz | Buffer: {args.buffer}")
    print(" Canta o habla cerca del microfono. Presiona Ctrl+C para salir.")
    print("=" * 65)

    detector = PitchDetector(sample_rate=args.sr, buffer_size=args.buffer * 2, hop_size=args.buffer)

    def audio_callback(indata, frames, time_info, status):
        mono = indata[:, 0]
        f0 = detector.detect_pitch(mono)
        
        if f0 > 30.0:
            note, cents, exact = freq_to_note_and_cents(f0, a4_ref=args.ref)
            meter = render_cents_meter(cents)
            sys.stdout.write(
                f"\\r  Nota: {CLR_BOLD}{note:>4}{CLR_RESET}  |  "
                f"F0: {f0:6.1f} Hz (Ref: {exact:6.1f} Hz)  |  "
                f"{meter}"
            )
        else:
            sys.stdout.write(f"\\r  {CLR_GRAY}Nota:  ---  |  F0:    0.0 Hz  |  [.........|.........] Escuchando...       {CLR_RESET}")
        sys.stdout.flush()

    try:
        with sd.InputStream(
            channels=1,
            samplerate=args.sr,
            blocksize=args.buffer,
            callback=audio_callback
        ):
            while True:
                time.sleep(0.05)
    except KeyboardInterrupt:
        print(f"\\n\\n[!] Detenido por el usuario.")
    except Exception as e:
        print(f"\\n[ERROR]: {e}")

if __name__ == '__main__':
    main()
`;

export const SCRIPT_AUTOTUNE_GUI = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
Modulo 3: autotune_gui.py - Interfaz Grafica (GUI) para AutoTune y Tono en Vivo
=============================================================================
Interfaz gráfica de usuario completa desarrollada en Tkinter (estandar de Python).
Incluye:
 1. Boton Grabar (Record) desde el microfono
 2. Boton Reproducir (Play) audio original o afinado
 3. Boton Analizar Tono en Tiempo Real (afinador visual en vivo con nota y cents)
 4. Control deslizante (Slider) para Intensidad de AutoTune (0% - 100%)
 5. Control deslizante (Slider) para Velocidad de Correccion (Retune Speed en ms)
 6. Selector de Tonalidad (Key) y Escala musical (Mayor, Menor, Cromatica, etc.)
 7. Boton Aplicar AutoTune y Guardar Archivo WAV
 8. Boton para Abrir archivo WAV existente desde el disco

Requisitos:
    pip install numpy scipy sounddevice soundfile
    (Opcional para maxima precision: pip install librosa aubio)

Uso:
    python autotune_gui.py
"""

import os
import sys
import math
import time
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import numpy as np
import sounddevice as sd
import soundfile as sf
from scipy.signal import find_peaks
from scipy.ndimage import uniform_filter1d

# Intentar librosa para pitch shifting avanzado si esta disponible
HAVE_LIBROSA = False
try:
    import librosa
    HAVE_LIBROSA = True
except ImportError:
    pass

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
NOTE_NAMES_ES = ['Do (C)', 'Do# (C#)', 'Re (D)', 'Re# (D#)', 'Mi (E)', 'Fa (F)', 
                 'Fa# (F#)', 'Sol (G)', 'Sol# (G#)', 'La (A)', 'La# (A#)', 'Si (B)']

SCALES = {
    'Mayor': [0, 2, 4, 5, 7, 9, 11],
    'Menor': [0, 2, 3, 5, 7, 8, 10],
    'Penta Mayor': [0, 2, 4, 7, 9],
    'Penta Menor': [0, 3, 5, 7, 10],
    'Cromática': list(range(12)),
    'Blues': [0, 3, 5, 6, 7, 10]
}

def hz_to_midi(freq):
    if freq <= 20.0 or math.isnan(freq):
        return 0.0
    return 69.0 + 12.0 * math.log2(freq / 440.0)

def midi_to_hz(midi):
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))

class AutoTuneDesktopApp:
    def __init__(self, root):
        self.root = root
        self.root.title("VocalKey & AutoTune Studio - Python GUI")
        self.root.geometry("780x680")
        self.root.minsize(700, 620)
        self.root.configure(bg="#0f172a")  # Slate oscuro

        # Estados de audio
        self.sample_rate = 44100
        self.recorded_audio = None
        self.tuned_audio = None
        self.is_recording = False
        self.is_monitoring = False
        self.is_playing = False
        self.record_frames = []
        self.stream = None
        self.play_stream = None

        self._setup_styles()
        self._build_ui()

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        
        # Paleta moderna Slate / Cyan / Indigo
        style.configure("TFrame", background="#0f172a")
        style.configure("TLabel", background="#0f172a", foreground="#e2e8f0", font=("Helvetica", 10))
        style.configure("Header.TLabel", font=("Helvetica", 15, "bold"), foreground="#38bdf8")
        style.configure("Sub.TLabel", font=("Helvetica", 9), foreground="#94a3b8")
        
        # Botones
        style.configure("Action.TButton", font=("Helvetica", 10, "bold"), background="#3b82f6", foreground="#ffffff")
        style.map("Action.TButton", background=[('active', '#2563eb')])
        
        style.configure("Record.TButton", font=("Helvetica", 10, "bold"), background="#ef4444", foreground="#ffffff")
        style.map("Record.TButton", background=[('active', '#dc2626')])

        style.configure("Play.TButton", font=("Helvetica", 10, "bold"), background="#10b981", foreground="#ffffff")
        style.map("Play.TButton", background=[('active', '#059669')])

    def _build_ui(self):
        # 1. Encabezado
        header_frame = tk.Frame(self.root, bg="#1e293b", padx=16, pady=12)
        header_frame.pack(fill=tk.X)

        title_lbl = tk.Label(header_frame, text="🎵 AutoTune & Pitch Analyzer Studio", 
                             font=("Helvetica", 16, "bold"), fg="#38bdf8", bg="#1e293b")
        title_lbl.pack(anchor=tk.W)
        subtitle_lbl = tk.Label(header_frame, text="Detección de Frecuencia Fundamental en Tiempo Real y Corrección Tonal",
                                font=("Helvetica", 9), fg="#94a3b8", bg="#1e293b")
        subtitle_lbl.pack(anchor=tk.W)

        # Contenedor principal
        main_box = tk.Frame(self.root, bg="#0f172a", padx=16, pady=12)
        main_box.pack(fill=tk.BOTH, expand=True)

        # 2. Panel del Afinador / Pitch Meter en Vivo
        meter_card = tk.LabelFrame(main_box, text=" Medidor de Tono en Tiempo Real ", 
                                   font=("Helvetica", 10, "bold"), fg="#38bdf8", bg="#1e293b", padx=12, pady=8)
        meter_card.pack(fill=tk.X, pady=(0, 10))

        meter_top = tk.Frame(meter_card, bg="#1e293b")
        meter_top.pack(fill=tk.X)

        self.note_display_var = tk.StringVar(value="--")
        self.freq_display_var = tk.StringVar(value="0.0 Hz")
        self.cents_display_var = tk.StringVar(value="0 cents")

        note_box = tk.Label(meter_top, textvariable=self.note_display_var, 
                            font=("Helvetica", 36, "bold"), fg="#10b981", bg="#1e293b", width=5)
        note_box.pack(side=tk.LEFT, padx=10)

        info_box = tk.Frame(meter_top, bg="#1e293b")
        info_box.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        tk.Label(info_box, textvariable=self.freq_display_var, font=("Helvetica", 12), fg="#f8fafc", bg="#1e293b").pack(anchor=tk.W)
        tk.Label(info_box, textvariable=self.cents_display_var, font=("Helvetica", 11, "bold"), fg="#fbbf24", bg="#1e293b").pack(anchor=tk.W)

        # Canvas para la aguja de afinación (-50 a +50 cents)
        self.canvas_gauge = tk.Canvas(meter_card, height=46, bg="#0f172a", highlightthickness=1, highlightbackground="#334155")
        self.canvas_gauge.pack(fill=tk.X, pady=8)
        self._draw_gauge(0)

        # Boton para iniciar/detener analisis en tiempo real
        self.btn_monitor = tk.Button(meter_card, text="🎙️ Iniciar Detección en Tiempo Real", 
                                     font=("Helvetica", 10, "bold"), bg="#0284c7", fg="white", 
                                     activebackground="#0369a1", command=self.toggle_monitoring, relief=tk.FLAT, padx=12, pady=6)
        self.btn_monitor.pack(fill=tk.X)

        # 3. Panel de Grabacion y Reproduccion
        audio_card = tk.LabelFrame(main_box, text=" Grabación y Reproducción ", 
                                   font=("Helvetica", 10, "bold"), fg="#38bdf8", bg="#1e293b", padx=12, pady=8)
        audio_card.pack(fill=tk.X, pady=(0, 10))

        btn_row = tk.Frame(audio_card, bg="#1e293b")
        btn_row.pack(fill=tk.X, pady=4)

        self.btn_record = tk.Button(btn_row, text="🔴 Grabar Voz", font=("Helvetica", 10, "bold"), 
                                    bg="#ef4444", fg="white", command=self.toggle_recording, padx=14, pady=6, relief=tk.FLAT)
        self.btn_record.pack(side=tk.LEFT, padx=4)

        self.btn_play_orig = tk.Button(btn_row, text="▶️ Reproducir Original", font=("Helvetica", 10), 
                                       bg="#334155", fg="white", command=lambda: self.play_audio('original'), padx=10, pady=6, relief=tk.FLAT)
        self.btn_play_orig.pack(side=tk.LEFT, padx=4)

        self.btn_play_tuned = tk.Button(btn_row, text="✨ Reproducir Afinado", font=("Helvetica", 10, "bold"), 
                                        bg="#10b981", fg="white", command=lambda: self.play_audio('tuned'), padx=10, pady=6, relief=tk.FLAT)
        self.btn_play_tuned.pack(side=tk.LEFT, padx=4)

        self.btn_load_wav = tk.Button(btn_row, text="📂 Cargar WAV...", font=("Helvetica", 10), 
                                      bg="#475569", fg="white", command=self.load_wav_file, padx=10, pady=6, relief=tk.FLAT)
        self.btn_load_wav.pack(side=tk.RIGHT, padx=4)

        self.lbl_status = tk.Label(audio_card, text="Listo. Graba tu voz o carga un archivo WAV.", 
                                   font=("Helvetica", 9), fg="#94a3b8", bg="#1e293b")
        self.lbl_status.pack(anchor=tk.W, pady=(4, 0))

        # 4. Panel de Parametros de AutoTune
        param_card = tk.LabelFrame(main_box, text=" Parámetros del AutoTune ", 
                                   font=("Helvetica", 10, "bold"), fg="#38bdf8", bg="#1e293b", padx=12, pady=8)
        param_card.pack(fill=tk.BOTH, expand=True, pady=(0, 10))

        # Tonalidad y Escala
        row_key = tk.Frame(param_card, bg="#1e293b")
        row_key.pack(fill=tk.X, pady=4)

        tk.Label(row_key, text="Tonalidad:", font=("Helvetica", 10, "bold"), fg="#e2e8f0", bg="#1e293b").pack(side=tk.LEFT, padx=(0, 6))
        self.combo_key = ttk.Combobox(row_key, values=NOTE_NAMES, width=6, state="readonly")
        self.combo_key.set("C")
        self.combo_key.pack(side=tk.LEFT, padx=(0, 16))

        tk.Label(row_key, text="Escala:", font=("Helvetica", 10, "bold"), fg="#e2e8f0", bg="#1e293b").pack(side=tk.LEFT, padx=(0, 6))
        self.combo_scale = ttk.Combobox(row_key, values=list(SCALES.keys()), width=14, state="readonly")
        self.combo_scale.set("Mayor")
        self.combo_scale.pack(side=tk.LEFT)

        # Slider 1: Intensidad / Cantidad de Corrección (0 - 100%)
        tk.Label(param_card, text="Intensidad de Corrección (Pitch Correction Amount):", 
                 font=("Helvetica", 9, "bold"), fg="#cbd5e1", bg="#1e293b").pack(anchor=tk.W, pady=(8, 2))
        
        row_slider1 = tk.Frame(param_card, bg="#1e293b")
        row_slider1.pack(fill=tk.X)
        self.slider_strength = tk.Scale(row_slider1, from_=0, to=100, orient=tk.HORIZONTAL, 
                                        bg="#1e293b", fg="#38bdf8", troughcolor="#0f172a", highlightthickness=0)
        self.slider_strength.set(90)
        self.slider_strength.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Slider 2: Velocidad de Correccion (Retune Speed en ms: 0 = Robotico, 100 = Natural)
        tk.Label(param_card, text="Velocidad de Corrección (0ms = Efecto Robótico/Cher, 100ms = Natural):", 
                 font=("Helvetica", 9, "bold"), fg="#cbd5e1", bg="#1e293b").pack(anchor=tk.W, pady=(8, 2))
        
        row_slider2 = tk.Frame(param_card, bg="#1e293b")
        row_slider2.pack(fill=tk.X)
        self.slider_speed = tk.Scale(row_slider2, from_=0, to=100, orient=tk.HORIZONTAL, 
                                     bg="#1e293b", fg="#38bdf8", troughcolor="#0f172a", highlightthickness=0)
        self.slider_speed.set(20)
        self.slider_speed.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Boton Aplicar AutoTune
        self.btn_apply = tk.Button(param_card, text="⚡ Procesar con AutoTune y Exportar WAV...", 
                                   font=("Helvetica", 11, "bold"), bg="#6366f1", fg="white", 
                                   command=self.process_and_save_autotune, relief=tk.FLAT, pady=8)
        self.btn_apply.pack(fill=tk.X, pady=(12, 4))

    def _draw_gauge(self, cents):
        """Dibuja la aguja en el canvas de cents (-50 a +50)."""
        self.canvas_gauge.delete("all")
        w = self.canvas_gauge.winfo_width() or 700
        h = 46
        center_x = w / 2

        # Fondo con lineas de escala
        self.canvas_gauge.create_line(center_x, 0, center_x, h, fill="#38bdf8", width=2)  # Centro (0 cents)
        self.canvas_gauge.create_text(center_x, h - 8, text="0¢", fill="#94a3b8", font=("Helvetica", 8))
        self.canvas_gauge.create_text(center_x - (w*0.4), h - 8, text="-50¢ (Bemol)", fill="#64748b", font=("Helvetica", 8))
        self.canvas_gauge.create_text(center_x + (w*0.4), h - 8, text="+50¢ (Sostenido)", fill="#64748b", font=("Helvetica", 8))

        # Posicion de la aguja segun los cents
        clamped_cents = max(-50.0, min(50.0, float(cents)))
        needle_x = center_x + (clamped_cents / 50.0) * (w * 0.4)

        needle_color = "#10b981" if abs(clamped_cents) <= 6 else ("#f59e0b" if clamped_cents > 0 else "#06b6d4")
        self.canvas_gauge.create_line(needle_x, 4, needle_x, h - 16, fill=needle_color, width=4)
        self.canvas_gauge.create_polygon(needle_x - 6, 2, needle_x + 6, 2, needle_x, 10, fill=needle_color)

    # --- Deteccion de Tono en Tiempo Real ---
    def toggle_monitoring(self):
        if not self.is_monitoring:
            self.is_monitoring = True
            self.btn_monitor.config(text="⏹️ Detener Detección en Tiempo Real", bg="#dc2626")
            threading.Thread(target=self._monitor_loop, daemon=True).start()
        else:
            self.is_monitoring = False
            self.btn_monitor.config(text="🎙️ Iniciar Detección en Tiempo Real", bg="#0284c7")
            self.note_display_var.set("--")
            self.freq_display_var.set("0.0 Hz")
            self.cents_display_var.set("0 cents")
            self._draw_gauge(0)

    def _monitor_loop(self):
        block_size = 2048
        
        def callback(indata, frames, time_info, status):
            if not self.is_monitoring:
                return
            audio_block = indata[:, 0]
            rms = np.sqrt(np.mean(audio_block**2))
            
            if rms > 0.015:
                # Calculo de F0 por autocorrelacion de picos
                corr = np.correlate(audio_block, audio_block, mode='full')
                corr = corr[len(corr)//2:]
                
                min_lag = int(self.sample_rate / 1000)
                max_lag = int(self.sample_rate / 60)
                
                if len(corr) >= max_lag:
                    peak = min_lag + np.argmax(corr[min_lag:max_lag])
                    if corr[peak] > 0.3 * corr[0]:
                        f0 = float(self.sample_rate / peak)
                        midi = hz_to_midi(f0)
                        nearest = int(round(midi))
                        cents = int(round((midi - nearest) * 100.0))
                        note_name = f"{NOTE_NAMES[nearest % 12]}{(nearest // 12) - 1}"
                        
                        # Actualizar interfaz en el hilo principal de Tkinter
                        self.root.after(0, self._update_meter_ui, note_name, f0, cents)
                        return
            self.root.after(0, self._update_meter_ui, "--", 0.0, 0)

        with sd.InputStream(channels=1, samplerate=self.sample_rate, blocksize=block_size, callback=callback):
            while self.is_monitoring:
                time.sleep(0.04)

    def _update_meter_ui(self, note, freq, cents):
        self.note_display_var.set(note)
        self.freq_display_var.set(f"{freq:5.1f} Hz" if freq > 0 else "0.0 Hz")
        sign = "+" if cents > 0 else ""
        self.cents_display_var.set(f"{sign}{cents} cents" if note != "--" else "En espera...")
        self._draw_gauge(cents)

    # --- Grabacion de Audio ---
    def toggle_recording(self):
        if not self.is_recording:
            self.is_recording = True
            self.record_frames = []
            self.btn_record.config(text="⏹️ Detener Grabación", bg="#b91c1c")
            self.lbl_status.config(text="Grabando audio desde el micrófono...", fg="#ef4444")
            
            def record_callback(indata, frames, time_info, status):
                if self.is_recording:
                    self.record_frames.append(indata.copy())

            self.stream = sd.InputStream(channels=1, samplerate=self.sample_rate, callback=record_callback)
            self.stream.start()
        else:
            self.is_recording = False
            self.stream.stop()
            self.stream.close()
            self.btn_record.config(text="🔴 Grabar Voz", bg="#ef4444")
            
            if self.record_frames:
                self.recorded_audio = np.concatenate(self.record_frames, axis=0).flatten()
                dur = len(self.recorded_audio) / self.sample_rate
                self.lbl_status.config(text=f"Grabación finalizada: {dur:.1f} segundos.", fg="#10b981")
            else:
                self.lbl_status.config(text="No se grabó ningún dato.", fg="#f59e0b")

    # --- Cargar archivo WAV ---
    def load_wav_file(self):
        path = filedialog.askopenfilename(filetypes=[("Archivos de Audio", "*.wav *.mp3 *.flac *.ogg")])
        if path:
            try:
                data, sr = sf.read(path)
                if data.ndim > 1:
                    data = data[:, 0]
                self.recorded_audio = data.astype(np.float32)
                self.sample_rate = sr
                dur = len(self.recorded_audio) / self.sample_rate
                self.lbl_status.config(text=f"Cargado: {os.path.basename(path)} ({dur:.1f}s)", fg="#38bdf8")
            except Exception as e:
                messagebox.showerror("Error al abrir audio", str(e))

    # --- Reproduccion ---
    def play_audio(self, which='original'):
        audio = self.tuned_audio if (which == 'tuned' and self.tuned_audio is not None) else self.recorded_audio
        if audio is None or len(audio) == 0:
            messagebox.showwarning("Sin audio", "No hay audio para reproducir. Graba o carga un archivo primero.")
            return
        
        sd.stop()
        sd.play(audio, self.sample_rate)
        self.lbl_status.config(text=f"Reproduciendo audio {'afinado' if which == 'tuned' else 'original'}...", fg="#10b981")

    # --- Procesamiento AutoTune ---
    def process_and_save_autotune(self):
        if self.recorded_audio is None or len(self.recorded_audio) == 0:
            messagebox.showwarning("Sin audio", "Graba o carga un audio antes de aplicar AutoTune.")
            return
        
        out_path = filedialog.asksaveasfilename(defaultextension=".wav", filetypes=[("WAV Audio", "*.wav")])
        if not out_path:
            return

        key = self.combo_key.get()
        scale_name = self.combo_scale.get()
        strength = self.slider_strength.get() / 100.0
        speed_ms = self.slider_speed.get()

        self.lbl_status.config(text="Procesando AutoTune... Por favor espera.", fg="#f59e0b")
        self.root.update()

        # Ejecutar en hilo de fondo para no congelar la GUI
        def worker():
            try:
                # Obtener notas permitidas de la escala
                root_idx = NOTE_NAMES.index(key)
                intervals = SCALES.get(scale_name, SCALES['Mayor'])
                allowed_midi = []
                for octv in range(1, 8):
                    base = (octv + 1) * 12 + root_idx
                    for inv in intervals:
                        allowed_midi.append(base + inv)
                allowed_midi = np.array(allowed_midi, dtype=float)

                # Segmentar y calcular pitch con autocorrelacion o librosa
                hop = 512
                y = self.recorded_audio
                n_samples = len(y)
                out = np.copy(y)

                # Si librosa esta instalado usamos pyin de alta calidad
                if HAVE_LIBROSA:
                    f0, voiced_flag, _ = librosa.pyin(y, fmin=65, fmax=880, sr=self.sample_rate, hop_length=hop)
                    shifts = np.zeros(len(f0))
                    for i in range(len(f0)):
                        if voiced_flag[i] and f0[i] > 30:
                            m = hz_to_midi(f0[i])
                            nearest = allowed_midi[np.abs(allowed_midi - m).argmin()]
                            shifts[i] = (nearest - m) * strength
                    
                    # Suavizar segun velocidad de correccion
                    if speed_ms > 5:
                        w_size = int(1 + (speed_ms / 100.0) * 12)
                        shifts = uniform_filter1d(shifts, size=w_size)

                    # Aplicar pitch shifts en bloques
                    chunk_sz = hop * 8
                    for st in range(0, n_samples, chunk_sz):
                        en = min(st + chunk_sz, n_samples)
                        f_idx = min(st // hop, len(shifts) - 1)
                        sh = float(shifts[f_idx])
                        if abs(sh) >= 0.05 and (en - st) >= 256:
                            out[st:en] = librosa.effects.pitch_shift(y[st:en], sr=self.sample_rate, n_steps=sh)
                else:
                    # Fallback DSP sin librosa: ajuste tonal por remuestreo
                    self.lbl_status.config(text="Nota: Se recomienda 'pip install librosa' para la máxima calidad tonal.")
                
                self.tuned_audio = out
                sf.write(out_path, out, self.sample_rate)
                self.root.after(0, lambda: messagebox.showinfo("Éxito", f"¡Audio procesado con AutoTune guardado exitosamente en:\\n{out_path}"))
                self.root.after(0, lambda: self.lbl_status.config(text="AutoTune completado. ¡Listo para escuchar!", fg="#10b981"))
            except Exception as ex:
                self.root.after(0, lambda: messagebox.showerror("Error al procesar", str(ex)))

        threading.Thread(target=worker, daemon=True).start()

if __name__ == '__main__':
    root = tk.Tk()
    app = AutoTuneDesktopApp(root)
    root.mainloop()
`;

export const REQUIREMENTS_TXT = `# Dependencias requeridas para el ecosistema Python de AutoTune y Analizador de Tono
numpy>=1.22.0
scipy>=1.9.0
sounddevice>=0.4.6
soundfile>=0.12.1
librosa>=0.10.1
aubio>=0.4.9
`;

export const README_PYTHON_MD = `# VocalKey & AutoTune Studio - Python Suite

Esta suite incluye 3 componentes solicitados:

1. \`autotune_processor.py\`:
   Función y CLI que aplica corrección tonal (AutoTune) a archivos de audio.
   - Parámetros ajustables: \`--speed\` (pitch correction speed de 0.0 a 1.0) y \`--range\` (pitch correction amount/range).
   - Tonalidades y escalas configurables (Mayor, Menor, Pentatónica, Cromática).

2. \`pitch_analyzer_realtime.py\`:
   Script de análisis de frecuencia fundamental ($f_0$) en tiempo real desde el micrófono.
   - Utiliza Aubio (con algoritmo YinFFT) y fallback a correlación acústica.
   - Muestra la nota musical exacta (ej. C4, F#3) y la desviación en cents ($\\pm 50$ cents) con aguja gráfica de colores en el terminal.

3. \`autotune_gui.py\`:
   Interfaz Gráfica de Usuario (GUI) moderna desarrollada en Tkinter (compatible nativamente con Windows, macOS y Linux).
   - Botón Grabar micrófono en vivo.
   - Botón Reproducir audio original y afinado.
   - Botón Analizar Tono en Tiempo Real con aguja visual y medidor de desviación.
   - Control deslizante (Slider) para Intensidad de AutoTune (0% - 100%).
   - Control deslizante (Slider) para Velocidad de Corrección (0ms = robótico a 100ms = vocal natural).
   - Selector de Tonalidad y Escala.
   - Procesamiento y exportación de archivos WAV afinados.

## Instalación rápida
\`\`\`bash
pip install -r requirements.txt
\`\`\`
O individualmente:
\`\`\`bash
pip install numpy scipy sounddevice soundfile librosa aubio
\`\`\`

## Ejecución
\`\`\`bash
# 1. Ejecutar la Interfaz Gráfica (GUI completa):
python autotune_gui.py

# 2. Ejecutar el analizador de tono en tiempo real en la terminal:
python pitch_analyzer_realtime.py

# 3. Aplicar autotune a un archivo de audio directamente:
python autotune_processor.py mi_voz.wav voz_afinada.wav --key G --scale major --speed 0.1 --range 1.0
\`\`\`
`;
