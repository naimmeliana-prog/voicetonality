import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Clock,
  Download,
  Edit2,
  FileAudio,
  HardDrive,
  Music,
  Play,
  Pause,
  Sliders,
  Trash2,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { RecordedTrack } from '../types';
import {
  getAllRecordings,
  deleteRecording,
  updateRecordingName,
  clearAllRecordings,
} from '../services/recordingHistory';

interface RecordingHistoryManagerProps {
  // Trigger to re-fetch when a new recording finishes in the main app
  refreshTrigger?: number;
}

export const RecordingHistoryManager: React.FC<RecordingHistoryManagerProps> = ({
  refreshTrigger = 0,
}) => {
  const [tracks, setTracks] = useState<RecordedTrack[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Audio player state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Editing track name
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState<string>('');

  const loadRecordings = async () => {
    try {
      setLoading(true);
      const list = await getAllRecordings();
      setTracks(list);
    } catch (err) {
      console.error('Error loading recordings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecordings();
  }, [refreshTrigger]);

  const handlePlayToggle = (track: RecordedTrack) => {
    if (!audioRef.current) return;

    if (playingId === track.id) {
      if (audioRef.current.paused) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
        setPlayingId(null);
      }
    } else {
      audioRef.current.src = track.url;
      audioRef.current.play().then(() => {
        setPlayingId(track.id);
      }).catch((e) => console.warn('Play error:', e));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleAudioEnded = () => {
    setPlayingId(null);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const targetTime = parseFloat(e.target.value);
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleDeleteTrack = async (id: string) => {
    if (playingId === id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
    }
    await deleteRecording(id);
    await loadRecordings();
  };

  const handleClearAll = async () => {
    if (window.confirm('¿Seguro que deseas eliminar todas las grabaciones del historial?')) {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
      }
      await clearAllRecordings();
      await loadRecordings();
    }
  };

  const handleStartEditing = (track: RecordedTrack) => {
    setEditingId(track.id);
    setEditNameValue(track.name);
  };

  const handleSaveName = async (id: string) => {
    if (editNameValue.trim()) {
      await updateRecordingName(id, editNameValue.trim());
      setEditingId(null);
      await loadRecordings();
    }
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      id="recording-history-manager"
      className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 backdrop-blur-md shadow-xl flex flex-col gap-4"
    >
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleAudioEnded}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                Historial de Grabaciones Vocales
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 border border-slate-700">
                {tracks.length} {tracks.length === 1 ? 'toma' : 'tomas'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Guarda, reproduce, renombra y descarga todas tus tomas de audio grabadas
            </p>
          </div>
        </div>

        {tracks.length > 0 && (
          <button
            onClick={handleClearAll}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vaciar Historial</span>
          </button>
        )}
      </div>

      {/* Tracks List */}
      {tracks.length === 0 ? (
        <div className="py-10 text-center flex flex-col items-center justify-center text-slate-500 gap-2 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
          <FileAudio className="w-8 h-8 text-slate-600" />
          <p className="text-xs font-medium text-slate-400">
            No hay grabaciones guardadas aún.
          </p>
          <p className="text-[11px] text-slate-500 max-w-sm">
            Haz clic en <strong>"Iniciar Grabación"</strong> en el panel de sesión para grabar tu voz con AutoTune y se guardará automáticamente aquí.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tracks.map((track) => {
            const isThisPlaying = playingId === track.id;

            return (
              <div
                key={track.id}
                id={`track-item-${track.id}`}
                className={`rounded-xl border p-4 transition-all ${
                  isThisPlaying
                    ? 'bg-slate-850 border-cyan-500/50 shadow-lg shadow-cyan-950/20 ring-1 ring-cyan-500/30'
                    : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800/80'
                }`}
              >
                {/* Top Row: Name, Edit & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 flex-grow">
                    {editingId === track.id ? (
                      <div className="flex items-center gap-1.5 flex-grow max-w-md">
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          className="bg-slate-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-cyan-500 focus:outline-none w-full"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName(track.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveName(track.id)}
                          className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                          title="Guardar nombre"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {track.name}
                        </h4>
                        <button
                          onClick={() => handleStartEditing(track)}
                          className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                          title="Renombrar grabación"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Metadata Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDate(track.createdAt)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 font-mono">
                      {formatSeconds(track.durationSeconds)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                      {formatBytes(track.sizeBytes)}
                    </span>
                    {track.keyRoot && (
                      <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 font-bold">
                        {track.keyRoot} {track.scaleType}
                      </span>
                    )}
                    {track.strength !== undefined && (
                      <span className="px-2 py-0.5 rounded bg-purple-950/60 text-purple-400 border border-purple-800/40 font-mono">
                        {track.retuneSpeedMs}ms • {track.strength}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Player Controls & Progress Bar */}
                <div className="flex items-center gap-3 bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/70">
                  <button
                    onClick={() => handlePlayToggle(track)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                      isThisPlaying
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    title={isThisPlaying ? 'Pausar reproducción' : 'Reproducir toma'}
                  >
                    {isThisPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Scrubber */}
                  <div className="flex flex-col flex-grow gap-1">
                    <input
                      type="range"
                      min={0}
                      max={isThisPlaying ? duration || track.durationSeconds : track.durationSeconds}
                      step={0.05}
                      value={isThisPlaying ? currentTime : 0}
                      onChange={handleSeek}
                      disabled={!isThisPlaying}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-40"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-slate-500">
                      <span>{isThisPlaying ? formatSeconds(currentTime) : '00:00'}</span>
                      <span>{formatSeconds(track.durationSeconds)}</span>
                    </div>
                  </div>

                  {/* Action Buttons: Download & Delete */}
                  <div className="flex items-center gap-1.5 shrink-0 border-l border-slate-800 pl-2">
                    <a
                      href={track.url}
                      download={`${track.name.replace(/\s+/g, '_')}.webm`}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 transition-colors"
                      title="Descargar archivo de audio"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => handleDeleteTrack(track.id)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Eliminar del historial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
