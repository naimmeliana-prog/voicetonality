import React, { useEffect, useState } from 'react';
import {
  AudioDeviceOption,
  AutoTuneSettings,
  LatencySettings,
} from '../types';
import { AutoTuneEngine } from '../audio/autoTuneEngine';
import {
  Check,
  CheckCircle2,
  Headphones,
  Mic,
  RefreshCw,
  Sliders,
  Timer,
  Volume2,
  Waves,
  X,
  Zap,
} from 'lucide-react';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: AutoTuneEngine | null;
  settings: AutoTuneSettings;
  onUpdateSettings: (newSettings: Partial<AutoTuneSettings>) => void;
  isAudioRunning: boolean;
  isHighContrast?: boolean;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  isOpen,
  onClose,
  engine,
  settings,
  onUpdateSettings,
  isAudioRunning,
  isHighContrast = false,
}) => {
  const [inputDevices, setInputDevices] = useState<AudioDeviceOption[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDeviceOption[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>(settings.inputDeviceId || '');
  const [selectedOutput, setSelectedOutput] = useState<string>(settings.outputDeviceId || '');
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);
  const [supportsOutputSelection, setSupportsOutputSelection] = useState(true);

  // Latency calibration state
  const [bufferSize, setBufferSize] = useState<256 | 512 | 1024>(
    settings.latency?.bufferSize || 512
  );
  const [compensationMs, setCompensationMs] = useState<number>(
    settings.latency?.compensationMs || 0
  );
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [lastMeasuredMs, setLastMeasuredMs] = useState<number | null>(null);
  const [isPlayingTestTone, setIsPlayingTestTone] = useState(false);

  // Load available devices
  const loadDevices = async () => {
    setIsRefreshingDevices(true);
    try {
      const { inputs, outputs } = await AutoTuneEngine.getAvailableDevices();
      setInputDevices(inputs);
      setOutputDevices(outputs);

      if (!selectedInput && inputs.length > 0) {
        setSelectedInput(inputs[0].deviceId);
      }
      if (!selectedOutput && outputs.length > 0) {
        setSelectedOutput(outputs[0].deviceId);
      }
    } catch (e) {
      console.warn('Error loading audio devices:', e);
    } finally {
      setIsRefreshingDevices(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDevices();
      // Check if setSinkId is supported in AudioContext
      const ctx = engine?.getAudioContext();
      if (ctx && !('setSinkId' in ctx)) {
        setSupportsOutputSelection(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectInput = async (deviceId: string) => {
    setSelectedInput(deviceId);
    onUpdateSettings({ inputDeviceId: deviceId });
    if (engine) {
      await engine.setInputDevice(deviceId);
    }
  };

  const handleSelectOutput = async (deviceId: string) => {
    setSelectedOutput(deviceId);
    onUpdateSettings({ outputDeviceId: deviceId });
    if (engine) {
      await engine.setOutputDevice(deviceId);
    }
  };

  const handleBufferSizeChange = (size: 256 | 512 | 1024) => {
    setBufferSize(size);
    onUpdateSettings({
      latency: {
        ...settings.latency,
        bufferSize: size,
      },
    });
  };

  const handleCompensationChange = (val: number) => {
    setCompensationMs(val);
    onUpdateSettings({
      latency: {
        ...settings.latency,
        compensationMs: val,
      },
    });
  };

  const handleRunLatencyTest = async () => {
    if (!engine || !isAudioRunning) return;
    setIsMeasuring(true);
    try {
      const measured = await engine.measureLoopbackLatency();
      setLastMeasuredMs(measured);
    } catch (e) {
      console.warn('Measurement failed:', e);
    } finally {
      setIsMeasuring(false);
    }
  };

  const handlePlayTestTone = () => {
    const ctx = engine?.getAudioContext();
    if (!ctx) return;
    setIsPlayingTestTone(true);
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);

      setTimeout(() => setIsPlayingTestTone(false), 450);
    } catch {
      setIsPlayingTestTone(false);
    }
  };

  // Theoretical buffer latency in milliseconds (sampleRate = 44100 approx)
  const theoreticalLatencyMs = Math.round((bufferSize / 44100) * 1000 * 10) / 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7 shadow-2xl transition-all ${
          isHighContrast
            ? 'bg-black border-2 border-cyan-400 text-white shadow-cyan-500/20'
            : 'bg-slate-900 border border-slate-800 text-slate-100 shadow-slate-950/60'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl ${
                isHighContrast
                  ? 'bg-cyan-400 text-black'
                  : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              }`}
            >
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                Ajustes de Audio & Latencia
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${
                    isAudioRunning
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isAudioRunning ? 'Motor Activo' : 'Motor en Pausa'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Selección de hardware I/O y calibración de sincronización vocal
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="mt-6 space-y-6 text-sm">
          {/* Section 1: Device Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-2">
                Dispositivos de Entrada & Salida
              </h3>
              <button
                onClick={loadDevices}
                disabled={isRefreshingDevices}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                title="Volver a escanear dispositivos conectados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingDevices ? 'animate-spin' : ''}`} />
                <span>Actualizar lista</span>
              </button>
            </div>

            {/* Input Device (Microphone) */}
            <div
              className={`p-4 rounded-2xl border ${
                isHighContrast
                  ? 'bg-black border-slate-700'
                  : 'bg-slate-950/60 border-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  <span>Micrófono de Entrada (Audio In)</span>
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  {inputDevices.length} disponibles
                </span>
              </div>

              <select
                id="select-audio-input-device"
                value={selectedInput}
                onChange={(e) => handleSelectInput(e.target.value)}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-medium focus:outline-none transition-colors ${
                  isHighContrast
                    ? 'bg-slate-900 text-white border-2 border-cyan-400 focus:border-cyan-300'
                    : 'bg-slate-900 text-slate-200 border border-slate-700 focus:border-indigo-500'
                }`}
              >
                {inputDevices.length === 0 ? (
                  <option value="">Predeterminado del sistema</option>
                ) : (
                  inputDevices.map((dev) => (
                    <option key={dev.deviceId} value={dev.deviceId}>
                      {dev.label || `Dispositivo de entrada (${dev.deviceId.slice(0, 8)}...)`}
                    </option>
                  ))
                )}
              </select>
              <p className="text-[11px] text-slate-400 mt-2">
                Selecciona tu interfaz de audio USB, micrófono de condensador o auricular con micro.
              </p>
            </div>

            {/* Output Device (Speakers / Headphones) */}
            <div
              className={`p-4 rounded-2xl border ${
                isHighContrast
                  ? 'bg-black border-slate-700'
                  : 'bg-slate-950/60 border-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-indigo-400" />
                  <span>Salida de Monitorización (Auriculares / Altavoces)</span>
                </label>
                <button
                  type="button"
                  onClick={handlePlayTestTone}
                  disabled={!isAudioRunning}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    isAudioRunning
                      ? 'bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                  title="Reproduce un tono de prueba a través de los auriculares"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>{isPlayingTestTone ? 'Sonando...' : 'Probar salida'}</span>
                </button>
              </div>

              <select
                id="select-audio-output-device"
                value={selectedOutput}
                onChange={(e) => handleSelectOutput(e.target.value)}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-medium focus:outline-none transition-colors ${
                  isHighContrast
                    ? 'bg-slate-900 text-white border-2 border-cyan-400 focus:border-cyan-300'
                    : 'bg-slate-900 text-slate-200 border border-slate-700 focus:border-indigo-500'
                }`}
              >
                {outputDevices.length === 0 ? (
                  <option value="">Predeterminado del sistema / Auriculares</option>
                ) : (
                  outputDevices.map((dev) => (
                    <option key={dev.deviceId} value={dev.deviceId}>
                      {dev.label || `Dispositivo de salida (${dev.deviceId.slice(0, 8)}...)`}
                    </option>
                  ))
                )}
              </select>

              {!supportsOutputSelection && (
                <p className="text-[11px] text-amber-400/90 mt-2">
                  ℹ️ Tu navegador utiliza la salida de audio predeterminada del sistema.
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Input Latency Calibration & Buffer Adjustment */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div>
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-2">
                <Timer className="w-3.5 h-3.5 text-amber-400" />
                Calibración de Latencia y Búfer DSP
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Optimiza la respuesta en vivo entre tu voz física y la señal procesada para eliminar desfases perceptibles.
              </p>
            </div>

            {/* Buffer Size Selector */}
            <div
              className={`p-4 rounded-2xl border ${
                isHighContrast
                  ? 'bg-black border-slate-700'
                  : 'bg-slate-950/60 border-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">
                  Tamaño de Búfer de Audio (Buffer Size)
                </span>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  ~{theoreticalLatencyMs} ms latencia de cálculo
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    size: 256 as const,
                    label: '256 samples',
                    ms: '~5.8 ms',
                    desc: 'Baja latencia extrema (CPU rápida)',
                  },
                  {
                    size: 512 as const,
                    label: '512 samples',
                    ms: '~11.6 ms',
                    desc: 'Estándar balanceado estudio',
                  },
                  {
                    size: 1024 as const,
                    label: '1024 samples',
                    ms: '~23.2 ms',
                    desc: 'Modo seguro sin chasquidos',
                  },
                ].map((b) => {
                  const isSelected = bufferSize === b.size;
                  return (
                    <button
                      key={b.size}
                      type="button"
                      onClick={() => handleBufferSizeChange(b.size)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? isHighContrast
                            ? 'border-2 border-cyan-400 bg-cyan-950/50 text-white shadow-lg'
                            : 'border-indigo-500 bg-indigo-600/20 text-white shadow-md'
                          : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-xs font-bold">
                        <span>{b.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </div>
                      <span className="text-[11px] block font-mono text-cyan-400 mt-0.5">
                        {b.ms}
                      </span>
                      <span className="text-[10px] block text-slate-400 mt-1 leading-tight">
                        {b.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual Latency Delay Compensation Slider */}
            <div
              className={`p-4 rounded-2xl border ${
                isHighContrast
                  ? 'bg-black border-slate-700'
                  : 'bg-slate-950/60 border-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Waves className="w-4 h-4 text-emerald-400" />
                  Compensación de Latencia de Monitor (Offset)
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {compensationMs} ms
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Alinea los milisegundos de retraso añadidos por auriculares inalámbricos o buffers de hardware.
              </p>

              <input
                id="slider-latency-compensation"
                type="range"
                min={0}
                max={150}
                step={2}
                value={compensationMs}
                onChange={(e) => handleCompensationChange(parseInt(e.target.value, 10))}
                className={`w-full ${
                  isHighContrast ? 'h-3' : 'h-2'
                } bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400`}
              />

              {/* Quick latency presets */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-slate-800/60 text-[11px]">
                <span className="text-slate-500 font-medium">Ajustes rápidos:</span>
                <button
                  type="button"
                  onClick={() => handleCompensationChange(0)}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                >
                  Directo / Cable (0 ms)
                </button>
                <button
                  type="button"
                  onClick={() => handleCompensationChange(16)}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                >
                  Monitores USB (16 ms)
                </button>
                <button
                  type="button"
                  onClick={() => handleCompensationChange(65)}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                >
                  Bluetooth / TWS (65 ms)
                </button>
              </div>
            </div>

            {/* Loopback Latency Measurement Tool */}
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                isHighContrast
                  ? 'bg-black border-slate-700'
                  : 'bg-slate-950/60 border-slate-800/80'
              }`}
            >
              <div>
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Prueba de Latencia de Ida y Vuelta (Loopback)
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Emite un pulso sonoro acústico de 1.4 kHz para medir el retraso total de hardware.
                </p>
                {lastMeasuredMs !== null && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Última medición:</span>
                    <span className="font-mono font-bold text-amber-400">
                      ~{lastMeasuredMs} ms
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCompensationChange(lastMeasuredMs)}
                      className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                    >
                      Aplicar como compensación
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleRunLatencyTest}
                disabled={!isAudioRunning || isMeasuring}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  !isAudioRunning
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : isHighContrast
                    ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-lg'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                }`}
              >
                {isMeasuring ? 'Midiendo...' : 'Medir Latencia'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Configuración guardada en tiempo real
          </span>

          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              isHighContrast
                ? 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-lg shadow-cyan-400/20'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25'
            }`}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
