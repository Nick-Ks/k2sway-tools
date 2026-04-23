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

  // Smoothing buffers
  const freqBufferRef = useRef<number[]>([]);
  const lastFreqRef = useRef(0);

  const isActiveRef = useRef(false);

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
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsActive(false);
    setPitchData(null);
    freqBufferRef.current = [];
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

      // Much lower sensitivity for voices
      const sensitivity = Number(localStorage.getItem('vocal_sensitivity')) || 0.40;

      const updatePitch = () => {
        if (!isActiveRef.current || !analyserRef.current || !audioContextRef.current) return;
        
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }

        analyserRef.current.getFloatTimeDomainData(input);
        const [pitch, clarity] = detector.findPitch(input, audioContextRef.current.sampleRate);

        // Calculate Volume Level
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        const lvl = Math.min(1, rms * 15); // Boost volume visual response

        if (clarity > sensitivity && pitch > 50 && pitch < 1200) {
          freqBufferRef.current.push(pitch);
          if (freqBufferRef.current.length > 5) freqBufferRef.current.shift();
          const avgPitch = freqBufferRef.current.reduce((a, b) => a + b) / freqBufferRef.current.length;

          // Stability: update UI only if frequency change is significant (> 1Hz)
          if (Math.abs(avgPitch - lastFreqRef.current) > 1) {
            const note = getNoteFromFrequency(avgPitch, referencePitch);
            setPitchData({ ...note, clarity, lvl });
            setHistory(prev => [...prev.slice(-49), avgPitch]);
            lastFreqRef.current = avgPitch;
          } else if (pitchData) {
            // Update Volume even if frequency hasn't moved much
            setPitchData(p => p ? { ...p, lvl } : null);
          }
        } else {
          // If no pitch detected, still update volume if needed or clear
          setPitchData(p => p ? { ...p, lvl } : null);
        }

        animationFrameRef.current = requestAnimationFrame(updatePitch);
      };

      updatePitch();
      setIsActive(true);
      setError(null);
    } catch (err) {
      setError('마이크 권한이 필요합니다.');
      setIsActive(false);
      isActiveRef.current = false;
    }
  }, []);

  // Tone generation for reference notes (Sustain support)
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

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
  }, []);

  return { pitchData, history, isActive, start, stop, error, startReferenceNote, stopReferenceNote };
}
