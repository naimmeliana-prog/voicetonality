import {
  AudioDeviceOption,
  AutoTuneSettings,
  CompressorSettings,
  KeyDetectionResult,
  NoteName,
  PitchDetectionResult,
  ScaleType,
} from '../types';
import { findClosestScaleNote, freqToMidi, NOTE_NAMES } from './musicTheory';
import { PitchDetector } from './pitchDetector';
import { KeyDetector } from './keyDetector';

export class AutoTuneEngine {
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private filterHighPass: BiquadFilterNode | null = null;
  private filterLowPass: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private dryGainNode: GainNode | null = null;
  private wetGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private latencyDelayNode: DelayNode | null = null;
  private monitorGainNode: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGainNode: GainNode | null = null;

  // Drone / Reference synth
  private droneOscillators: OscillatorNode[] = [];
  private droneGain: GainNode | null = null;

  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordDestination: MediaStreamAudioDestinationNode | null = null;

  // Detectors
  private pitchDetector: PitchDetector | null = null;
  private keyDetector: KeyDetector | null = null;

  // Processing buffers & state
  private isRunning: boolean = false;
  private animFrameId: number | null = null;
  private timeDataBuffer: Float32Array = new Float32Array(2048);

  // AutoTune parameters
  private settings: AutoTuneSettings = {
    enabled: true,
    strength: 100,
    retuneSpeedMs: 20, // 0 = robotic, 80 = natural
    scaleType: 'major',
    keyRoot: 'C',
    autoKeyTracking: true,
    pitchRange: 'all',
    monitorVolume: 0.8,
    reverbAmount: 0.25,
    compressor: {
      enabled: true,
      threshold: -24, // -24 dB
      ratio: 4,       // 4:1 vocal dynamic leveling
      knee: 10,
      attack: 0.003,
      release: 0.15,
    },
    latency: {
      bufferSize: 512,
      compensationMs: 0,
    },
    inputDeviceId: '',
    outputDeviceId: '',
  };

  // Dynamic DSP state
  private currentPitchRatio: number = 1.0;
  private targetPitchRatio: number = 1.0;
  private lastPitchHz: number = 0;
  private lastTargetHz: number = 0;
  private lastVoicedTime: number = 0;

  // Granular Pitch Shifting internal state
  private circularBuffer: Float32Array = new Float32Array(32768);
  private writeIndex: number = 0;
  private grainWindow: Float32Array = new Float32Array(1024);
  private grainSize: number = 1024;
  private grainPhase1: number = 0;
  private grainPhase2: number = 512;

  // Callbacks
  public onPitchUpdate: ((result: PitchDetectionResult, targetHz: number) => void) | null = null;
  public onKeyUpdate: ((result: KeyDetectionResult) => void) | null = null;
  public onRecordingComplete: ((blob: Blob, url: string) => void) | null = null;

