import React from 'react';
import { BookOpen, Check, Headphones, Mic2, Music, Sparkles, X } from 'lucide-react';

interface VocalGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VocalGuideModal: React.FC<VocalGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        id="vocal-guide-modal"
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Guía Rápida para Cantar Afinado
              </h3>
              <p className="text-xs text-slate-400">
                Aprende cómo aprovechar la detección de tono y el AutoTune
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-sm text-slate-300 space-y-4">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0 h-fit">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">
                1. Usa Auriculares Obligatoriamente
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Si activas el monitor de voz sin auriculares, el sonido saldrá por los altavoces de tu ordenador y volverá a entrar por el micrófono, provocando un pitido molesto (acople acústico o feedback). Con auriculares escucharás tu voz afinada en tiempo real sin interferencias.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0 h-fit">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">
                2. ¿Cómo funciona la Detección de Tonalidad?
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                A medida que cantas o tarareas una melodía, el algoritmo analiza qué notas utilizas más y las compara matemáticamente con los 24 perfiles armónicos (Krumhansl-Schmuckler). Una vez detectada la tonalidad (por ejemplo, <em>Sol Mayor</em>), puedes pulsar &ldquo;Fijar Tonalidad&rdquo; para que el AutoTune restrinja la afinación únicamente a las notas correctas de esa escala.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex gap-3">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg shrink-0 h-fit">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">
                3. Ajuste de Retune Speed (Velocidad de Corrección)
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                <strong>0 ms (Robótico/Trap):</strong> Salto instantáneo entre notas sin transiciones. El sonido característico de Travis Scott o Cher.<br />
                <strong>20 - 40 ms (Pop Moderno):</strong> Corrige los deslices rápidamente pero mantiene cierta naturalidad vocal.<br />
                <strong>60 - 80 ms (Acústico/Natural):</strong> Corrige la nota central respetando el vibrato y las inflexiones naturales de tu voz.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex gap-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg shrink-0 h-fit">
              <Mic2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">
                4. Tono de Referencia y Pistas de Acompañamiento
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Puedes pulsar &ldquo;Escuchar Tono&rdquo; para reproducir el acorde base en la tonalidad detectada. Te servirá de ancla armónica para entrar siempre entonado. También puedes subir una base instrumental MP3 en la sección inferior para practicar cantando sobre la música.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
