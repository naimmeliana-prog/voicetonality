#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
autotune_gui.py - Interfaz Gráfica Tkinter para AutoTune y Tono en Vivo
=============================================================================
Aplicación de escritorio nativa en Tkinter que incluye:
 1. Botón Grabar desde el micrófono.
 2. Botón Reproducir (original o afinado).
 3. Botón Analizar tono en tiempo real (con medidor de nota y aguja de cents).
 4. Control deslizante (Slider) para Intensidad de AutoTune (0% - 100%).
 5. Control deslizante (Slider) para Velocidad de Corrección (0 - 100ms).
 6. Selector de Tonalidad y Escala.
 7. Aplicar AutoTune y guardar en archivo WAV.
"""

import os
import math
import time
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import numpy as np
import sounddevice as sd
import soundfile as sf
from scipy.ndimage import uniform_filter1d

try:
    import librosa
    HAVE_LIBROSA = True
except ImportError:
    HAVE_LIBROSA = False

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
SCALES = {
    'Mayor': [0, 2, 4, 5, 7, 9, 11],
    'Menor': [0, 2, 3, 5, 7, 8, 10],
    'Pentatónica': [0, 2, 4, 7, 9],
    'Cromática': list(range(12)),
    'Blues': [0, 3, 5, 6, 7, 10]
}

def hz_to_midi(freq):
    if freq <= 20.0 or math.isnan(freq):
        return 0.0
    return 69.0 + 12.0 * math.log2(freq / 440.0)

class AutoTuneApp:
    def __init__(self, root):
        self.root = root
        self.root.title("AutoTune & Real-Time Pitch Studio")
        self.root.geometry("740x630")
        self.root.configure(bg="#0f172a")

        self.sample_rate = 44100
        self.recorded_audio = None
        self.tuned_audio = None
        self.is_recording = False
        self.is_monitoring = False
        self.record_frames = []

        self._build_ui()

    def _build_ui(self):
        # Encabezado
        head = tk.Frame(self.root, bg="#1e293b", padx=16, pady=10)
        head.pack(fill=tk.X)
        tk.Label(head, text="🎵 Vocal AutoTune & Pitch Analyzer", font=("Helvetica", 15, "bold"), fg="#38bdf8", bg="#1e293b").pack(anchor=tk.W)
        tk.Label(head, text="Detección en tiempo real de F0 y procesamiento de audio", font=("Helvetica", 9), fg="#94a3b8", bg="#1e293b").pack(anchor=tk.W)

        # 1. Medidor de Tono en Vivo
        meter_frame = tk.LabelFrame(self.root, text=" Medidor de Tono en Tiempo Real ", font=("Helvetica", 10, "bold"), fg="#38bdf8", bg="#1e293b", padx=12, pady=8)
        meter_frame.pack(fill=tk.X, padx=16, pady=(10, 6))

        top_row = tk.Frame(meter_frame, bg="#1e293b")
        top_row.pack(fill=tk.X)

        self.lbl_note = tk.Label(top_row, text="--", font=("Helvetica", 32, "bold"), fg="#10b981", bg="#1e293b", width=4)
        self.lbl_note.pack(side=tk.LEFT, padx=8)

        self.lbl_freq = tk.Label(top_row, text="0.0 Hz", font=("Helvetica", 12), fg="#f8fafc", bg="#1e293b")
        self.lbl_freq.pack(side=tk.LEFT, padx=12)

        self.lbl_cents = tk.Label(top_row, text="0 cents", font=("Helvetica", 12, "bold"), fg="#fbbf24", bg="#1e293b")
        self.lbl_cents.pack(side=tk.RIGHT, padx=12)

        self.canvas_gauge = tk.Canvas(meter_frame, height=40, bg="#0f172a", highlightthickness=1, highlightbackground="#334155")
        self.canvas_gauge.pack(fill=tk.X, pady=8)
        self._draw_gauge(0)

        self.btn_monitor = tk.Button(meter_frame, text="🎙️ Iniciar Detección en Tiempo Real", font=("Helvetica", 10, "bold"), 
                                     bg="#0284c7", fg="white", command=self.toggle_monitoring, relief=tk.FLAT, pady=6)
        self.btn_monitor.pack(fill=tk.X)

        # 2. Grabación y Reproducción
        audio_frame = tk.LabelFrame(self.root, text=" Grabación y Reproducción ", font=("Helvetica", 10, "bold"), fg="#38bdf8", bg="#1e293b", padx=12, pady=8)
        audio_frame.pack(fill=tk.X, padx=16, pady=6)

        btn_row = tk.Frame(audio_frame, bg="#1e293b")
        btn_row.pack(fill=tk.X, pady=4)

        self.btn_rec = tk.Button(btn_row, text="🔴 Grabar Voz", bg="#ef4444", fg="white", font=("Helvetica", 10, "bold"), command=self.toggle_recording, padx=12, pady=6, relief=tk.FLAT)
        self.btn_rec.pack(side=tk.LEFT, padx=4)

        self.btn_play_orig = tk.Button(btn_row, text="▶ Original", bg="#334155", fg="white", command=lambda: self.play_audio(False), padx=10, pady=6, relief=tk.FLAT)
        self.btn_play_orig.pack(side=tk.LEFT, padx=4)

        self.btn_play_tuned = tk.Button(btn_row, text="✨ Afinado", bg="#10b981", fg="white", font=("Helvetica", 10, "bold"), command=lambda: self.play_audio(True), padx=10, pady=6, relief=tk.FLAT)
        self.btn_play_tuned.pack(side=tk.LEFT, padx=4)

        self.btn_load = tk.Button(btn_row, text="📂 Cargar WAV...", bg="#475569", fg="white", command=self.load_wav, padx=10, pady=6, relief=tk.FLAT)
        self.btn_load.pack(side=tk.RIGHT, padx=4)

        self.lbl_status = tk.Label(audio_frame, text="Listo.", fg="#94a3b8", bg="#1e293b", font=("Helvetica", 9))
        self.lbl_status.pack(anchor=tk.W, pady=(4, 0))

        # 3. Controles AutoTune
        ctrl_frame = tk.LabelFrame(self.root, text=" Parámetros del AutoTune ", font=("Helvetica", 10, "bold"), fg="#38bdf8", bg="#1e293b", padx=12, pady=8)
        ctrl_frame.pack(fill=tk.BOTH, expand=True, padx=16, pady=6)

        sel_row = tk.Frame(ctrl_frame, bg="#1e293b")
        sel_row.pack(fill=tk.X, pady=4)

        tk.Label(sel_row, text="Tonalidad:", fg="white", bg="#1e293b", font=("Helvetica", 9, "bold")).pack(side=tk.LEFT)
        self.cb_key = ttk.Combobox(sel_row, values=NOTE_NAMES, width=5, state="readonly")
        self.cb_key.set("C")
        self.cb_key.pack(side=tk.LEFT, padx=(4, 16))

        tk.Label(sel_row, text="Escala:", fg="white", bg="#1e293b", font=("Helvetica", 9, "bold")).pack(side=tk.LEFT)
        self.cb_scale = ttk.Combobox(sel_row, values=list(SCALES.keys()), width=12, state="readonly")
        self.cb_scale.set("Mayor")
        self.cb_scale.pack(side=tk.LEFT, padx=4)

        # Slider Intensidad
        tk.Label(ctrl_frame, text="Intensidad de AutoTune (%):", fg="#cbd5e1", bg="#1e293b", font=("Helvetica", 9)).pack(anchor=tk.W, pady=(6, 2))
        self.slider_strength = tk.Scale(ctrl_frame, from_=0, to=100, orient=tk.HORIZONTAL, bg="#1e293b", fg="#38bdf8", troughcolor="#0f172a")
        self.slider_strength.set(90)
        self.slider_strength.pack(fill=tk.X)

        # Slider Velocidad
        tk.Label(ctrl_frame, text="Velocidad de Corrección (0ms = Robótico/Cher, 100ms = Natural):", fg="#cbd5e1", bg="#1e293b", font=("Helvetica", 9)).pack(anchor=tk.W, pady=(6, 2))
        self.slider_speed = tk.Scale(ctrl_frame, from_=0, to=100, orient=tk.HORIZONTAL, bg="#1e293b", fg="#38bdf8", troughcolor="#0f172a")
        self.slider_speed.set(20)
        self.slider_speed.pack(fill=tk.X)

        # Botón Procesar
        self.btn_process = tk.Button(ctrl_frame, text="⚡ Procesar con AutoTune y Guardar WAV...", bg="#6366f1", fg="white", font=("Helvetica", 10, "bold"), command=self.process_autotune, relief=tk.FLAT, pady=8)
        self.btn_process.pack(fill=tk.X, pady=(10, 4))

    def _draw_gauge(self, cents):
        self.canvas_gauge.delete("all")
        w = self.canvas_gauge.winfo_width() or 680
        center_x = w / 2
        clamped = max(-50.0, min(50.0, float(cents)))
        needle_x = center_x + (clamped / 50.0) * (w * 0.42)
        
        self.canvas_gauge.create_line(center_x, 0, center_x, 40, fill="#38bdf8", width=2)
        needle_color = "#10b981" if abs(clamped) <= 6 else ("#f59e0b" if clamped > 0 else "#06b6d4")
        self.canvas_gauge.create_line(needle_x, 4, needle_x, 36, fill=needle_color, width=4)

    def toggle_monitoring(self):
        if not self.is_monitoring:
            self.is_monitoring = True
            self.btn_monitor.config(text="⏹️ Detener Detección", bg="#dc2626")
            threading.Thread(target=self._monitor_worker, daemon=True).start()
        else:
            self.is_monitoring = False
            self.btn_monitor.config(text="🎙️ Iniciar Detección en Tiempo Real", bg="#0284c7")
            self.lbl_note.config(text="--")
            self.lbl_freq.config(text="0.0 Hz")
            self.lbl_cents.config(text="0 cents")
            self._draw_gauge(0)

    def _monitor_worker(self):
        def cb(indata, frames, time_info, status):
            if not self.is_monitoring: return
            mono = indata[:, 0]
            if np.sqrt(np.mean(mono**2)) > 0.015:
                corr = np.correlate(mono, mono, mode='full')[len(mono)//2:]
                min_l, max_l = int(self.sample_rate / 1000), int(self.sample_rate / 60)
                if len(corr) >= max_l:
                    peak = min_l + np.argmax(corr[min_l:max_l])
                    f0 = float(self.sample_rate / peak)
                    m = hz_to_midi(f0)
                    near = int(round(m))
                    c = int(round((m - near) * 100))
                    name = f"{NOTE_NAMES[near % 12]}{(near // 12) - 1}"
                    self.root.after(0, self._update_meter, name, f0, c)
                    return
            self.root.after(0, self._update_meter, "--", 0.0, 0)

        with sd.InputStream(channels=1, samplerate=self.sample_rate, blocksize=2048, callback=cb):
            while self.is_monitoring:
                time.sleep(0.04)

    def _update_meter(self, note, freq, cents):
        self.lbl_note.config(text=note)
        self.lbl_freq.config(text=f"{freq:5.1f} Hz" if freq > 0 else "0.0 Hz")
        self.lbl_cents.config(text=f"{'+' if cents > 0 else ''}{cents}¢")
        self._draw_gauge(cents)

    def toggle_recording(self):
        if not self.is_recording:
            self.is_recording = True
            self.record_frames = []
            self.btn_rec.config(text="⏹️ Detener", bg="#b91c1c")
            self.lbl_status.config(text="Grabando audio...", fg="#ef4444")
            self.stream = sd.InputStream(channels=1, samplerate=self.sample_rate, 
                                         callback=lambda d, f, t, s: self.record_frames.append(d.copy()) if self.is_recording else None)
            self.stream.start()
        else:
            self.is_recording = False
            self.stream.stop()
            self.stream.close()
            self.btn_rec.config(text="🔴 Grabar Voz", bg="#ef4444")
            if self.record_frames:
                self.recorded_audio = np.concatenate(self.record_frames, axis=0).flatten()
                self.lbl_status.config(text=f"Grabado: {len(self.recorded_audio)/self.sample_rate:.1f} s", fg="#10b981")

    def load_wav(self):
        p = filedialog.askopenfilename(filetypes=[("Archivos de Audio", "*.wav *.mp3 *.flac")])
        if p:
            data, sr = sf.read(p)
            self.recorded_audio = (data[:, 0] if data.ndim > 1 else data).astype(np.float32)
            self.sample_rate = sr
            self.lbl_status.config(text=f"Cargado: {os.path.basename(p)}", fg="#38bdf8")

    def play_audio(self, tuned=False):
        a = self.tuned_audio if tuned else self.recorded_audio
        if a is not None and len(a) > 0:
            sd.stop()
            sd.play(a, self.sample_rate)

    def process_autotune(self):
        if self.recorded_audio is None:
            messagebox.showwarning("Aviso", "Primero graba o carga un archivo de audio.")
            return
        out_p = filedialog.asksaveasfilename(defaultextension=".wav", filetypes=[("WAV", "*.wav")])
        if not out_p: return

        self.lbl_status.config(text="Procesando AutoTune...", fg="#f59e0b")
        def work():
            key, scale = self.cb_key.get(), self.cb_scale.get()
            strength = self.slider_strength.get() / 100.0
            speed_ms = self.slider_speed.get()
            
            root = NOTE_NAMES.index(key)
            midi_notes = np.array([((o + 1) * 12 + root + i) for o in range(1, 8) for i in SCALES[scale]], dtype=float)
            
            hop = 512
            y = self.recorded_audio
            out = np.copy(y)

            if HAVE_LIBROSA:
                f0, voiced, _ = librosa.pyin(y, fmin=65, fmax=880, sr=self.sample_rate, hop_length=hop)
                shifts = np.zeros(len(f0))
                for i in range(len(f0)):
                    if voiced[i] and f0[i] > 30:
                        m = hz_to_midi(f0[i])
                        shifts[i] = (midi_notes[np.abs(midi_notes - m).argmin()] - m) * strength
                
                if speed_ms > 5:
                    shifts = uniform_filter1d(shifts, size=int(1 + (speed_ms / 100.0) * 12))

                for st in range(0, len(y), hop * 8):
                    en = min(st + hop * 8, len(y))
                    sh = float(shifts[min(st // hop, len(shifts) - 1)])
                    if abs(sh) >= 0.05 and (en - st) >= 256:
                        out[st:en] = librosa.effects.pitch_shift(y[st:en], sr=self.sample_rate, n_steps=sh)
            
            self.tuned_audio = out
            sf.write(out_p, out, self.sample_rate)
            self.root.after(0, lambda: messagebox.showinfo("Listo", f"Guardado en:\n{out_p}"))
            self.root.after(0, lambda: self.lbl_status.config(text="AutoTune completado.", fg="#10b981"))

        threading.Thread(target=work, daemon=True).start()

if __name__ == '__main__':
    root = tk.Tk()
    app = AutoTuneApp(root)
    root.mainloop()
