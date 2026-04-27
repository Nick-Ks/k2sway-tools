/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PitchDetector } from 'pitchy';
import { getNoteFromFrequency } from '../lib/pitchUtils.ts';

export function usePitchCheck(referencePitch: number = 440) {
  const [pitchData, setPitchData] = useState<{
    name: string;
    octave: number;
    cents: number;
    frequency: number;
    clarity: number;
    lvl: number;
  } | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Smoothing buffers for Advanced DSP
  const freqBufferRef = useRef<number[]>([]);
  const stableFreqRef = useRef(0);
  const octaveJumpCountRef = useRef(0);
  const lastNoteNameRef = useRef<string>('');
  const notePersistenceCountRef = useRef(0);
  const silenceCountRef = useRef(0);
  const lastProcessedAtRef = useRef(0);
  const detectedFramesRef = useRef(0);
  const hasLockedRef = useRef(false);

  const isActiveRef = useRef(false);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (gainRef.current) {
        gainRef.current.disconnect();
        gainRef.current = null;
      }
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsActive(false);
    setPitchData(null);
    
    freqBufferRef.current = [];
    stableFreqRef.current = 0;
    octaveJumpCountRef.current = 0;
    lastProcessedAtRef.current = 0;
    detectedFramesRef.current = 0;
    hasLockedRef.current = false;

    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }, []);

  const start = useCallback(async () => {
    if (isActiveRef.current) return;
    setIsActive(true); 
    isActiveRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      await audioContextRef.current.resume();

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const detector = PitchDetector.forFloat32Array(analyserRef.current.fftSize);
      const input = new Float32Array(analyserRef.current.fftSize);

      const savedSensitivity = Number(localStorage.getItem('vocal_sensitivity'));
      const sensitivity = Number.isFinite(savedSensitivity)
        ? Math.min(0.95, Math.max(0.1, savedSensitivity))
        : 0.22;
      const processIntervalMs = Math.min(36, Math.max(12, Number(localStorage.getItem('vocal_process_interval_ms')) || 22));

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

        // Calculate Volume Level
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        const lvl = Math.min(1, rms * 15); // Boost volume visual response

        if (clarity > sensitivity && pitch > 50 && pitch < 1200) {
          silenceCountRef.current = 0;

          // 1. Harmonic Rejection
          if (stableFreqRef.current > 0) {
            const ratio = pitch / stableFreqRef.current;
            if ((ratio > 1.90 && ratio < 2.10) || (ratio > 0.45 && ratio < 0.55)) {
              octaveJumpCountRef.current++;
              // Vocals can have stronger harmonics, reject up to 10 frames (~160ms)
              if (octaveJumpCountRef.current < 10) {
                animationFrameRef.current = requestAnimationFrame(updatePitch);
                return;
              }
            } else {
              octaveJumpCountRef.current = 0;
            }
          }

          // 2. Median Filter
          freqBufferRef.current.push(pitch);
          if (freqBufferRef.current.length > 5) freqBufferRef.current.shift();
          
          let medianPitch = pitch;
          if (freqBufferRef.current.length >= 3) {
            const sorted = [...freqBufferRef.current].sort((a, b) => a - b);
            medianPitch = sorted[Math.floor(sorted.length / 2)];
          }

          // 3. EMA Smoothing (Slower for Vocals to prevent twitching)
          if (stableFreqRef.current === 0 || Math.abs(stableFreqRef.current - medianPitch) > stableFreqRef.current * 0.1) {
            stableFreqRef.current = medianPitch;
          } else {
            // Alpha = 0.15 for even smoother vocal tracking
            stableFreqRef.current = stableFreqRef.current * 0.85 + medianPitch * 0.15;
          }

          const smoothPitch = stableFreqRef.current;
          const note = getNoteFromFrequency(smoothPitch, referencePitch);

          // 4. Hysteresis
          if (note.name === lastNoteNameRef.current) {
            notePersistenceCountRef.current++;
          } else {
            lastNoteNameRef.current = note.name;
            notePersistenceCountRef.current = 0;
          }
          detectedFramesRef.current++;
          const requiredPersistence = hasLockedRef.current ? 1 : 0;
          if (notePersistenceCountRef.current >= requiredPersistence) {
            hasLockedRef.current = true;
            setPitchData({ ...note, clarity, lvl });
            setHistory(prev => [...prev.slice(-49), smoothPitch]);
          } else if (hasLockedRef.current) {
            // Update Volume even if note hasn't switched yet
            setPitchData(p => p ? { ...p, lvl } : null);
          }
        } else {
          // If no pitch detected, still update volume if needed or clear
          setPitchData(p => p ? { ...p, lvl } : null);
          
          silenceCountRef.current++;
          if (silenceCountRef.current > 30) {
            stableFreqRef.current = 0;
            freqBufferRef.current = [];
            notePersistenceCountRef.current = 0;
            detectedFramesRef.current = 0;
            hasLockedRef.current = false;
          }
        }

        animationFrameRef.current = requestAnimationFrame(updatePitch);
      };

      updatePitch();
      setIsActive(true);
      setError(null);

      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'playing';
          if ('MediaMetadata' in window) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: '보컬 피치 분석 중',
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
  }, [referencePitch, stop]);

  // Tone generation for reference notes (Sustain support)

  const startReferenceNote = useCallback((frequency: number) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();

    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
    }

    const osc = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();
    gainRef.current = gain;
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    
    gain.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioContextRef.current.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(audioContextRef.current.destination);
    osc.start();
    oscillatorRef.current = osc;
  }, []);

  const stopReferenceNote = useCallback(() => {
    if (oscillatorRef.current && gainRef.current && audioContextRef.current) {
      const g = gainRef.current;
      g.gain.cancelScheduledValues(audioContextRef.current.currentTime);
      g.gain.setValueAtTime(g.gain.value, audioContextRef.current.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.3);
      oscillatorRef.current.stop(audioContextRef.current.currentTime + 0.3);
      oscillatorRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
      if (oscillatorRef.current) oscillatorRef.current.stop();
    };
  }, [stop]);

  return { pitchData, history, isActive, start, stop, error, startReferenceNote, stopReferenceNote };
}
