import React, { useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  FileAudio,
  FileCode,
  FolderDown,
  Layout,
  Radio,
  Sliders,
  Terminal,
  X,
} from 'lucide-react';
import {
  SCRIPT_AUTOTUNE_PROCESSOR,
  SCRIPT_REALTIME_PITCH,
  SCRIPT_AUTOTUNE_GUI,
  REQUIREMENTS_TXT,
  README_PYTHON_MD,
} from '../audio/pythonScripts';

interface PythonScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'processor' | 'realtime' | 'gui' | 'requirements';

export const PythonScriptModal: React.FC<PythonScriptModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('gui');
  const [hasCopied, setHasCopied] = useState(false);

  if (!isOpen) return null;

  const getActiveContent = (): { code: string; filename: string; title: string; desc: string } => {
    switch (activeTab) {
      case 'processor':
        return {
          code: SCRIPT_AUTOTUNE_PROCESSOR,
          filename: 'autotune_processor.py',
          title: 'Función y CLI de AutoTune para Archivos de Audio',
          desc: 'Aplica corrección tonal con retune speed (velocidad) y pitch range (intensidad) configurables con Librosa.',
        };
      case 'realtime':
        return {
          code: SCRIPT_REALTIME_PITCH,
          filename: 'pitch_analyzer_realtime.py',
          title: 'Analizador de Frecuencia Fundamental (F0) en Tiempo Real',
          desc: 'Detección de tono desde el micrófono con Aubio / Librosa, nota musical y desviación en cents (-50 a +50¢).',
        };
      case 'gui':
        return {
          code: SCRIPT_AUTOTUNE_GUI,
          filename: 'autotune_gui.py',
          title: 'Interfaz Gráfica de Usuario (GUI Tkinter)',
          desc: 'App de escritorio con Grabar, Reproducir, Medidor de Tono en Vivo y Sliders de Intensidad y Velocidad.',
        };
      case 'requirements':
        return {
          code: `# requirements.txt\n${REQUIREMENTS_TXT}\n\n# ============================\n# README.md\n# ============================\n${README_PYTHON_MD}`,
          filename: 'requirements.txt',
          title: 'Dependencias e Instrucciones de Instalación',
          desc: 'Requisitos pip install para ejecutar todos los scripts en Windows, macOS o Linux.',
        };
    }
  };

  const current = getActiveContent();

  const handleCopy = () => {
    navigator.clipboard.writeText(current.code);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([current.code], {
      type: current.filename.endsWith('.py') ? 'text/x-python' : 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = current.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    const files = [
      { name: 'autotune_processor.py', content: SCRIPT_AUTOTUNE_PROCESSOR },
      { name: 'pitch_analyzer_realtime.py', content: SCRIPT_REALTIME_PITCH },
      { name: 'autotune_gui.py', content: SCRIPT_AUTOTUNE_GUI },
      { name: 'requirements.txt', content: REQUIREMENTS_TXT },
      { name: 'README.md', content: README_PYTHON_MD },
    ];

    // Download each file cleanly with a small timeout between triggers
    files.forEach((file, index) => {
      setTimeout(() => {
        const blob = new Blob([file.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }, index * 200);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        id="python-suite-modal"
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Python AutoTune & Pitch Detection Suite
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Python 3.8+
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Código fuente completo para archivo de audio, detector en tiempo real y GUI de escritorio (Tkinter)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAll}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
              title="Descarga los 3 scripts Python + requirements.txt"
            >
              <FolderDown className="w-4 h-4" />
              <span>Descargar Todo</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-slate-800 bg-slate-950/50 overflow-x-auto scrollbar-thin">
          <button
            onClick={() => setActiveTab('gui')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium rounded-t-lg transition-all border-b-2 ${
              activeTab === 'gui'
                ? 'border-cyan-400 text-cyan-300 bg-slate-800/80 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>3. GUI Desktop (Tkinter)</span>
          </button>

          <button
            onClick={() => setActiveTab('processor')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium rounded-t-lg transition-all border-b-2 ${
              activeTab === 'processor'
                ? 'border-indigo-400 text-indigo-300 bg-slate-800/80 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>1. Función AutoTune (Archivo)</span>
          </button>

          <button
            onClick={() => setActiveTab('realtime')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium rounded-t-lg transition-all border-b-2 ${
              activeTab === 'realtime'
                ? 'border-amber-400 text-amber-300 bg-slate-800/80 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>2. Analizador Realtime (Aubio)</span>
          </button>

          <button
            onClick={() => setActiveTab('requirements')}
            className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium rounded-t-lg transition-all border-b-2 ${
              activeTab === 'requirements'
                ? 'border-emerald-400 text-emerald-300 bg-slate-800/80 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Instalación (pip)</span>
          </button>
        </div>

        {/* Tab Context Info Banner */}
        <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="font-semibold text-slate-100">{current.title}</span>
            <span className="hidden md:inline text-slate-500">•</span>
            <span className="hidden md:inline text-slate-400">{current.desc}</span>
          </div>
          <span className="font-mono text-[11px] text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/50">
            {current.filename}
          </span>
        </div>

        {/* Code View Body */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950/95 font-mono text-xs text-slate-200 leading-relaxed scrollbar-thin">
          <pre className="whitespace-pre select-text font-mono">{current.code}</pre>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Instalación: </span>
            <code className="bg-slate-900 px-2 py-0.5 rounded text-[11px] text-emerald-300 border border-slate-800">
              pip install numpy scipy sounddevice soundfile librosa aubio
            </code>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopy}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              {hasCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Código</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadSingle}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Descargar {current.filename}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
