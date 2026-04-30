/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PitchDetector } from 'pitchy';
import { getNoteFromFrequency } from '../lib/pitchUtils.ts';

export type InstrumentType = 'chromatic' | 'guitar' | 'bass' | 'ukulele' | 'violin' | 'cello';

export interface TuningProfile {
  id: string;
  name: string;
  nameKo: string;
  notes: string[];
}

export const INSTRUMENT_PROFILES: Record<InstrumentType, TuningProfile[]> = {
  chromatic: [{ id: 'chromatic', name: 'Chromatic', nameKo: '크로매틱', notes: [] }],
  guitar: [
    { id: 'guitar-std', name: 'Standard', nameKo: '기타 (표준)', notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
    { id: 'guitar-dropd', name: 'Drop D', nameKo: '기타 (드랍 D)', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
    { id: 'guitar-open-g', name: 'Open G', nameKo: '기타 (오픈 G)', notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
  ],
  bass: [
    { id: 'bass-4', name: '4-String', nameKo: '베이스 (4현)', notes: ['E1', 'A1', 'D2', 'G2'] },
    { id: 'bass-5', name: '5-String', nameKo: '베이스 (5현)', notes: ['B0', 'E1', 'A1', 'D2', 'G2'] },
  ],
  ukulele: [{ id: 'ukulele', name: 'Standard', nameKo: '우쿨렐레', notes: ['G4', 'C4', 'E4', 'A4'] }],
  violin: [{ id: 'violin', name: 'Standard', nameKo: '바이올린', notes: ['G3', 'D4', 'A4', 'E5'] }],
  cello: [{ id: 'cello', name: 'Standard', nameKo: '첼로', notes: ['C2', 'G2', 'D3', 'A3'] }],
};

export function useTuner(referencePitch: number = 440, profileId: string = 'chromatic') {
  const [pitchData, setPitchData] = useState<{
    name: string;
    octave: number;
    cents: number;
    frequency: number;
    clarity: number;
    nearestTarget?: string;
  } | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  // Smoothing buffers for Advanced DSP
  const freqBufferRef = useRef<number[]>([]);
  const centsBufferRef = useRef<number[]>([]);
  const stableFreqRef = useRef(0);
  const octaveJumpCountRef = useRef(0);
  const lastNoteNameRef = useRef<string>('');
  const notePersistenceCountRef = useRef(0);
  const silenceCountRef = useRef(0);
  const lastProcessedAtRef = useRef(0);
  const hasLockedRef = useRef(false);
  const lowEnergyHoldFramesRef = useRef(0);
  const lastStrongFreqRef = useRef(0);

  const isActiveRef = useRef(false);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
    }
    if (oscillatorRef.current && gainRef.current && audioContextRef.current) {
        const g = gainRef.current;
        g.gain.cancelScheduledValues(audioContextRef.current.currentTime);
        g.gain.setValueAtTime(g.gain.value, audioContextRef.current.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.05);
        oscillatorRef.current.stop(audioContextRef.current.currentTime + 0.05);
        oscillatorRef.current = null;
        gainRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
    }
    setIsActive(false);
    setPitchData(null);
    
    // Reset buffers
    freqBufferRef.current = [];
    stableFreqRef.current = 0;
    octaveJumpCountRef.current = 0;
    lastProcessedAtRef.current = 0;
    hasLockedRef.current = false;
    lowEnergyHoldFramesRef.current = 0;
    lastStrongFreqRef.current = 0;

    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }, []);

  const start = useCallback(async () => {
    if (isActiveRef.current) return;
    setIsActive(true); 
    isActiveRef.current = true;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1
        }
      });
      streamRef.current = stream;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      await audioContextRef.current.resume();

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048; // Lower latency while keeping enough resolution

      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      const detector = PitchDetector.forFloat32Array(analyserRef.current.fftSize);
      const input = new Float32Array(analyserRef.current.fftSize);

      const savedSensitivity = Number(localStorage.getItem('tuner_sensitivity'));
      const currentSensitivity = Number.isFinite(savedSensitivity)
        ? Math.min(0.95, Math.max(0.15, savedSensitivity))
        : 0.25;
      const processIntervalMs = Math.min(36, Math.max(10, Number(localStorage.getItem('tuner_process_interval_ms')) || 20));

      const updatePitch = () => {
        if (!isActiveRef.current || !analyserRef.current || !audioContextRef.current) return;
        
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
        const now = performance.now();
        if (now - lastProcessedAtRef.current < processIntervalMs) {
          animationFrameRef.current = requestAnimationFrame(updatePitch);
          return;
        }
        lastProcessedAtRef.current = now;

        analyserRef.current.getFloatTimeDomainData(input);
        const [pitch, clarity] = detector.findPitch(input, audioContextRef.current.sampleRate);
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        const clarityGate = rms > 0.015 ? Math.max(0.08, currentSensitivity * 0.6) : currentSensitivity;
        const isLowEnergy = rms < 0.01;

        if (clarity > clarityGate && pitch > 20 && pitch < 2500) {
          silenceCountRef.current = 0;
          if (isLowEnergy && hasLockedRef.current) {
            lowEnergyHoldFramesRef.current++;
            if (lowEnergyHoldFramesRef.current <= 8) {
              animationFrameRef.current = requestAnimationFrame(updatePitch);
              return;
            }
          } else {
            lowEnergyHoldFramesRef.current = 0;
          }

          // 1. Harmonic Rejection (Octave Error Correction)
          if (stableFreqRef.current > 0) {
            const ratio = pitch / stableFreqRef.current;
            // Check for +/- 1 octave jump (+/- 5% tolerance)
            if ((ratio > 1.90 && ratio < 2.10) || (ratio > 0.45 && ratio < 0.55)) {
              octaveJumpCountRef.current++;
              // Ignore spurious octave jumps for up to 8 frames (~130ms)
              if (octaveJumpCountRef.current < 8) {
                animationFrameRef.current = requestAnimationFrame(updatePitch);
                return;
              }
            } else {
              octaveJumpCountRef.current = 0;
            }

            // Additional jump rejection when clarity drops:
            // prefer previous strong fundamental over sudden candidate flips.
            const largeJump = ratio > 1.35 || ratio < 0.74;
            if (largeJump && clarity < currentSensitivity + 0.08 && !isLowEnergy) {
              animationFrameRef.current = requestAnimationFrame(updatePitch);
              return;
            }
          }

          // 2. Median Filter (Size 5)
          freqBufferRef.current.push(pitch);
          if (freqBufferRef.current.length > 5) freqBufferRef.current.shift();
          
          let medianPitch = pitch;
          if (freqBufferRef.current.length >= 3) {
            const sorted = [...freqBufferRef.current].sort((a, b) => a - b);
            medianPitch = sorted[Math.floor(sorted.length / 2)];
          }

          // 3. Exponential Moving Average (EMA)
          // If jump is huge (not an octave), snap immediately. Otherwise smooth it.
          if (stableFreqRef.current === 0 || Math.abs(stableFreqRef.current - medianPitch) > stableFreqRef.current * 0.1) {
            stableFreqRef.current = medianPitch;
          } else {
            // Alpha = 0.2 means slower/smoother needle movement
            stableFreqRef.current = stableFreqRef.current * 0.8 + medianPitch * 0.2;
          }

          const smoothPitch = stableFreqRef.current;
          const note = getNoteFromFrequency(smoothPitch, referencePitch);

          // 4. Hysteresis (Note Stability)
          if (note.name === lastNoteNameRef.current) {
            notePersistenceCountRef.current++;
          } else {
            lastNoteNameRef.current = note.name;
            notePersistenceCountRef.current = 0;
          }

          // Fast first lock, then normal hysteresis
          const requiredPersistence = hasLockedRef.current ? 1 : 0;
          if (notePersistenceCountRef.current >= requiredPersistence) {
            hasLockedRef.current = true;
            lastStrongFreqRef.current = smoothPitch;
            centsBufferRef.current.push(note.cents);
            if (centsBufferRef.current.length > 3) centsBufferRef.current.shift();
            const smoothCents = Math.round(centsBufferRef.current.reduce((a, b) => a + b) / centsBufferRef.current.length);
            
            setPitchData({ ...note, cents: smoothCents, clarity });
          }
        } else {
          // Reset tracker if silent for too long (approx 500ms)
          silenceCountRef.current++;
          if (silenceCountRef.current > 30) {
            stableFreqRef.current = 0;
            freqBufferRef.current = [];
            notePersistenceCountRef.current = 0;
            hasLockedRef.current = false;
            lowEnergyHoldFramesRef.current = 0;
            lastStrongFreqRef.current = 0;
          }
        }
        
        animationFrameRef.current = requestAnimationFrame(updatePitch);
      };

      updatePitch();
      isActiveRef.current = true;
      setIsActive(true);
      setError(null);

      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'playing';
          if ('MediaMetadata' in window) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: '악기 튜너 작동 중',
              artist: 'K2Sway Music Tools',
              album: '마이크 활성화됨'
            });
          }
          navigator.mediaSession.setActionHandler('pause', stop);
        } catch {
          // Some mobile WebViews partially implement MediaSession.
        }
      }
    } catch (err) {
      setError('마이크 권한이 필요합니다.');
      setIsActive(false);
      isActiveRef.current = false;
    }
  }, [referencePitch]);

  const startTone = useCallback((frequency: number) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();

    stopTone();

    const osc = audioContextRef.current.createOscillator();
    const g = audioContextRef.current.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    g.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    g.gain.linearRampToValueAtTime(0.3, audioContextRef.current.currentTime + 0.1);
    
    osc.connect(g);
    g.connect(audioContextRef.current.destination);
    osc.start();
    
    oscillatorRef.current = osc;
    gainRef.current = g;
  }, []);

  const stopTone = useCallback(() => {
    if (oscillatorRef.current && gainRef.current && audioContextRef.current) {
      const g = gainRef.current;
      g.gain.cancelScheduledValues(audioContextRef.current.currentTime);
      g.gain.setValueAtTime(g.gain.value, audioContextRef.current.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.2);
      oscillatorRef.current.stop(audioContextRef.current.currentTime + 0.2);
      oscillatorRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
      stopTone();
    };
  }, [stopTone, stop]);

  return { pitchData, isActive, start, stop, error, startTone, stopTone };
}
