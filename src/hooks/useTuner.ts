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

  // Settings
  const sensitivity = Number(localStorage.getItem('tuner_sensitivity')) || 0.85;

  // Buffer for smoothing
  const centsBufferRef = useRef<number[]>([]);
  const frequencyBufferRef = useRef<number[]>([]);
  const lastNoteNameRef = useRef<string>('');
  const notePersistenceCountRef = useRef(0);

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
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        if (!oscillatorRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
    }
    setIsActive(false);
    setPitchData(null);
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

      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      const detector = PitchDetector.forFloat32Array(analyserRef.current.fftSize);
      const input = new Float32Array(analyserRef.current.fftSize);

      // Much lower sensitivity for better responsiveness
      const currentSensitivity = Number(localStorage.getItem('tuner_sensitivity')) || 0.45;

      const updatePitch = () => {
        if (!isActiveRef.current || !analyserRef.current || !audioContextRef.current) return;
        
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }

        analyserRef.current.getFloatTimeDomainData(input);
        const [pitch, clarity] = detector.findPitch(input, audioContextRef.current.sampleRate);

        if (clarity > currentSensitivity && pitch > 30 && pitch < 2000) {
          frequencyBufferRef.current.push(pitch);
          if (frequencyBufferRef.current.length > 3) frequencyBufferRef.current.shift();
          const smoothPitch = frequencyBufferRef.current.reduce((a, b) => a + b) / frequencyBufferRef.current.length;
          const note = getNoteFromFrequency(smoothPitch, referencePitch);

          if (note.name === lastNoteNameRef.current) {
            notePersistenceCountRef.current++;
          } else {
            lastNoteNameRef.current = note.name;
            notePersistenceCountRef.current = 0;
          }

          if (notePersistenceCountRef.current >= 1) {
            centsBufferRef.current.push(note.cents);
            if (centsBufferRef.current.length > 5) centsBufferRef.current.shift();
            const smoothCents = Math.round(centsBufferRef.current.reduce((a, b) => a + b) / centsBufferRef.current.length);
            setPitchData({ ...note, cents: smoothCents, clarity });
          }
        }
        animationFrameRef.current = requestAnimationFrame(updatePitch);
      };

      updatePitch();
      isActiveRef.current = true;
      setIsActive(true);
      setError(null);
    } catch (err) {
      setError('마이크 권한이 필요합니다.');
      setIsActive(false);
      isActiveRef.current = false;
    }
  }, []);

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
  }, [stopTone]);

  return { pitchData, isActive, start, stop, error, startTone, stopTone };
}
