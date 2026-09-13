import React, { useEffect, useRef } from 'react';
import { NoteName, PitchDetectionResult, ScaleType } from '../types';
import { freqToMidi, getScaleNotes, midiToFreq, NOTE_NAMES } from '../audio/musicTheory';

interface PitchRibbonCanvasProps {
  pitchResult: PitchDetectionResult;
  targetHz: number;
  isAutoTuneEnabled: boolean;
  activeKeyRoot: NoteName;
  activeScaleType: ScaleType;
  isHighContrast?: boolean;
}

interface PitchPoint {
  midi: number;
  targetMidi: number;
  isVoiced: boolean;
  timestamp: number;
}

export const PitchRibbonCanvas: React.FC<PitchRibbonCanvasProps> = ({
  pitchResult,
  targetHz,
  isAutoTuneEnabled,
  activeKeyRoot,
  activeScaleType,
  isHighContrast = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<PitchPoint[]>([]);
  const animRef = useRef<number | null>(null);

  // Keep note of scale notes for highlighting grid lines
  const scaleNotes = getScaleNotes(activeKeyRoot, activeScaleType);

  // Buffer pitch points on update
  useEffect(() => {
    const currentMidi = pitchResult.isVoiced && pitchResult.frequency > 50
      ? freqToMidi(pitchResult.frequency)
      : 0;
    const targetMidi = targetHz > 50 ? freqToMidi(targetHz) : 0;

    historyRef.current.push({
      midi: currentMidi,
      targetMidi,
      isVoiced: pitchResult.isVoiced,
      timestamp: performance.now(),
    });

    // Keep max 200 points (about 3-4 seconds of history)
    if (historyRef.current.length > 220) {
      historyRef.current.shift();
    }
  }, [pitchResult, targetHz]);

  // Main canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth * window.devicePixelRatio || 600);
    let height = (canvas.height = canvas.offsetHeight * window.devicePixelRatio || 220);

    const handleResize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      width = canvas.width = rect.width * window.devicePixelRatio;
      height = canvas.height = rect.height * window.devicePixelRatio;
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Dynamic MIDI range based on singer's current range, centered around C4 (60)
    let centerMidi = 60;
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Determine center MIDI based on recent voiced notes
      const recentVoiced = historyRef.current.filter((p) => p.isVoiced && p.midi > 30);
      if (recentVoiced.length > 0) {
        const lastMidi = recentVoiced[recentVoiced.length - 1].midi;
        centerMidi += (lastMidi - centerMidi) * 0.05;
      }

      const midiRange = 16; // Display ~16 semitones vertically
      const minMidi = Math.round(centerMidi - midiRange / 2);
      const maxMidi = Math.round(centerMidi + midiRange / 2);

      const midiToY = (m: number) => {
        return height - ((m - minMidi) / (maxMidi - minMidi)) * height;
      };

      // 1. Draw horizontal pitch lines for each semitone
      for (let m = minMidi; m <= maxMidi; m++) {
        const noteIndex = ((m % 12) + 12) % 12;
        const noteName = NOTE_NAMES[noteIndex];
        const octave = Math.floor(m / 12) - 1;
        const isScaleNote = scaleNotes.includes(noteName);
        const isRoot = noteName === activeKeyRoot;
        const y = midiToY(m);

        // Row background / line
        if (isRoot) {
          ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
          ctx.fillRect(0, y - height / midiRange / 2, width, height / midiRange);
        }

        ctx.strokeStyle = isRoot
          ? 'rgba(129, 140, 248, 0.45)'
          : isScaleNote
          ? 'rgba(148, 163, 184, 0.2)'
          : 'rgba(51, 65, 85, 0.12)';
        ctx.lineWidth = isRoot ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Note labels on left
        ctx.fillStyle = isRoot
          ? '#818cf8'
          : isScaleNote
          ? '#94a3b8'
          : 'rgba(100, 116, 139, 0.4)';
        ctx.font = `${Math.max(10, 11 * window.devicePixelRatio)}px JetBrains Mono, monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(`${noteName}${octave}`, 10 * window.devicePixelRatio, y - 4);
      }

      // 2. Draw Sung Pitch Curve (Cyan/Green Ribbon)
      const points = historyRef.current;
      if (points.length > 1) {
        const stepX = width / 200;
        const startX = width - points.length * stepX;

        // AutoTune Target Line (Quantized snapping curve)
        if (isAutoTuneEnabled) {
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
          ctx.lineWidth = 3 * window.devicePixelRatio;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();

          let inSegment = false;
          for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const x = startX + i * stepX;
            if (p.isVoiced && p.targetMidi > 30) {
              const y = midiToY(p.targetMidi);
              if (!inSegment) {
                ctx.moveTo(x, y);
                inSegment = true;
              } else {
                ctx.lineTo(x, y);
              }
            } else {
              inSegment = false;
            }
          }
          ctx.stroke();
        }

        // Live Sung Voice Ribbon
        ctx.strokeStyle = '#38bdf8';
        ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2.5 * window.devicePixelRatio;
        ctx.beginPath();

        let drawing = false;
        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const x = startX + i * stepX;
          if (p.isVoiced && p.midi > 30) {
            const y = midiToY(p.midi);
            if (!drawing) {
              ctx.moveTo(x, y);
              drawing = true;
            } else {
              ctx.lineTo(x, y);
            }
          } else {
            drawing = false;
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow

        // Current head dot
        const lastPoint = points[points.length - 1];
        if (lastPoint && lastPoint.isVoiced && lastPoint.midi > 30) {
          const headX = width - stepX;
          const headY = midiToY(lastPoint.midi);
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(headX, headY, 5 * window.devicePixelRatio, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      resizeObserver.disconnect();
    };
  }, [scaleNotes, activeKeyRoot, isAutoTuneEnabled, isHighContrast]);

  return (
    <div
      ref={containerRef}
      id="pitch-ribbon-container"
      className={`relative w-full h-44 rounded-2xl p-3 overflow-hidden shadow-inner flex flex-col justify-between transition-all ${
        isHighContrast
          ? 'bg-black border-2 border-cyan-400/80 shadow-cyan-500/10'
          : 'bg-slate-950/80 border border-slate-800/80'
      }`}
    >
      <div
        className={`absolute top-2 right-3 z-10 flex items-center gap-3 text-[11px] px-2.5 py-1 rounded-md border backdrop-blur-sm ${
          isHighContrast
            ? 'bg-black border-cyan-400/70 text-white'
            : 'bg-slate-900/80 border-slate-800/60'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2.5 h-1.5 rounded inline-block ${
              isHighContrast ? 'bg-cyan-300 shadow-[0_0_6px_#22d3ee]' : 'bg-sky-400'
            }`}
          />
          <span className={isHighContrast ? 'text-cyan-200 font-bold' : 'text-slate-300'}>
            Voz Original
          </span>
        </div>
        {isAutoTuneEnabled && (
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-1.5 rounded inline-block ${
                isHighContrast ? 'bg-purple-300 shadow-[0_0_6px_#c084fc]' : 'bg-purple-400'
              }`}
            />
            <span className={isHighContrast ? 'text-purple-200 font-bold' : 'text-slate-300'}>
              AutoTune Objetivo
            </span>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
