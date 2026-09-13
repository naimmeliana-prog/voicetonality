import React from 'react';
import { PitchDetectionResult } from '../types';
import { CheckCircle2, Mic, Volume2 } from 'lucide-react';

interface PitchTunerDialProps {
  pitchResult: PitchDetectionResult;
  targetHz: number;
  isAutoTuneEnabled: boolean;
  isHighContrast?: boolean;
}

export const PitchTunerDial: React.FC<PitchTunerDialProps> = ({
  pitchResult,
  targetHz,
  isAutoTuneEnabled,
  isHighContrast = false,
}) => {
  const { isVoiced, note, frequency, clarity, volume } = pitchResult;
  const cents = note ? note.cents : 0;
  const isCloseInTune = Math.abs(cents) <= 8;

  // Gauge needle rotation (-50 cents = -45deg, +50 cents = +45deg)
  const needleRotation = Math.max(-48, Math.min(48, (cents / 50) * 45));

  return (
    <div
      id="pitch-tuner-card"
      className={`relative flex flex-col items-center justify-between rounded-2xl p-6 backdrop-blur-md shadow-xl overflow-hidden transition-all ${
        isHighContrast
          ? 'bg-black border-2 border-cyan-400 text-white shadow-cyan-500/20'
          : 'bg-slate-900/90 border border-slate-800'
      }`}
    >
      {/* Top status bar */}
      <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              isVoiced
                ? isHighContrast
                  ? 'bg-emerald-300 shadow-[0_0_10px_#10b981] animate-pulse'
                  : 'bg-emerald-400 animate-pulse'
                : 'bg-slate-600'
            }`}
          />
          <span
            className={`font-mono uppercase tracking-wider font-bold ${
              isHighContrast && isVoiced ? 'text-emerald-300' : ''
            }`}
          >
            {isVoiced ? 'Voz Detectada' : 'Esperando Voz...'}
          </span>
        </div>

        {/* Mic Volume Level Bar */}
        <div className="flex items-center gap-1.5">
          <Volume2 className={`w-3.5 h-3.5 ${isHighContrast ? 'text-cyan-400' : 'text-slate-400'}`} />
          <div
            className={`w-20 rounded-full overflow-hidden ${
              isHighContrast ? 'h-2 bg-slate-900 border border-cyan-400/50' : 'h-1.5 bg-slate-800'
            }`}
          >
            <div
              className={`h-full transition-all duration-75 ${
                isHighContrast ? 'bg-cyan-300 shadow-[0_0_8px_#22d3ee]' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.min(100, volume * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Note & Cents Display */}
      <div className="relative my-4 flex flex-col items-center justify-center">
        {/* Arc Background */}
        <div className="relative w-64 h-32 flex items-end justify-center overflow-hidden">
          {/* Tick Marks */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`w-56 h-56 rounded-full border-4 border-dashed -mb-28 ${
                isHighContrast ? 'border-cyan-400/60' : 'border-slate-800/80'
              }`}
            />
          </div>

          {/* Needle Indicator */}
          <div
            className="absolute bottom-0 w-1.5 h-28 origin-bottom transition-transform duration-75"
            style={{
              transform: `rotate(${isVoiced ? needleRotation : 0}deg)`,
            }}
          >
            <div
              className={`w-2 h-full rounded-t-full shadow-lg ${
                !isVoiced
                  ? isHighContrast
                    ? 'bg-slate-700'
                    : 'bg-slate-700'
                  : isCloseInTune
                  ? isHighContrast
                    ? 'bg-emerald-300 shadow-[0_0_14px_#34d399]'
                    : 'bg-emerald-400 shadow-emerald-500/50'
                  : cents > 0
                  ? isHighContrast
                    ? 'bg-amber-300 shadow-[0_0_14px_#f59e0b]'
                    : 'bg-amber-400 shadow-amber-500/50'
                  : isHighContrast
                  ? 'bg-cyan-300 shadow-[0_0_14px_#06b6d4]'
                  : 'bg-cyan-400 shadow-cyan-500/50'
              }`}
            />
          </div>

          {/* Target in-tune center mark */}
          <div
            className={`absolute top-2 w-2 h-5 rounded-full z-10 ${
              isHighContrast
                ? 'bg-emerald-300 shadow-[0_0_10px_#10b981]'
                : 'bg-emerald-400 shadow-sm shadow-emerald-400/80'
            }`}
          />

          {/* Center Hub */}
          <div
            className={`absolute -bottom-4 w-10 h-10 rounded-full flex items-center justify-center z-20 ${
              isHighContrast
                ? 'bg-black border-2 border-cyan-400'
                : 'bg-slate-800 border-2 border-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full ${
                isCloseInTune && isVoiced
                  ? isHighContrast
                    ? 'bg-emerald-300'
                    : 'bg-emerald-400'
                  : 'bg-slate-500'
              }`}
            />
          </div>
        </div>

        {/* Large Note Name */}
        <div className="mt-2 text-center">
          <div className="flex items-baseline justify-center gap-1.5">
            <span
              className={`text-6xl font-black tracking-tight font-mono transition-colors ${
                !isVoiced
                  ? 'text-slate-600'
                  : isCloseInTune
                  ? isHighContrast
                    ? 'text-emerald-300 drop-shadow-[0_0_24px_rgba(52,211,153,0.9)]'
                    : 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                  : isHighContrast
                  ? 'text-cyan-300 drop-shadow-[0_0_20px_rgba(34,211,238,0.7)]'
                  : 'text-white'
              }`}
            >
              {isVoiced && note ? note.name : '--'}
            </span>
            {isVoiced && note && (
              <span
                className={`text-3xl font-extrabold font-mono ${
                  isHighContrast ? 'text-cyan-400' : 'text-slate-400'
                }`}
              >
                {note.octave}
              </span>
            )}
          </div>

          <div className="text-sm font-semibold text-slate-400 mt-1 flex items-center justify-center gap-2">
            <span className={isHighContrast ? 'text-slate-200' : ''}>
              {isVoiced && note ? note.nameSpanish : 'Canta al micrófono'}
            </span>
            {isVoiced && isCloseInTune && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  isHighContrast
                    ? 'bg-emerald-950 text-emerald-300 border-2 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]'
                    : 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/60'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Afinada
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cents Offset & Frequency Bar */}
      <div className="w-full grid grid-cols-3 gap-2 pt-4 border-t border-slate-800/80 text-center font-mono">
        <div
          className={`rounded-xl p-2 border ${
            isHighContrast
              ? 'bg-black border-slate-700'
              : 'bg-slate-950/50 border-slate-800/50'
          }`}
        >
          <span className="text-[10px] uppercase text-slate-400 block font-bold">Frecuencia</span>
          <span className={`text-sm font-bold ${isHighContrast ? 'text-cyan-300' : 'text-slate-200'}`}>
            {isVoiced ? `${frequency.toFixed(1)} Hz` : '0 Hz'}
          </span>
        </div>

        <div
          className={`rounded-xl p-2 border ${
            isHighContrast
              ? 'bg-black border-slate-700'
              : 'bg-slate-950/50 border-slate-800/50'
          }`}
        >
          <span className="text-[10px] uppercase text-slate-400 block font-bold">Desviación</span>
          <span
            className={`text-sm font-black ${
              !isVoiced
                ? 'text-slate-500'
                : isCloseInTune
                ? isHighContrast
                  ? 'text-emerald-300'
                  : 'text-emerald-400'
                : cents > 0
                ? isHighContrast
                  ? 'text-amber-300'
                  : 'text-amber-400'
                : isHighContrast
                ? 'text-cyan-300'
                : 'text-cyan-400'
            }`}
          >
            {isVoiced ? `${cents > 0 ? '+' : ''}${cents} cents` : '0 cents'}
          </span>
        </div>

        <div
          className={`rounded-xl p-2 border ${
            isHighContrast
              ? 'bg-black border-slate-700'
              : 'bg-slate-950/50 border-slate-800/50'
          }`}
        >
          <span className="text-[10px] uppercase text-slate-400 block font-bold">AutoTune Obj.</span>
          <span
            className={`text-sm font-bold ${
              isAutoTuneEnabled && isVoiced
                ? isHighContrast
                  ? 'text-purple-300'
                  : 'text-indigo-400'
                : 'text-slate-500'
            }`}
          >
            {isAutoTuneEnabled && isVoiced && targetHz > 0
              ? `${targetHz.toFixed(1)} Hz`
              : 'Bypass'}
          </span>
        </div>
      </div>

      {/* Clarity / Voiced Confidence Footer */}
      <div className="w-full mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span className={isHighContrast ? 'text-slate-300 font-medium' : ''}>
          Claridad Armónica:
        </span>
        <span
          className={`font-mono font-bold ${
            isHighContrast ? 'text-cyan-300' : 'text-slate-300'
          }`}
        >
          {isVoiced ? `${Math.round(clarity * 100)}%` : '0%'}
        </span>
      </div>
    </div>
  );
};
