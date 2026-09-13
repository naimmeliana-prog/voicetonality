import { AutoTunePreset } from '../types';

export const AUTOTUNE_PRESETS: AutoTunePreset[] = [
  {
    id: 'robot',
    name: 'Robot',
    tagline: 'Efecto T-Pain / Cher',
    description: 'Afinación instantánea (0 ms) sin curvas de transición. Sonido robótico duro característico.',
    iconName: 'bot',
    settings: {
      retuneSpeedMs: 0,
      strength: 100,
      reverbAmount: 0.15,
    },
  },
  {
    id: 'natural',
    name: 'Natural',
    tagline: 'Vocal Transparente',
    description: 'Corrección suave que preserva el vibrato y la dinámica expresiva del cantante.',
    iconName: 'feather',
    settings: {
      retuneSpeedMs: 75,
      strength: 60,
      reverbAmount: 0.25,
    },
  },
  {
    id: 'pop',
    name: 'Pop',
    tagline: 'Estándar de Radio',
    description: 'Afinación rápida (20 ms) y precisa con brillo comercial para temas Pop y R&B.',
    iconName: 'sparkles',
    settings: {
      retuneSpeedMs: 20,
      strength: 90,
      reverbAmount: 0.3,
    },
  },
  {
    id: 'hyper-pitch',
    name: 'Hyper-pitch',
    tagline: 'EDM & Hyperpop',
    description: 'Cuantización ultra-rápida (5 ms) al 100% de fuerza para música electrónica y géneros hiper-sintéticos.',
    iconName: 'zap',
    settings: {
      retuneSpeedMs: 5,
      strength: 100,
      reverbAmount: 0.4,
    },
  },
  {
    id: 'acoustic',
    name: 'Sutil / Acústico',
    tagline: 'Directo Orgánico',
    description: 'Ajuste casi imperceptible para baladas acústicas, cantautores y directos íntimos.',
    iconName: 'activity',
    settings: {
      retuneSpeedMs: 110,
      strength: 40,
      reverbAmount: 0.15,
    },
  },
  {
    id: 'trap',
    name: 'Trap Hard-Tune',
    tagline: 'AutoTune Urbano',
    description: 'Afinación dura con retune 0 ms y reverb de estudio optimizada para barras vocales urbanas.',
    iconName: 'flame',
    settings: {
      retuneSpeedMs: 0,
      strength: 95,
      reverbAmount: 0.35,
    },
  },
];
