import React, { useEffect, useRef, useState } from 'react';
import { Activity, BarChart2, Maximize2, Radio, Sparkles, Volume2, Zap } from 'lucide-react';
import { PitchDetectionResult } from '../types';

interface FrequencySpectrumVisualizerProps {
  analyserNode: AnalyserNode | null;
  isAudioRunning: boolean;
  pitchResult?: PitchDetectionResult;
  targetHz?: number;
  isHighContrast?: boolean;
}

export const FrequencySpectrumVisualizer: React.FC<FrequencySpectrumVisualizerProps> = ({
  analyserNode,
  isAudioRunning,
  pitchResult,
  targetHz = 0,
  isHighContrast = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [displayMode, setDisplayMode] = useState<'bars' | 'curve'>('bars');
  const [peakHoldEnabled, setPeakHoldEnabled] = useState<boolean>(true);
  const [activePeakHz, setActivePeakHz] = useState<number>(0);
  const [activePeakDb, setActivePeakDb] = useState<number>(-100);

  // Peak decay memory array
  const peakValuesRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 500);
    let height = (canvas.height = 140);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          width = canvas.width = entry.contentRect.width;
          height = canvas.height = 140;
        }
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 1024;
    const dataArray = new Uint8Array(bufferLength);

    if (!peakValuesRef.current || peakValuesRef.current.length !== 64) {
      peakValuesRef.current = new Float32Array(64);
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Background Grid & dB Guides
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;

      // Horizontal dB lines (-12dB, -24dB, -36dB, -48dB)
      const dbLines = [
        { label: '0 dB', y: 12 },
        { label: '-18 dB', y: height * 0.35 },
        { label: '-36 dB', y: height * 0.65 },
        { label: '-54 dB', y: height * 0.88 },
      ];

      ctx.font = '9px monospace';
      ctx.fillStyle = '#64748b';

      for (const line of dbLines) {
        ctx.beginPath();
        ctx.setLineDash([2, 4]);
        ctx.moveTo(0, line.y);
        ctx.lineTo(width, line.y);
        ctx.stroke();
        ctx.fillText(line.label, 4, line.y - 2);
      }
      ctx.setLineDash([]);

      // Frequency milestones (Hz) in vocal range (80 Hz to ~4000 Hz)
      const freqMarkers = [
        { hz: 100, label: '100Hz' },
        { hz: 250, label: '250Hz (C4)' },
        { hz: 500, label: '500Hz' },
        { hz: 1000, label: '1kHz' },
        { hz: 2000, label: '2kHz' },
        { hz: 4000, label: '4kHz' },
      ];

      // Min/max displayed frequencies on logarithmic/warped musical scale
      const minFreq = 60;
      const maxFreq = 5000;

      for (const marker of freqMarkers) {
        const normX = Math.log10(marker.hz / minFreq) / Math.log10(maxFreq / minFreq);
        const x = normX * width;
        if (x > 20 && x < width - 20) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)';
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height - 14);
          ctx.stroke();
          ctx.fillStyle = '#64748b';
          ctx.fillText(marker.label, x - 12, height - 3);
        }
      }

      if (!isAudioRunning || !analyserNode) {
        // Idle standby text
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          'Espectro inactivo. Inicia el micrófono para ver la señal FFT en vivo.',
          width / 2,
          height / 2
        );
        ctx.textAlign = 'start';
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      // 2. Fetch FFT frequency data
      analyserNode.getByteFrequencyData(dataArray);

      const numBars = 54;
      const barSpacing = 2;
      const totalSpacing = (numBars - 1) * barSpacing;
      const barWidth = Math.max(2, (width - totalSpacing) / numBars);

      let peakMax = 0;
      let peakFreqHz = 0;
      const sampleRate = analyserNode.context.sampleRate || 44100;
      const nyquist = sampleRate / 2;

      // Group FFT bins logarithmically into `numBars`
      const barHeights: number[] = [];
      for (let i = 0; i < numBars; i++) {
        const normLo = Math.pow(i / numBars, 2);
        const normHi = Math.pow((i + 1) / numBars, 2);

        const freqLo = minFreq + normLo * (maxFreq - minFreq);
        const freqHi = minFreq + normHi * (maxFreq - minFreq);

        const binLo = Math.max(0, Math.floor((freqLo / nyquist) * bufferLength));
        const binHi = Math.min(bufferLength - 1, Math.ceil((freqHi / nyquist) * bufferLength));

        let sum = 0;
        let count = 0;
        for (let b = binLo; b <= binHi; b++) {
          sum += dataArray[b];
          count++;
        }
        const avg = count > 0 ? sum / count : 0;
        const normVal = avg / 255;
        const barH = normVal * (height - 24);
        barHeights.push(barH);

        if (avg > peakMax) {
          peakMax = avg;
          peakFreqHz = (freqLo + freqHi) / 2;
        }

        // Peak hold decay
        if (peakValuesRef.current) {
          if (barH > peakValuesRef.current[i]) {
            peakValuesRef.current[i] = barH;
          } else {
            peakValuesRef.current[i] = Math.max(0, peakValuesRef.current[i] - 0.4);
          }
        }
      }

      if (peakMax > 15) {
        setActivePeakHz(Math.round(peakFreqHz));
        const db = Math.round(20 * Math.log10(Math.max(1, peakMax) / 255));
        setActivePeakDb(db);
      }

      // 3. Render Mode: Bars or Smooth Curve
      if (displayMode === 'bars') {
        for (let i = 0; i < numBars; i++) {
          const x = i * (barWidth + barSpacing);
          const barH = barHeights[i];
          const y = height - 16 - barH;

          // Color gradient according to frequency band (cyan to indigo to violet)
          const grad = ctx.createLinearGradient(x, y, x, height - 16);
          const hue = 180 + (i / numBars) * 100; // Cyan (180) to Purple (280)
          grad.addColorStop(0, `hsla(${hue}, 95%, 65%, 0.95)`);
          grad.addColorStop(1, `hsla(${hue}, 85%, 45%, 0.35)`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barH, [2, 2, 0, 0]);
          ctx.fill();

          // Peak hold top dash
          if (peakHoldEnabled && peakValuesRef.current) {
            const peakH = peakValuesRef.current[i];
            const peakY = height - 16 - peakH;
            ctx.fillStyle = `hsla(${hue}, 100%, 75%, 0.8)`;
            ctx.fillRect(x, peakY - 1, barWidth, 2);
          }
        }
      } else {
        // Curve mode (Filled smooth spline area)
        ctx.beginPath();
        ctx.moveTo(0, height - 16);

        for (let i = 0; i < numBars; i++) {
          const x = i * (barWidth + barSpacing) + barWidth / 2;
          const y = height - 16 - barHeights[i];
          if (i === 0) {
            ctx.lineTo(x, y);
          } else {
            const prevX = (i - 1) * (barWidth + barSpacing) + barWidth / 2;
            const prevY = height - 16 - barHeights[i - 1];
            const midX = (prevX + x) / 2;
            ctx.quadraticCurveTo(prevX, prevY, midX, (prevY + y) / 2);
          }
        }
        ctx.lineTo(width, height - 16);
        ctx.closePath();

        const areaGrad = ctx.createLinearGradient(0, 0, 0, height);
        areaGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
        areaGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.25)');
        areaGrad.addColorStop(1, 'rgba(15, 23, 42, 0.05)');

        ctx.fillStyle = areaGrad;
        ctx.fill();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 4. Fundamental Frequency (F0) Marker line
      const currentF0 = pitchResult?.frequency || 0;
      if (currentF0 >= minFreq && currentF0 <= maxFreq && pitchResult?.isVoiced) {
        const normX = Math.log10(currentF0 / minFreq) / Math.log10(maxFreq / minFreq);
        const f0X = normX * width;

        // Vertical glowing needle on current detected fundamental
        ctx.beginPath();
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = '#fbbf24'; // Gold
        ctx.lineWidth = 2;
        ctx.moveTo(f0X, 4);
        ctx.lineTo(f0X, height - 16);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label flag for F0
        const tag = `${pitchResult.note?.name || ''}${pitchResult.note?.octave ?? ''} (${Math.round(currentF0)}Hz)`;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.roundRect(Math.max(4, Math.min(width - 90, f0X - 35)), 4, 76, 14, 3);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(tag, Math.max(42, Math.min(width - 52, f0X + 3)), 14);
        ctx.textAlign = 'start';
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [analyserNode, isAudioRunning, displayMode, peakHoldEnabled, pitchResult, isHighContrast]);

  return (
    <div
      id="frequency-spectrum-card"
      ref={containerRef}
      className={`rounded-2xl p-4 backdrop-blur-md shadow-xl flex flex-col gap-3 transition-all ${
        isHighContrast
          ? 'bg-black border-2 border-cyan-400 text-white shadow-cyan-500/20'
          : 'bg-slate-900/90 border border-slate-800'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              Espectro de Frecuencias en Tiempo Real (FFT)
              {isAudioRunning && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </h3>
            <p className="text-[10px] text-slate-400">
              Visualizador espectral armónico de la señal vocal entrante
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDisplayMode((m) => (m === 'bars' ? 'curve' : 'bars'))}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Alternar vista entre barras y curva continua"
          >
            <BarChart2 className="w-3 h-3 text-cyan-400" />
            <span>{displayMode === 'bars' ? 'Barras' : 'Curva'}</span>
          </button>

          <button
            onClick={() => setPeakHoldEnabled((p) => !p)}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors border ${
              peakHoldEnabled
                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60'
                : 'bg-slate-800/60 text-slate-500 border-slate-700'
            }`}
            title="Activar/desactivar memoria de picos armónicos"
          >
            Picos
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative w-full rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden shadow-inner p-1">
        <canvas ref={canvasRef} className="w-full block" />
      </div>

      {/* Telemetry Footer */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
        <div className="flex items-center gap-3">
          <span>
            Pico Armónico:{' '}
            <strong className="text-cyan-300">
              {activePeakHz > 0 ? `${activePeakHz} Hz` : '--'}
            </strong>
          </span>
          <span>
            Nivel:{' '}
            <strong className="text-slate-200">
              {activePeakDb > -90 ? `${activePeakDb} dB` : '--'}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pitchResult?.isVoiced ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Voz: {pitchResult.note?.name}{pitchResult.note?.octave} ({Math.round(pitchResult.frequency)}Hz)
            </span>
          ) : (
            <span className="text-slate-500">Esperando señal vocal...</span>
          )}
        </div>
      </div>
    </div>
  );
};
