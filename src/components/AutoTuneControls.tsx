import React from 'react';
import { AutoTuneSettings } from '../types';
import { AUTOTUNE_PRESETS } from '../data/presets';
import {
  Activity,
  Bot,
  Feather,
  Flame,
  Gauge,
  Headphones,
  Mic,
  Radio,
  Sliders,
  Sparkles,
  Timer,
  Waves,
  Zap,
} from 'lucide-react';

interface AutoTuneControlsProps {
  settings: AutoTuneSettings;
  onUpdateSettings: (newSettings: Partial<AutoTuneSettings>) => void;
  isAudioRunning: boolean;
  onOpenAudioSettings?: () => void;
  isHighContrast?: boolean;
}

export const AutoTuneControls: React.FC<AutoTuneControlsProps> = ({
  settings,
  onUpdateSettings,
  isAudioRunning,
  onOpenAudioSettings,
  isHighContrast = false,
}) => {
  const getSpeedLabel = (speed: number) => {
    if (speed === 0) return '0 ms (Robótico / Trap / T-Pain)';
    if (speed <= 25) return `${speed} ms (Pop Moderno / Rápido)`;
    if (speed <= 70) return `${speed} ms (Afinación Natural)`;
    return `${speed} ms (Sutil / Transparente)`;
  };

  // Detect which preset matches current settings
  const matchedPreset = AUTOTUNE_PRESETS.find(
    (p) =>
      p.settings.retuneSpeedMs === settings.retuneSpeedMs &&
      p.settings.strength === settings.strength
  );

  const getPresetIcon = (iconName: string) => {
    switch (iconName) {
      case 'bot':
        return <Bot className="w-3.5 h-3.5" />;
      case 'feather':
        return <Feather className="w-3.5 h-3.5" />;
      case 'sparkles':
        return <Sparkles className="w-3.5 h-3.5" />;
      case 'zap':
        return <Zap className="w-3.5 h-3.5" />;
      case 'activity':
        return <Activity className="w-3.5 h-3.5" />;
      case 'flame':
        return <Flame className="w-3.5 h-3.5" />;
      default:
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  const handleSelectPreset = (presetId: string) => {
    const preset = AUTOTUNE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onUpdateSettings({
      retuneSpeedMs: preset.settings.retuneSpeedMs,
      strength: preset.settings.strength,
      ...(preset.settings.reverbAmount !== undefined
        ? { reverbAmount: preset.settings.reverbAmount }
        : {}),
    });
  };

  return (
    <div
      id="autotune-controls-card"
      className={`flex flex-col rounded-2xl p-6 backdrop-blur-md shadow-xl justify-between gap-5 transition-all ${
        isHighContrast
          ? 'bg-black border-2 border-cyan-400 text-white shadow-cyan-500/20'
          : 'bg-slate-900/90 border border-slate-800'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Procesador AutoTune
              {settings.enabled && (
                <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded-full">
                  Activo
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Ajusta la velocidad y fuerza de afinación en tiempo real
            </p>
          </div>
        </div>

        {/* Big On/Off Toggle */}
        <button
          id="btn-toggle-autotune"
          onClick={() => onUpdateSettings({ enabled: !settings.enabled })}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
            settings.enabled
              ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${settings.enabled ? 'fill-current' : ''}`} />
          {settings.enabled ? 'AutoTune ON' : 'AutoTune OFF'}
        </button>
      </div>

      {/* Presets Quick-Selector Section */}
      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/70 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Presets de AutoTune:</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Modo:{' '}
            <strong className="text-amber-300">
              {matchedPreset ? matchedPreset.name : 'Personalizado'}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {AUTOTUNE_PRESETS.map((preset) => {
            const isSelected = matchedPreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                id={`preset-${preset.id}`}
                onClick={() => handleSelectPreset(preset.id)}
                title={`${preset.tagline}: ${preset.description}`}
                className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-500/20 ring-1 ring-purple-500'
                    : 'bg-slate-900 hover:bg-slate-800/80 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <div
                  className={`mb-1 p-1 rounded-lg ${
                    isSelected
                      ? 'text-purple-300 bg-purple-500/20'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {getPresetIcon(preset.iconName)}
                </div>
                <span className="text-[11px] font-bold leading-none">{preset.name}</span>
                <span className="text-[9px] text-slate-500 mt-1 font-mono">
                  {preset.settings.retuneSpeedMs}ms • {preset.settings.strength}%
                </span>
              </button>
            );
          })}
        </div>

        {matchedPreset && (
          <p className="text-[10px] text-slate-400 italic">
            💡 {matchedPreset.description}
          </p>
        )}
      </div>

      {/* Control Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Retune Speed (Velocidad de corrección) */}
        <div className="bg-slate-950/50 rounded-xl p-3.5 border border-slate-800/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-purple-400" /> Velocidad (Retune Speed)
            </span>
            <span className="text-[11px] font-mono text-purple-400 font-bold">
              {settings.retuneSpeedMs} ms
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mb-2">
            {getSpeedLabel(settings.retuneSpeedMs)}
          </span>

          <input
            id="slider-retune-speed"
            type="range"
            min={0}
            max={120}
            step={5}
            value={settings.retuneSpeedMs}
            onChange={(e) =>
              onUpdateSettings({ retuneSpeedMs: parseInt(e.target.value, 10) })
            }
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />

          {/* Quick presets */}
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <button
              onClick={() => onUpdateSettings({ retuneSpeedMs: 0 })}
              className="hover:text-purple-400 transition-colors"
            >
              Trap (0ms)
            </button>
            <button
              onClick={() => onUpdateSettings({ retuneSpeedMs: 25 })}
              className="hover:text-purple-400 transition-colors"
            >
              Pop (25ms)
            </button>
            <button
              onClick={() => onUpdateSettings({ retuneSpeedMs: 65 })}
              className="hover:text-purple-400 transition-colors"
            >
              Natural (65ms)
            </button>
          </div>
        </div>

        {/* Correction Strength (Intensidad) */}
        <div className="bg-slate-950/50 rounded-xl p-3.5 border border-slate-800/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Fuerza de Corrección
            </span>
            <span className="text-[11px] font-mono text-cyan-400 font-bold">
              {settings.strength}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mb-2">
            {settings.strength === 100
              ? 'Afinación 100% estricta a la escala'
              : 'Mezcla suave entre voz original y afinada'}
          </span>

          <input
            id="slider-correction-strength"
            type="range"
            min={0}
            max={100}
            step={5}
            value={settings.strength}
            onChange={(e) =>
              onUpdateSettings({ strength: parseInt(e.target.value, 10) })
            }
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />

          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <span>0% (Dry)</span>
            <span>50% (Semi)</span>
            <span>100% (Full Wet)</span>
          </div>
        </div>
      </div>

      {/* Vocal Dynamics Compressor Section (Dynamic leveling before pitch correction) */}
      <div
        id="vocal-compressor-section"
        className={`p-4 rounded-2xl border transition-all ${
          isHighContrast
            ? 'bg-black border-2 border-amber-400 text-white shadow-amber-500/10'
            : 'bg-slate-950/40 border-slate-800/80'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg ${
                isHighContrast
                  ? 'bg-amber-400 text-black'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide">
                  Compresor Vocal (Leveler)
                </span>
                {settings.compressor?.enabled ? (
                  <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/50 px-1.5 py-0.2 rounded">
                    Activo
                  </span>
                ) : (
                  <span className="text-[9px] uppercase font-bold text-slate-500 bg-slate-800/60 px-1.5 py-0.2 rounded">
                    Bypass
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                Nivela la dinámica y picos de voz antes del AutoTune
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                compressor: {
                  ...settings.compressor,
                  enabled: !settings.compressor?.enabled,
                },
              })
            }
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
              settings.compressor?.enabled
                ? isHighContrast
                  ? 'bg-amber-400 text-black shadow-md'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {settings.compressor?.enabled ? 'BYPASS' : 'ACTIVAR'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Threshold Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Umbral (Threshold)</span>
              <span className="font-mono font-bold text-amber-400">
                {settings.compressor?.threshold ?? -24} dB
              </span>
            </div>
            <input
              id="slider-compressor-threshold"
              type="range"
              min={-50}
              max={0}
              step={1}
              value={settings.compressor?.threshold ?? -24}
              disabled={!settings.compressor?.enabled}
              onChange={(e) =>
                onUpdateSettings({
                  compressor: {
                    ...settings.compressor,
                    threshold: parseInt(e.target.value, 10),
                  },
                })
              }
              className={`w-full ${
                isHighContrast ? 'h-3' : 'h-1.5'
              } bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 disabled:opacity-40`}
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-50 dB (Fuerte)</span>
              <span>-24 dB (Óptimo)</span>
              <span>0 dB (Off)</span>
            </div>
          </div>

          {/* Ratio Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Ratio de Compresión</span>
              <span className="font-mono font-bold text-amber-400">
                {settings.compressor?.ratio ?? 4}:1
              </span>
            </div>
            <input
              id="slider-compressor-ratio"
              type="range"
              min={1}
              max={16}
              step={0.5}
              value={settings.compressor?.ratio ?? 4}
              disabled={!settings.compressor?.enabled}
              onChange={(e) =>
                onUpdateSettings({
                  compressor: {
                    ...settings.compressor,
                    ratio: parseFloat(e.target.value),
                  },
                })
              }
              className={`w-full ${
                isHighContrast ? 'h-3' : 'h-1.5'
              } bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 disabled:opacity-40`}
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1:1 (Directo)</span>
              <span>4:1 (Voz Pop)</span>
              <span>16:1 (Limitador)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Monitoring & Reverb Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
        {/* Monitor Volume (Headphones) */}
        <div className="flex flex-col justify-between bg-slate-950/30 p-3 rounded-xl border border-slate-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-emerald-400" /> Monitor de Voz
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              {Math.round(settings.monitorVolume * 100)}%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mb-2">
            ⚠️ <strong>Usa auriculares</strong> para escuchar tu voz afinada sin que el micrófono recoja el sonido de los altavoces.
          </p>

          <input
            id="slider-monitor-volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.monitorVolume}
            onChange={(e) =>
              onUpdateSettings({ monitorVolume: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
        </div>

        {/* Studio Reverb / Space */}
        <div className="flex flex-col justify-between bg-slate-950/30 p-3 rounded-xl border border-slate-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-indigo-400" /> Reverberación de Estudio
            </span>
            <span className="text-[11px] font-mono text-indigo-400 font-bold">
              {Math.round(settings.reverbAmount * 100)}%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mb-2">
            Añade espacialidad acústica para cantar con mayor comodidad y confianza.
          </p>

          <input
            id="slider-reverb-amount"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.reverbAmount}
            onChange={(e) =>
              onUpdateSettings({ reverbAmount: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
        </div>
      </div>

      {/* Vocal Range Filter */}
      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
        <span className="text-slate-400 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-slate-400" /> Rango Vocal:
        </span>
        <div className="flex gap-1">
          {(['all', 'soprano', 'alto', 'tenor', 'bass'] as const).map((rng) => {
            const labels: Record<string, string> = {
              all: 'Completo',
              soprano: 'Soprano',
              alto: 'Alto',
              tenor: 'Tenor',
              bass: 'Bajo',
            };
            const isSelected = settings.pitchRange === rng;
            return (
              <button
                key={rng}
                onClick={() => onUpdateSettings({ pitchRange: rng })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  isSelected
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {labels[rng]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hardware Devices & Latency Trigger Button */}
      {onOpenAudioSettings && (
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[11px]">
              {settings.inputDeviceId ? 'Micro seleccionado' : 'Micro por defecto'}
            </span>
            <span className="text-slate-600">•</span>
            <Timer className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-[11px]">
              Búfer: {settings.latency?.bufferSize || 512} smp
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenAudioSettings}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              isHighContrast
                ? 'bg-cyan-400 text-black hover:bg-cyan-300 shadow-md shadow-cyan-400/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Ajustes de Audio & Latencia</span>
          </button>
        </div>
      )}
    </div>
  );
};
