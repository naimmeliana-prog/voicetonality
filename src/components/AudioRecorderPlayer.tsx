import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Mic,
  Music,
  Pause,
  Play,
  RotateCcw,
  Square,
  Upload,
  Volume2,
} from 'lucide-react';

interface AudioRecorderPlayerProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  recordedAudioUrl: string | null;
  recordedBlob: Blob | null;
  isAudioEngineRunning: boolean;
}

export const AudioRecorderPlayer: React.FC<AudioRecorderPlayerProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  recordedAudioUrl,
  recordedBlob,
  isAudioEngineRunning,
}) => {
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);
  const [backingTrackUrl, setBackingTrackUrl] = useState<string | null>(null);
  const [backingTrackName, setBackingTrackName] = useState<string | null>(null);
  const [isPlayingBacking, setIsPlayingBacking] = useState(false);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const backingAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordSeconds(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordSeconds((sec) => sec + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTogglePlayRecorded = () => {
    if (!audioPlayerRef.current) return;
    if (isPlayingRecorded) {
      audioPlayerRef.current.pause();
      setIsPlayingRecorded(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlayingRecorded(true);
    }
  };

  const handleBackingTrackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (backingTrackUrl) {
        URL.revokeObjectURL(backingTrackUrl);
      }
      const url = URL.createObjectURL(file);
      setBackingTrackUrl(url);
      setBackingTrackName(file.name);
    }
  };

  const handleTogglePlayBacking = () => {
    if (!backingAudioRef.current) return;
    if (isPlayingBacking) {
      backingAudioRef.current.pause();
      setIsPlayingBacking(false);
    } else {
      backingAudioRef.current.play();
      setIsPlayingBacking(true);
    }
  };

  return (
    <div
      id="recorder-player-card"
      className="flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 p-6 backdrop-blur-md shadow-xl justify-between gap-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Grabación y Pista de Acompañamiento
              {isRecording && (
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-rose-400 bg-rose-950/60 border border-rose-800/40 px-2 py-0.5 rounded-full animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Grabando
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Graba tu voz procesada con AutoTune o canta sobre tu pista instrumental
            </p>
          </div>
        </div>

        {/* Big Record Button */}
        <div>
          {!isRecording ? (
            <button
              id="btn-start-record"
              disabled={!isAudioEngineRunning}
              onClick={onStartRecording}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                isAudioEngineRunning
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-white" />
              Grabar Voz
            </button>
          ) : (
            <button
              id="btn-stop-record"
              onClick={onStopRecording}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-rose-400 border border-rose-500/40 shadow-lg shadow-rose-500/20"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Detener ({formatTime(recordSeconds)})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recorded Audio Player */}
        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/60 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Última Toma Grabada:
            </span>
            {recordedBlob && (
              <span className="text-[10px] font-mono text-slate-400">
                {(recordedBlob.size / 1024).toFixed(1)} KB
              </span>
            )}
          </div>

          {recordedAudioUrl ? (
            <div className="flex flex-col gap-2">
              <audio
                ref={audioPlayerRef}
                src={recordedAudioUrl}
                onEnded={() => setIsPlayingRecorded(false)}
                className="hidden"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={handleTogglePlayRecorded}
                  className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                >
                  {isPlayingRecorded ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="text-xs font-medium text-slate-200">
                    Toma Vocal con AutoTune
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {formatTime(recordSeconds)} segundos
                  </div>
                </div>

                <a
                  id="btn-download-recording"
                  href={recordedAudioUrl}
                  download={`vocal_autotune_${new Date().toISOString().slice(0, 10)}.webm`}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors border border-slate-700"
                  title="Descargar grabación"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-3 text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
              {isRecording
                ? `Grabando... ${formatTime(recordSeconds)}`
                : 'Aún no has grabado ninguna toma'}
            </div>
          )}
        </div>

        {/* Backing Track Player */}
        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/60 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-indigo-400" /> Pista Instrumental / Base
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleBackingTrackUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline"
            >
              <Upload className="w-3 h-3" /> Cargar Audio
            </button>
          </div>

          {backingTrackUrl ? (
            <div className="flex flex-col gap-2">
              <audio
                ref={backingAudioRef}
                src={backingTrackUrl}
                onEnded={() => setIsPlayingBacking(false)}
                className="hidden"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={handleTogglePlayBacking}
                  className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm shadow-indigo-500/30"
                >
                  {isPlayingBacking ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                <div className="flex-1 overflow-hidden">
                  <div className="text-xs font-medium text-slate-200 truncate">
                    {backingTrackName || 'Base Instrumental'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Canta sobre la pista para detectar su tonalidad
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="text-center py-3 text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 hover:bg-slate-900/40 transition-colors"
            >
              Haz clic para subir un MP3/WAV y cantar sobre él
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
