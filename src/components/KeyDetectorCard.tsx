import React, { useState } from 'react';
import { KeyDetectionResult, NoteName, ScaleType } from '../types';
import {
  NOTE_NAMES,
  NOTE_NAMES_SPANISH,
  SCALE_LABELS,
  getScaleNotes,
} from '../audio/musicTheory';
import {
  Compass,
  Lock,
  Music,
  Play,
  RotateCcw,
  Sparkles,
  Unlock,
  Volume2,
} from 'lucide-react';

interface KeyDetectorCardProps {
  keyResult: KeyDetectionResult | null;
  activeKeyRoot: NoteName;
  activeScaleType: ScaleType;
  autoKeyTracking: boolean;
  onUpdateKey: (root: NoteName, scaleType: ScaleType) => void;
  onToggleAutoTracking: (enabled: boolean) => void;
  onResetKeyAnalysis: () => void;
  onPlayReferenceChord: (root: NoteName, mode: 'major' | 'minor' | 'drone') => void;
  onStopReferenceChord: () => void;
  isHighContrast?: boolean;
}

export const KeyDetectorCard: React.FC<KeyDetectorCardProps> = ({
  keyResult,
  activeKeyRoot,
  activeScaleType,
  autoKeyTracking,
  onUpdateKey,
  onToggleAutoTracking,
  onResetKeyAnalysis,
  onPlayReferenceChord,
  onStopReferenceChord,
  isHighContrast = false,
}) => {
  const [isPlayingReference, setIsPlayingReference] = useState(false);
  const estimated = keyResult?.estimatedKey;
  const chroma = keyResult?.chromaProfile || new Array(12).fill(0);
  const scaleNotes = getScaleNotes(activeKeyRoot, activeScaleType);

  const handleToggleReference = () => {
    if (isPlayingReference) {
      onStopReferenceChord();
      setIsPlayingReference(false);
    } else {
      const mode = activeScaleType === 'minor' ? 'minor' : 'major';
      onPlayReferenceChord(activeKeyRoot, mode);
      setIsPlayingReference(true);
    }
  };

  return (
    <div
      id="key-detector-card"
      className={`flex flex-col rounded-2xl p-6 backdrop-blur-md shadow-xl justify-between gap-5 transition-all ${
        isHighContrast
          ? 'bg-black border-2 border-cyan-400 text-white shadow-cyan-500/20'
          : 'bg-slate-900/90 border border-slate-800'
      }`}
    >
      {/* Header with Title and Reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-1.5">
              Detector de Tonalidad
              {autoKeyTracking && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-2.5 h-2.5" /> En Vivo
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Analiza las notas de tu voz para determinar la escala musical exacta
            </p>
          </div>
        </div>

        {/* Reset Analysis Button */}
        <button
          id="btn-reset-key-analysis"
          onClick={onResetKeyAnalysis}
          title="Reiniciar historial de notas cantadas"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Detected Key Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-900/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-indigo-400 font-semibold block mb-0.5">
              Tonalidad Activa
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {NOTE_NAMES_SPANISH[activeKeyRoot]}
              </span>
              <span className="text-lg font-semibold text-indigo-300">
                {SCALE_LABELS[activeScaleType] || activeScaleType}
              </span>
            </div>
          </div>

          {/* Reference Audio Drone Button */}
          <button
            id="btn-play-reference-chord"
            onClick={handleToggleReference}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
              isPlayingReference
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {isPlayingReference ? (
              <>
                <Volume2 className="w-4 h-4 text-amber-400" />
                Detener Acorde
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Escuchar Tono
              </>
            )}
          </button>
        </div>

        {/* Scale notes badges */}
        <div className="mt-3 pt-3 border-t border-slate-800/80">
          <span className="text-[11px] text-slate-400 block mb-1.5">
            Notas permitidas en esta escala (afinación sin desafinar):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {scaleNotes.map((note) => {
              const isRoot = note === activeKeyRoot;
              return (
                <span
                  key={note}
                  className={`px-2 py-0.5 rounded-md text-xs font-mono font-semibold ${
                    isRoot
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/50'
                      : 'bg-slate-800/80 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  {NOTE_NAMES_SPANISH[note]}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* 12-Chroma Pitch Distribution Visualization */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Distribución cromática de tu voz:</span>
          <span className="font-mono text-[11px]">
            {keyResult ? `${keyResult.totalVoicedFrames} muestras` : '0 muestras'}
          </span>
        </div>

        <div className="grid grid-cols-12 gap-1 h-14 items-end bg-slate-950/60 p-2 rounded-xl border border-slate-800/70">
          {NOTE_NAMES.map((name, idx) => {
            const weight = chroma[idx] || 0;
            const inScale = scaleNotes.includes(name);
            const isRoot = name === activeKeyRoot;

            return (
              <div
                key={name}
                className="flex flex-col items-center h-full justify-end group relative"
                title={`${NOTE_NAMES_SPANISH[name]}: ${Math.round(weight * 100)}%`}
              >
                {/* Bar */}
                <div
                  className={`w-full rounded-t-sm transition-all duration-150 ${
                    isRoot
                      ? 'bg-indigo-500'
                      : inScale
                      ? 'bg-sky-400'
                      : 'bg-slate-700'
                  }`}
                  style={{ height: `${Math.max(4, weight * 100)}%` }}
                />
                {/* Label */}
                <span
                  className={`text-[9px] mt-1 font-mono leading-none ${
                    inScale ? 'text-slate-200 font-bold' : 'text-slate-500'
                  }`}
                >
                  {name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alternative key candidates (if confidence is building) */}
      {estimated && (
        <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/60">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400">Confianza de detección:</span>
            <span className="font-mono font-bold text-emerald-400">
              {estimated.confidence}%
            </span>
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-300"
              style={{ width: `${estimated.confidence}%` }}
            />
          </div>

          {keyResult && keyResult.alternatives.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
              <span className="shrink-0">Otras opciones:</span>
              <div className="flex flex-wrap gap-1.5">
                {keyResult.alternatives.map((alt) => (
                  <button
                    key={`${alt.root}-${alt.mode}`}
                    onClick={() => onUpdateKey(alt.root, alt.mode)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-[10px] font-mono border border-slate-700/60"
                  >
                    {alt.nameSpanish} ({alt.confidence}%)
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Selection & Auto Tracking Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800">
        {/* Toggle Auto Tracking vs Lock Key */}
        <button
          id="btn-toggle-auto-tracking"
          onClick={() => onToggleAutoTracking(!autoKeyTracking)}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
            autoKeyTracking
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}
        >
          {autoKeyTracking ? (
            <>
              <Unlock className="w-3.5 h-3.5" /> Auto-Detección
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" /> Fijada Manual
            </>
          )}
        </button>

        {/* Root note selector */}
        <div className="relative">
          <select
            id="select-key-root"
            value={activeKeyRoot}
            onChange={(e) => {
              onToggleAutoTracking(false);
              onUpdateKey(e.target.value as NoteName, activeScaleType);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          >
            {NOTE_NAMES.map((name) => (
              <option key={name} value={name}>
                Tónica: {name} ({NOTE_NAMES_SPANISH[name]})
              </option>
            ))}
          </select>
        </div>

        {/* Scale type selector */}
        <div className="relative">
          <select
            id="select-scale-type"
            value={activeScaleType}
            onChange={(e) => {
              onToggleAutoTracking(false);
              onUpdateKey(activeKeyRoot, e.target.value as ScaleType);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="major">Mayor Natural</option>
            <option value="minor">Menor Natural</option>
            <option value="harmonic_minor">Menor Armónica</option>
            <option value="pentatonic_major">Pentatónica Mayor</option>
            <option value="pentatonic_minor">Pentatónica Menor</option>
            <option value="blues">Escala Blues</option>
            <option value="dorian">Modo Dórico</option>
            <option value="mixolydian">Modo Mixolidio</option>
            <option value="chromatic">Cromática (Sin filtro)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