  constructor() {
    // Generate Hanning window for smooth granular pitch shifting
    for (let i = 0; i < this.grainSize; i++) {
      this.grainWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (this.grainSize - 1)));
    }
  }

  public async start(): Promise<boolean> {
    try {
      if (this.isRunning) return true;

      // Initialize AudioContext
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({
        latencyHint: 'interactive',
      });

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Configure audio output device if chosen and supported
      if (this.settings.outputDeviceId && 'setSinkId' in this.audioCtx) {
        try {
          await (this.audioCtx as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(
            this.settings.outputDeviceId
          );
        } catch (e) {
          console.warn('Could not set initial audio output sinkId:', e);
        }
      }

      // Request microphone stream with specific input device if configured
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };
      if (this.settings.inputDeviceId) {
        audioConstraints.deviceId = { exact: this.settings.inputDeviceId };
      }

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      const sr = this.audioCtx.sampleRate;
      this.pitchDetector = new PitchDetector(sr, 2048);
      this.pitchDetector.setVocalRange(this.settings.pitchRange);
      this.keyDetector = new KeyDetector();

      // Audio Graph
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);

      // Clean filter: cut sub-rumble below 75Hz, cut high hiss above 4000Hz
      this.filterHighPass = this.audioCtx.createBiquadFilter();
      this.filterHighPass.type = 'highpass';
      this.filterHighPass.frequency.value = 75;

      this.filterLowPass = this.audioCtx.createBiquadFilter();
      this.filterLowPass.type = 'lowpass';
      this.filterLowPass.frequency.value = 4000;

      // Dynamics Compressor Node: Level vocal dynamics before pitch correction
      this.compressorNode = this.audioCtx.createDynamicsCompressor();
      this.updateCompressorSettings();

      // Analyser for pitch detection and real-time spectrum
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 2048;

      // Granular pitch shifter processor
      const bufferSize = this.settings.latency?.bufferSize || 512;
      this.processorNode = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);
      this.processorNode.onaudioprocess = (e) => this.processAudio(e);

      // Gain controls
      this.dryGainNode = this.audioCtx.createGain();
      this.wetGainNode = this.audioCtx.createGain();
      this.masterGainNode = this.audioCtx.createGain();
      this.monitorGainNode = this.audioCtx.createGain();
      this.reverbGainNode = this.audioCtx.createGain();

      // Latency alignment delay node
      this.latencyDelayNode = this.audioCtx.createDelay(1.0);
      const delaySec = Math.max(0, (this.settings.latency?.compensationMs || 0) / 1000);
      this.latencyDelayNode.delayTime.value = delaySec;

      this.updateGains();

      // Create Reverb Impulse
      this.reverbNode = this.audioCtx.createConvolver();
      this.reverbNode.buffer = this.createStudioReverbImpulse(sr);

      // Recording Destination
      this.recordDestination = this.audioCtx.createMediaStreamDestination();

      // Connect Graph
      // 1. Mic -> Clean Filters
      this.sourceNode.connect(this.filterHighPass);
      this.filterHighPass.connect(this.filterLowPass);

      // 2. Filtered Mic -> Dynamics Compressor (Levels vocal dynamics BEFORE pitch correction)
      this.filterLowPass.connect(this.compressorNode);

      // 3. Leveled Vocal -> Analyser Node (stable pitch detection)
      this.compressorNode.connect(this.analyserNode);

      // 4. Leveled Vocal -> Processor (AutoTune) & Dry Path
      this.compressorNode.connect(this.processorNode);
      this.processorNode.connect(this.wetGainNode);
      this.compressorNode.connect(this.dryGainNode);

      // 5. Mix Dry + Wet into Master
      this.wetGainNode.connect(this.masterGainNode);
      this.dryGainNode.connect(this.masterGainNode);

      // 6. Master -> Reverb send
      this.masterGainNode.connect(this.reverbNode);
      this.reverbNode.connect(this.reverbGainNode);

      // 7. Master + Reverb -> Latency Delay Compensation -> Monitor output (Speakers / Headphones)
      this.masterGainNode.connect(this.latencyDelayNode);
      this.reverbGainNode.connect(this.latencyDelayNode);
      this.latencyDelayNode.connect(this.monitorGainNode);
      this.monitorGainNode.connect(this.audioCtx.destination);

      // 8. Master + Reverb -> Recording destination
      this.masterGainNode.connect(this.recordDestination);
      this.reverbGainNode.connect(this.recordDestination);

      this.isRunning = true;
      this.startPitchDetectionLoop();

      return true;
    } catch (err) {
      console.error('Failed to start audio engine:', err);
      this.stop();
      return false;
    }
  }

  /**
   * Generates a smooth, natural studio vocal plate reverb impulse
   */
  private createStudioReverbImpulse(sampleRate: number): AudioBuffer {
    const length = Math.floor(sampleRate * 1.5); // 1.5 seconds decay
    const impulse = this.audioCtx!.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (sampleRate * 0.4));
      // Diffused stereo noise with exponential decay
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    return impulse;
  }

  private updateGains() {
    if (!this.dryGainNode || !this.wetGainNode || !this.monitorGainNode || !this.reverbGainNode) return;

    const strength = this.settings.enabled ? this.settings.strength / 100 : 0;
    // Equal power crossfade
    this.dryGainNode.gain.value = Math.cos((strength * Math.PI) / 2);
    this.wetGainNode.gain.value = Math.sin((strength * Math.PI) / 2);

    this.monitorGainNode.gain.value = this.settings.monitorVolume;
    this.reverbGainNode.gain.value = this.settings.reverbAmount * 0.4;
  }

  private updateCompressorSettings() {
    if (!this.compressorNode || !this.audioCtx) return;
    const comp = this.settings.compressor;
    const now = this.audioCtx.currentTime;
    if (comp.enabled) {
      this.compressorNode.threshold.setValueAtTime(comp.threshold, now);
      this.compressorNode.ratio.setValueAtTime(comp.ratio, now);
      this.compressorNode.knee.setValueAtTime(comp.knee ?? 10, now);
      this.compressorNode.attack.setValueAtTime(comp.attack ?? 0.003, now);
      this.compressorNode.release.setValueAtTime(comp.release ?? 0.15, now);
    } else {
      // In bypass mode, set threshold to 0dB and ratio to 1 (transparent unity)
      this.compressorNode.threshold.setValueAtTime(0, now);
      this.compressorNode.ratio.setValueAtTime(1, now);
    }
  }

  public getCompressorGainReduction(): number {
    if (this.compressorNode && this.settings.compressor.enabled) {
      return this.compressorNode.reduction;
    }
    return 0;
  }

  /**
   * Real-time Granular / Time-Domain Pitch Correction DSP
   */
  private processAudio(e: AudioProcessingEvent) {
    const input = e.inputBuffer.getChannelData(0);
    const output = e.outputBuffer.getChannelData(0);
    const bufferLen = input.length;
    const circLen = this.circularBuffer.length;
    const gSize = this.grainSize;
    const halfGSize = gSize / 2;

    // Smoothly interpolate pitch ratio towards target based on retuneSpeedMs
    const dtSeconds = bufferLen / (this.audioCtx?.sampleRate || 44100);
    const speed = Math.max(0.001, this.settings.retuneSpeedMs / 1000);
    const alpha = this.settings.retuneSpeedMs === 0 ? 1.0 : 1 - Math.exp(-dtSeconds / speed);

    for (let i = 0; i < bufferLen; i++) {
      // Write sample to circular buffer
      this.circularBuffer[this.writeIndex] = input[i];

      // Smooth pitch ratio
      this.currentPitchRatio += alpha * (this.targetPitchRatio - this.currentPitchRatio);
      // Clamp ratio to +/- 1 octave (0.5 to 2.0)
      const ratio = Math.max(0.5, Math.min(2.0, this.currentPitchRatio));

      // Advance grain phases according to pitch ratio
      this.grainPhase1 += ratio;
      this.grainPhase2 += ratio;

      if (this.grainPhase1 >= gSize) {
        this.grainPhase1 -= gSize;
      }
      if (this.grainPhase2 >= gSize) {
        this.grainPhase2 -= gSize;
      }

      // Read grain 1
      const offset1 = Math.floor(this.grainPhase1);
      const readIdx1 = (this.writeIndex - offset1 + circLen) % circLen;
      const sample1 = this.circularBuffer[readIdx1] * this.grainWindow[offset1];

      // Read grain 2 (interleaved by half grain size)
      const offset2 = Math.floor(this.grainPhase2);
      const readIdx2 = (this.writeIndex - offset2 + circLen) % circLen;
      const sample2 = this.circularBuffer[readIdx2] * this.grainWindow[offset2];

      // Sum overlap
      output[i] = sample1 + sample2;

      this.writeIndex = (this.writeIndex + 1) % circLen;
    }
  }

  /**
   * 60fps Pitch & Key Detection Analysis Loop
   */
  private startPitchDetectionLoop() {
    let lastKeyCheck = performance.now();

    const loop = () => {
      if (!this.isRunning || !this.analyserNode) return;

      this.analyserNode.getFloatTimeDomainData(this.timeDataBuffer);
      const result = this.pitchDetector!.detect(this.timeDataBuffer);

      let targetHz = result.frequency;

      if (result.isVoiced && result.frequency > 50) {
        this.lastVoicedTime = performance.now();
        this.lastPitchHz = result.frequency;

        // Feed pitch frame to Key Detector
        const currentMidi = freqToMidi(result.frequency);
        this.keyDetector!.addPitchFrame(currentMidi, result.clarity, result.volume);

        // Calculate Target Frequency in current active scale
        const effectiveRoot = this.settings.keyRoot;
        const effectiveScale = this.settings.scaleType;

        const snapInfo = findClosestScaleNote(result.frequency, effectiveRoot, effectiveScale);
        targetHz = snapInfo.targetFreq;
        this.lastTargetHz = targetHz;

        if (this.settings.enabled) {
          // Calculate pitch ratio
          // shiftRatio = targetFreq / currentFreq
          const rawRatio = targetHz / result.frequency;
          // Apply strength scaling
          const strength = this.settings.strength / 100;
          this.targetPitchRatio = Math.pow(rawRatio, strength);
        } else {
          this.targetPitchRatio = 1.0;
        }
      } else {
        // Unvoiced / Silence: relax towards 1.0 (no shift)
        if (performance.now() - this.lastVoicedTime > 150) {
          this.targetPitchRatio = 1.0;
        }
      }

      // Notify pitch update callback
      if (this.onPitchUpdate) {
        this.onPitchUpdate(result, targetHz);
      }

      // Periodically update Key Detection (every 250ms)
      const now = performance.now();
      if (now - lastKeyCheck > 250) {
        lastKeyCheck = now;
        const keyResult = this.keyDetector!.estimateKey();
        if (this.onKeyUpdate) {
          this.onKeyUpdate(keyResult);
        }

        // Auto Key Tracking: If active and confident, update active key root & mode!
        if (
          this.settings.autoKeyTracking &&
          keyResult.estimatedKey &&
          keyResult.estimatedKey.confidence >= 55 &&
          keyResult.totalVoicedFrames >= 40
        ) {
          this.settings.keyRoot = keyResult.estimatedKey.root;
          this.settings.scaleType = keyResult.estimatedKey.mode;
        }
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  // --- Controls & Settings API ---

  public updateSettings(newSettings: Partial<AutoTuneSettings>) {
    const oldBufferSize = this.settings.latency?.bufferSize;
    this.settings = {
      ...this.settings,
      ...newSettings,
      compressor: {
        ...this.settings.compressor,
        ...(newSettings.compressor || {}),
      },
      latency: {
        ...this.settings.latency,
        ...(newSettings.latency || {}),
      },
    };

    if (newSettings.pitchRange && this.pitchDetector) {
      this.pitchDetector.setVocalRange(newSettings.pitchRange);
    }

    if (newSettings.compressor) {
      this.updateCompressorSettings();
    }

    if (newSettings.latency?.compensationMs !== undefined && this.latencyDelayNode && this.audioCtx) {
      const delaySec = Math.max(0, newSettings.latency.compensationMs / 1000);
      this.latencyDelayNode.delayTime.setValueAtTime(delaySec, this.audioCtx.currentTime);
    }

    // If bufferSize changed and engine is active, adapt processor node
    if (
      newSettings.latency?.bufferSize &&
      newSettings.latency.bufferSize !== oldBufferSize &&
      this.isRunning &&
      this.audioCtx
    ) {
      this.recreateProcessor(newSettings.latency.bufferSize);
    }

    this.updateGains();
  }

  private recreateProcessor(bufferSize: number) {
    if (!this.audioCtx || !this.compressorNode || !this.wetGainNode) return;
    try {
      if (this.processorNode) {
        this.processorNode.disconnect();
      }
      this.processorNode = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);
      this.processorNode.onaudioprocess = (e) => this.processAudio(e);
      this.compressorNode.connect(this.processorNode);
      this.processorNode.connect(this.wetGainNode);
    } catch (e) {
      console.warn('Error adapting audio processor buffer size:', e);
    }
  }

  public static async getAvailableDevices(): Promise<{ inputs: AudioDeviceOption[]; outputs: AudioDeviceOption[] }> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return { inputs: [], outputs: [] };
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs: AudioDeviceOption[] = [];
      const outputs: AudioDeviceOption[] = [];

      devices.forEach((dev) => {
        if (dev.kind === 'audioinput') {
          inputs.push({
            deviceId: dev.deviceId,
            label: dev.label || `Micrófono (${inputs.length + 1})`,
            groupId: dev.groupId,
          });
        } else if (dev.kind === 'audiooutput') {
          outputs.push({
            deviceId: dev.deviceId,
            label: dev.label || `Salida / Auriculares (${outputs.length + 1})`,
            groupId: dev.groupId,
          });
        }
      });
      return { inputs, outputs };
    } catch (err) {
      console.warn('Error enumerating audio devices:', err);
      return { inputs: [], outputs: [] };
    }
  }

  public async setInputDevice(deviceId: string): Promise<boolean> {
    this.settings.inputDeviceId = deviceId;
    if (this.isRunning && this.audioCtx) {
      try {
        if (this.micStream) {
          this.micStream.getTracks().forEach((t) => t.stop());
        }
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (this.sourceNode) {
          this.sourceNode.disconnect();
        }
        this.sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
        this.sourceNode.connect(this.filterHighPass!);
        return true;
      } catch (err) {
        console.error('Error switching microphone device:', err);
        return false;
      }
    }
    return true;
  }

  public async setOutputDevice(deviceId: string): Promise<boolean> {
    this.settings.outputDeviceId = deviceId;
    if (this.audioCtx && 'setSinkId' in this.audioCtx) {
      try {
        await (this.audioCtx as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
        return true;
      } catch (err) {
        console.warn('Could not set output device sinkId:', err);
        return false;
      }
    }
    return true;
  }

  public async measureLoopbackLatency(): Promise<number> {
    if (!this.audioCtx) return 32;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.35, this.audioCtx.currentTime + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const startTime = performance.now();
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.04);

      return new Promise<number>((resolve) => {
        let resolved = false;
        const checkStart = performance.now();
        const interval = setInterval(() => {
          if (!this.analyserNode || !this.isRunning) {
            clearInterval(interval);
            if (!resolved) {
              resolved = true;
              resolve(Math.round(performance.now() - startTime));
            }
            return;
          }

          const freqData = new Uint8Array(this.analyserNode.frequencyBinCount);
          this.analyserNode.getByteFrequencyData(freqData);
          const binIndex = Math.round((1400 / (this.audioCtx?.sampleRate || 44100)) * this.analyserNode.fftSize);
          let energy = 0;
          for (let b = Math.max(0, binIndex - 4); b <= Math.min(freqData.length - 1, binIndex + 4); b++) {
            if (freqData[b] > energy) energy = freqData[b];
          }

          if (energy > 115 || performance.now() - checkStart > 400) {
            clearInterval(interval);
            if (!resolved) {
              resolved = true;
              const elapsed = Math.round(performance.now() - startTime);
              resolve(energy > 115 ? Math.min(250, Math.max(12, elapsed)) : 35);
            }
          }
        }, 5);
      });
    } catch (err) {
      console.warn('Latency test fallback:', err);
      return 32;
    }
  }

  public getSettings(): AutoTuneSettings {
    return { ...this.settings };
  }

  public resetKeyHistory() {
    if (this.keyDetector) {
      this.keyDetector.reset();
    }
  }

  // --- Reference Drone / Acoustic Pitch Anchor ---

  public playReferenceChord(root: NoteName, mode: 'major' | 'minor' | 'drone' = 'major') {
    if (!this.audioCtx) return;
    this.stopReferenceChord();

    const rootIdx = NOTE_NAMES.indexOf(root);
    // Base octave 3 (middle voice)
    const rootMidi = 48 + rootIdx; // C3 is 48
    let notesToPlay: number[] = [];

    if (mode === 'major') {
      notesToPlay = [rootMidi, rootMidi + 4, rootMidi + 7, rootMidi + 12];
    } else if (mode === 'minor') {
      notesToPlay = [rootMidi, rootMidi + 3, rootMidi + 7, rootMidi + 12];
    } else {
      // Pure root + fifth drone
      notesToPlay = [rootMidi - 12, rootMidi, rootMidi + 7];
    }

    this.droneGain = this.audioCtx.createGain();
    this.droneGain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
    this.droneGain.gain.exponentialRampToValueAtTime(0.12, this.audioCtx.currentTime + 0.5);
    this.droneGain.connect(this.audioCtx.destination);

    this.droneOscillators = notesToPlay.map((midi, i) => {
      const osc = this.audioCtx!.createOscillator();
      // Warm warm triangle and sine blend
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
      osc.connect(this.droneGain!);
      osc.start();
      return osc;
    });
  }

  public stopReferenceChord() {
    if (this.droneGain && this.audioCtx) {
      this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, this.audioCtx.currentTime);
      this.droneGain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.3);
      setTimeout(() => {
        this.droneOscillators.forEach((osc) => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {
            // Already stopped
          }
        });
        this.droneOscillators = [];
        this.droneGain = null;
      }, 350);
    }
  }

  // --- Voice Recording ---

  public startRecording(): boolean {
    if (!this.recordDestination) return false;
    try {
      this.recordedChunks = [];
      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
      }

      this.mediaRecorder = new MediaRecorder(this.recordDestination.stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const mime = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mime });
        const url = URL.createObjectURL(blob);
        if (this.onRecordingComplete) {
          this.onRecordingComplete(blob, url);
        }
      };

      this.mediaRecorder.start(100);
      return true;
    } catch (err) {
      console.error('Error starting recording:', err);
      return false;
    }
  }

  public stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Returns the analyser node for real-time FFT frequency spectrum visualization
   */
  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  // --- Cleanup ---

  public stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.stopReferenceChord();
    this.stopRecording();

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
