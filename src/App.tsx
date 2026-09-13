/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { AutoTuneEngine } from './audio/autoTuneEngine';
import {
  AutoTuneSettings,
  KeyDetectionResult,
  NoteName,
  PitchDetectionResult,
  ScaleType,
} from './types';
import { PitchTunerDial } from './components/PitchTunerDial';
import { PitchRibbonCanvas } from './components/PitchRibbonCanvas';
import { FrequencySpectrumVisualizer } from './components/FrequencySpectrumVisualizer';
import { KeyDetectorCard } from './components/KeyDetectorCard';
import { AutoTuneControls } from './components/AutoTuneControls';
import { AudioRecorderPlayer } from './components/AudioRecorderPlayer';
import { RecordingHistoryManager } from './components/RecordingHistoryManager';
import { AudioSettingsModal } from './components/AudioSettingsModal';
import { PythonScriptModal } from './components/PythonScriptModal';
import { VocalGuideModal } from './components/VocalGuideModal';
import { saveRecording } from './services/recordingHistory';
import {
  AlertCircle,
  BookOpen,
  Contrast,
  FileCode,
  Mic,
  MicOff,
  Radio,
  Sliders,
  Sparkles,
  Volume2,
} from 'lucide-react';

export default function App() {
  const engineRef = useRef<AutoTuneEngine | null>(null);

  const [isAudioRunning, setIsAudioRunning] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  // High contrast mode for low-light studio booths
  const [isHighContrast, setIsHighContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vocalstudio_high_contrast') === 'true';
    } catch {
      return false;
    }
  });

  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);

  const toggleHighContrast = () => {
    setIsHighContrast((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vocalstudio_high_contrast', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const [pitchResult, setPitchResult] = useState<PitchDetectionResult>({
    frequency: 0,
    note: null,
    clarity: 0,
    volume: 0,
    isVoiced: false,
  });

  const [targetHz, setTargetHz] = useState<number>(0);
  const [keyResult, setKeyResult] = useState<KeyDetectionResult | null>(null);

  const [settings, setSettings] = useState<AutoTuneSettings>({
    enabled: true,
    strength: 100,
    retuneSpeedMs: 20,
    scaleType: 'major',
    keyRoot: 'C',
    autoKeyTracking: true,
    pitchRange: 'all',
    monitorVolume: 0.8,
    reverbAmount: 0.25,
  });

  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const recordingStartTimeRef = useRef<number>(0);

  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  // Setup callbacks on engine mount
  useEffect(() => {
    const engine = new AutoTuneEngine();
    engineRef.current = engine;

    engine.onPitchUpdate = (result, target) => {
      setPitchResult(result);
      setTargetHz(target);
    };

    engine.onKeyUpdate = (result) => {
      setKeyResult(result);
      // If auto-tracking is active and a confident key was found, sync settings state
      if (engine.getSettings().autoKeyTracking && result.estimatedKey && result.estimatedKey.confidence >= 55) {
        setSettings((prev) => ({
          ...prev,
          keyRoot: result.estimatedKey!.root,
          scaleType: result.estimatedKey!.mode,
        }));
      }
    };

    engine.onRecordingComplete = async (blob, url) => {
      setRecordedBlob(blob);
      setRecordedAudioUrl(url);
      setIsRecording(false);

      // Auto-save take to IndexedDB recording history
      try {
        const elapsed = recordingStartTimeRef.current
          ? Math.max(1, Math.round((Date.now() - recordingStartTimeRef.current) / 1000))
          : 5;
        const curSettings = engine.getSettings();
        await saveRecording({
          durationSeconds: elapsed,
          blob,
          keyRoot: curSettings.keyRoot,
          scaleType: curSettings.scaleType,
          strength: curSettings.strength,
          retuneSpeedMs: curSettings.retuneSpeedMs,
        });
        setHistoryRefreshKey((k) => k + 1);
      } catch (err) {
        console.warn('Error auto-saving recording to history manager:', err);
      }
    };

    return () => {
      engine.stop();
    };
  }, []);

  // Toggle live microphone audio stream
  const handleToggleAudio = async () => {
    setMicError(null);
    if (!engineRef.current) return;

    if (isAudioRunning) {
      engineRef.current.stop();
      setIsAudioRunning(false);
      setAnalyserNode(null);
      setPitchResult({
        frequency: 0,
        note: null,
        clarity: 0,
        volume: 0,
        isVoiced: false,
      });
    } else {
      const success = await engineRef.current.start();
      if (success) {
        setIsAudioRunning(true);
        setAnalyserNode(engineRef.current.getAnalyserNode());
        // Apply initial settings
        engineRef.current.updateSettings(settings);
      } else {
        setMicError(
          'No se pudo acceder al micrófono. Por favor, concede permisos de micrófono en el navegador.'
        );
      }
    }
  };

  // Update AutoTune settings
  const handleUpdateSettings = (newSettings: Partial<AutoTuneSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (engineRef.current) {
        engineRef.current.updateSettings(updated);
      }
      return updated;
    });
  };

  // Manual key update
  const handleUpdateKey = (root: NoteName, scaleType: ScaleType) => {
    handleUpdateSettings({ keyRoot: root, scaleType, autoKeyTracking: false });
  };

  // Toggle auto-tracking vs manual lock
  const handleToggleAutoTracking = (enabled: boolean) => {
    handleUpdateSettings({ autoKeyTracking: enabled });
  };

  // Reset accumulated singing frames
  const handleResetKeyAnalysis = () => {
    if (engineRef.current) {
      engineRef.current.resetKeyHistory();
    }
    setKeyResult(null);
  };

  // Drone reference playback
  const handlePlayReferenceChord = (root: NoteName, mode: 'major' | 'minor' | 'drone') => {
    if (engineRef.current) {
      engineRef.current.playReferenceChord(root, mode);
    }
  };

  const handleStopReferenceChord = () => {
    if (engineRef.current) {
      engineRef.current.stopReferenceChord();
    }
  };

  // Recording triggers
  const handleStartRecording = () => {
    if (engineRef.current) {
      const started = engineRef.current.startRecording();
      if (started) {
        recordingStartTimeRef.current = Date.now();
        setIsRecording(true);
      }
    }
  };

  const handleStopRecording = () => {
    if (engineRef.current) {
      engineRef.current.stopRecording();
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white transition-colors duration-200 ${
        isHighContrast ? 'bg-black text-white' : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Top Studio Navigation Bar */}
      <header
        className={`sticky top-0 z-40 w-full border-b backdrop-blur-md px-4 lg:px-8 py-3.5 transition-colors ${
          isHighContrast
            ? 'bg-black/95 border-cyan-400/60 shadow-lg shadow-cyan-500/10'
            : 'bg-slate-950/80 border-slate-800/80'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl text-white shadow-lg ${
                isHighContrast
                  ? 'bg-cyan-500 text-black shadow-cyan-400/30'
                  : 'bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-500/25'
              }`}
            >
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white font-sans">
                  VocalKey & AutoTune Studio
                </h1>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    isHighContrast
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-400'
                      : 'text-indigo-400 bg-indigo-950/70 border border-indigo-800/60'
                  }`}
                >
                  DSP Tiempo Real
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Detección inteligente de tonalidad y afinación de voz en vivo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* High Contrast Mode Toggle */}
            <button
              id="btn-toggle-contrast"
              onClick={toggleHighContrast}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                isHighContrast
                  ? 'bg-cyan-400 text-black border-cyan-300 shadow-md shadow-cyan-400/30 font-bold'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
              title="Activa el modo de alto contraste para cabina o entornos con poca luz"
            >
              <Contrast className={`w-3.5 h-3.5 ${isHighContrast ? 'text-black' : 'text-cyan-400'}`} />
              <span className="hidden sm:inline">
                {isHighContrast ? 'Alto Contraste: ON' : 'Alto Contraste'}
              </span>
            </button>

            {/* Audio Hardware & Latency Settings Button */}
            <button
              id="btn-open-audio-settings"
              onClick={() => setIsAudioSettingsOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors border ${
                isHighContrast
                  ? 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-500/50'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
              title="Configurar micrófono, altavoces y calibración de latencia de entrada"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Hardware & Latencia</span>
            </button>

            {/* Guide Button */}
            <button
              id="btn-open-guide"
              onClick={() => setIsGuideModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Guía</span>
            </button>

            {/* Python Script Tool Modal Button */}
            <button
              id="btn-open-python"
              onClick={() => setIsPythonModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 hover:border-amber-400 transition-colors shadow-sm"
              title="Abre la suite de scripts en Python: AutoTune con Librosa, Detección con Aubio y GUI Tkinter"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline">Python Studio</span>
            </button>

            {/* Main Microphone Button */}
            <button
              id="btn-toggle-mic"
              onClick={handleToggleAudio}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                isAudioRunning
                  ? isHighContrast
                    ? 'bg-emerald-400 text-black shadow-emerald-400/40 animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 animate-pulse'
                  : isHighContrast
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-400/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
            >
              {isAudioRunning ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Micrófono Activo</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Iniciar Micrófono</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Error notification if mic blocked */}
        {micError && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="flex-1">{micError}</div>
          </div>
        )}

        {/* Inactive Microphone Prompt Card */}
        {!isAudioRunning && (
          <div className="rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-800/40 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 border border-indigo-800/50 px-3 py-1 rounded-full mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Afinador & Detector de Escala en Tiempo Real
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Canta, detecta tu tonalidad y suena afinado al instante
              </h2>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                Pulsa en <strong>&ldquo;Iniciar Micrófono&rdquo;</strong> y canta o tararea libremente. La aplicación medirá la frecuencia de tu voz, descubrirá la escala y tonalidad musical que mejor encaja con lo que estás cantando y aplicará AutoTune en tiempo real para que tu voz suene siempre en el tono perfecto.
              </p>
              <div className="flex items-center gap-2 text-xs text-amber-300/90 mt-3">
                <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Consejo: Usa auriculares para escuchar tu voz en directo sin acoples.</span>
              </div>
            </div>

            <button
              onClick={handleToggleAudio}
              className="shrink-0 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/40 transition-all flex items-center gap-2.5 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Mic className="w-5 h-5" />
              Activar Micrófono
            </button>
          </div>
        )}

        {/* Studio Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Visual Tuner, Real-Time FFT Spectrum & Piano Roll Pitch Ribbon (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <PitchTunerDial
              pitchResult={pitchResult}
              targetHz={targetHz}
              isAutoTuneEnabled={settings.enabled}
              isHighContrast={isHighContrast}
            />

            <FrequencySpectrumVisualizer
              analyserNode={analyserNode}
              isAudioRunning={isAudioRunning}
              pitchResult={pitchResult}
              targetHz={targetHz}
              isHighContrast={isHighContrast}
            />

            <PitchRibbonCanvas
              pitchResult={pitchResult}
              targetHz={targetHz}
              isAutoTuneEnabled={settings.enabled}
              activeKeyRoot={settings.keyRoot}
              activeScaleType={settings.scaleType}
              isHighContrast={isHighContrast}
            />
          </div>

          {/* Right Column: Key Detection & AutoTune Controls (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <KeyDetectorCard
              keyResult={keyResult}
              activeKeyRoot={settings.keyRoot}
              activeScaleType={settings.scaleType}
              autoKeyTracking={settings.autoKeyTracking}
              onUpdateKey={handleUpdateKey}
              onToggleAutoTracking={handleToggleAutoTracking}
              onResetKeyAnalysis={handleResetKeyAnalysis}
              onPlayReferenceChord={handlePlayReferenceChord}
              onStopReferenceChord={handleStopReferenceChord}
              isHighContrast={isHighContrast}
            />

            <AutoTuneControls
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              isAudioRunning={isAudioRunning}
              isHighContrast={isHighContrast}
              onOpenAudioSettings={() => setIsAudioSettingsOpen(true)}
            />
          </div>
        </div>

        {/* Bottom Full-Width: Recording Session & Backing Track */}
        <AudioRecorderPlayer
          isRecording={isRecording}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          recordedAudioUrl={recordedAudioUrl}
          recordedBlob={recordedBlob}
          isAudioEngineRunning={isAudioRunning}
        />

        {/* Recording History & Takes Manager */}
        <RecordingHistoryManager refreshTrigger={historyRefreshKey} />

        {/* Python Suite Quick Access Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/70 border border-slate-800 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <FileCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Suite en Python: GUI Tkinter, Aubio Real-Time y AutoTune Librosa
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  3 Módulos
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Función de autotune con velocidad e intensidad ajustables, analizador de tono en vivo con nota/cents, y app de escritorio completa.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsPythonModalOpen(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs transition-colors shadow-sm"
          >
            <FileCode className="w-4 h-4 text-amber-400" />
            <span>Abrir Python Studio & Descargar</span>
          </button>
        </div>
      </main>

      {/* Modals */}
      <AudioSettingsModal
        isOpen={isAudioSettingsOpen}
        onClose={() => setIsAudioSettingsOpen(false)}
        engine={engineRef.current}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        isHighContrast={isHighContrast}
      />

      <PythonScriptModal
        isOpen={isPythonModalOpen}
        onClose={() => setIsPythonModalOpen(false)}
      />

      <VocalGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-400">
        VocalKey & AutoTune Studio &bull; Detección de Tonalidad Krumhansl-Schmuckler &bull; Corrección de Tono en Tiempo Real &bull; Web Audio API
      </footer>
    </div>
  );
}
