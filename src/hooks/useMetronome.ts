/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export function useMetronome() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpmState] = useState(() => Number(localStorage.getItem('metronome_bpm')) || 120);
  const [timeSignature, setTimeSignature] = useState(4);
  const [subdivision, setSubdivision] = useState(1);
  const [currentBeat, setCurrentBeat] = useState(0);

  // Use Ref to allow the scheduler to read fresh values without being recreated
  const bpmRef = useRef(bpm);
  const isPlayingRef = useRef(isPlaying);
  bpmRef.current = bpm;
  isPlayingRef.current = isPlaying;

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const timerIDRef = useRef<number | null>(null);
  const beatRef = useRef(0);

  const lookahead = 25.0; 
  const scheduleAheadTime = 0.1;

  const setBpm = (newBpm: number) => {
    const val = Math.min(Math.max(newBpm, 20), 300);
    setBpmState(val);
    localStorage.setItem('metronome_bpm', val.toString());
  };

  const playClick = useCallback((time: number, beat: number) => {
    if (!audioContextRef.current) return;

    const osc = audioContextRef.current.createOscillator();
    const envelope = audioContextRef.current.createGain();

    const isFirstBeat = (beat % timeSignature) === 0;
    osc.frequency.value = isFirstBeat ? 1200 : 800;

    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(envelope);
    envelope.connect(audioContextRef.current.destination);

    osc.start(time);
    osc.stop(time + 0.1);
  }, [timeSignature]);

  const scheduler = useCallback(() => {
    if (!audioContextRef.current || !isPlayingRef.current) return;

    while (nextNoteTimeRef.current < audioContextRef.current.currentTime + scheduleAheadTime) {
      playClick(nextNoteTimeRef.current, beatRef.current);

      const secondsPerBeat = 60.0 / bpmRef.current / subdivision;
      nextNoteTimeRef.current += secondsPerBeat;

      // Update UI state
      const currentBeatVal = beatRef.current;
      setCurrentBeat(currentBeatVal % (timeSignature * subdivision));
      beatRef.current++;
    }

    timerIDRef.current = window.setTimeout(scheduler, lookahead);
  }, [playClick, subdivision, timeSignature]);

  const start = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    setIsPlaying(true);
    isPlayingRef.current = true;
    nextNoteTimeRef.current = audioContextRef.current.currentTime;
    beatRef.current = 0;
    scheduler();
  }, [scheduler]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (timerIDRef.current) {
      clearTimeout(timerIDRef.current);
    }
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else start();
  }, [isPlaying, start, stop]);

  const tapTimesRef = useRef<number[]>([]);
  const tap = useCallback(() => {
    const now = performance.now();
    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > 5) tapTimesRef.current.shift();

    if (tapTimesRef.current.length > 1) {
      const diffs = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        diffs.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      const avg = diffs.reduce((a, b) => a + b) / diffs.length;
      setBpm(Math.round(60000 / avg));
    }
  }, []);

  return {
    isPlaying,
    bpm,
    setBpm,
    timeSignature,
    setTimeSignature,
    subdivision,
    setSubdivision,
    currentBeat,
    toggle,
    tap
  };
}
