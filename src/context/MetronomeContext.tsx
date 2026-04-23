import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

interface MetronomeState {
  bpm: number;
  isPlaying: boolean;
  timeSignature: number;
  subdivision: number;
  currentBeat: number;
  presets: number[];
}

interface MetronomeContextType {
  state: MetronomeState;
  setBpm: (bpm: number) => void;
  setTimeSignature: (ts: number) => void;
  setSubdivision: (sd: number) => void;
  setPresets: (p: number[]) => void;
  toggle: () => void;
  tap: () => void;
}

const MetronomeContext = createContext<MetronomeContextType | null>(null);

export function MetronomeProvider({ children }: { children: React.ReactNode }) {
  const [bpm, setBpmState] = useState(() => Number(localStorage.getItem('m_bpm')) || 120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = useState(4);
  const [subdivision, setSubdivision] = useState(1);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [presets, setPresets] = useState<number[]>(() => {
    const saved = localStorage.getItem('m_presets');
    return saved ? JSON.parse(saved) : [60, 72, 84, 96, 108, 120];
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const timerIDRef = useRef<number | null>(null);
  const beatRef = useRef(0);
  
  // Refs for scheduler to avoid stale closures
  const bpmRef = useRef(bpm);
  const isPlayingRef = useRef(isPlaying);
  const tsRef = useRef(timeSignature);
  const sdRef = useRef(subdivision);

  useEffect(() => {
    if (isPlaying) {
      document.title = `▶ ${bpm} BPM - 쾌속 박자기`;
    } else {
      document.title = 'K2Sway Practice';
    }
  }, [isPlaying, bpm]);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { tsRef.current = timeSignature; }, [timeSignature]);
  useEffect(() => { sdRef.current = subdivision; }, [subdivision]);

  useEffect(() => {
    localStorage.setItem('m_presets', JSON.stringify(presets));
  }, [presets]);

  const setBpm = (val: number) => {
    const b = Math.min(Math.max(val, 20), 300);
    setBpmState(b);
    localStorage.setItem('m_bpm', b.toString());
  };

  const playClick = useCallback((time: number, beat: number) => {
    if (!audioCtxRef.current) return;
    const osc = audioCtxRef.current.createOscillator();
    const envelope = audioCtxRef.current.createGain();

    const isBarStart = (beat % (tsRef.current * sdRef.current)) === 0;
    const isBeatStart = (beat % sdRef.current) === 0;
    
    // Sound hierarchy: Higher freq for bar start, mid for beats, low for subdivisions
    if (isBarStart) {
      osc.frequency.value = 1200;
    } else if (isBeatStart) {
      osc.frequency.value = 800;
    } else {
      osc.frequency.value = 500;
    }

    // Tighter envelope for fast BPM
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(1, time + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    osc.connect(envelope);
    envelope.connect(audioCtxRef.current.destination);

    osc.start(time);
    osc.stop(time + 0.04);
  }, []);

  const scheduler = useCallback(() => {
    if (!audioCtxRef.current || !isPlayingRef.current) return;

    // Lookahead: schedule notes that play within the next 0.2s
    // 200ms lookahead with 25ms interval is a safe industry standard
    while (nextNoteTimeRef.current < audioCtxRef.current.currentTime + 0.2) {
      const scheduledTime = nextNoteTimeRef.current;
      const beatValue = beatRef.current;
      
      playClick(scheduledTime, beatValue);
      
      const secondsPerBeat = 60.0 / bpmRef.current / sdRef.current;
      nextNoteTimeRef.current += secondsPerBeat;

      // Sync Visuals
      const userLatencyMs = Number(localStorage.getItem('m_latency')) || 0;
      // Calculate delay from 'now' to 'scheduledTime' plus user correction
      const currentTime = audioCtxRef.current.currentTime;
      const totalDelayMs = Math.max(0, ((scheduledTime - currentTime) * 1000) + userLatencyMs);

      setTimeout(() => {
        if (!isPlayingRef.current) return;
        const totalBarBeats = tsRef.current * sdRef.current;
        setCurrentBeat(beatValue % totalBarBeats);
      }, totalDelayMs);

      beatRef.current++;
    }
    timerIDRef.current = window.setTimeout(scheduler, 25);
  }, [playClick]);

  const start = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

    setIsPlaying(true);
    isPlayingRef.current = true;
    // Start slightly in the future to avoid scheduling into the past
    nextNoteTimeRef.current = audioCtxRef.current.currentTime + 0.05;
    beatRef.current = 0;
    scheduler();

    // Use Media Session API for status bar control
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Metronome - ${bpmRef.current} BPM`,
        artist: 'K2Sway Practice',
        album: 'Rehearsal Tools'
      });
      navigator.mediaSession.setActionHandler('pause', stop);
    }
  }, [scheduler]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (timerIDRef.current) clearTimeout(timerIDRef.current);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) stop(); else start();
  }, [isPlaying, start, stop]);

  const tapTimesRef = useRef<number[]>([]);
  const tap = useCallback(() => {
    const now = performance.now();
    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > 5) tapTimesRef.current.shift();
    if (tapTimesRef.current.length > 1) {
      const diffs = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) diffs.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      const avg = diffs.reduce((a, b) => a + b) / diffs.length;
      setBpm(Math.round(60000 / avg));
    }
  }, []);

  return (
    <MetronomeContext.Provider value={{
      state: { bpm, isPlaying, timeSignature, subdivision, currentBeat, presets },
      setBpm, setTimeSignature, setSubdivision, setPresets, toggle, tap
    }}>
      {children}
    </MetronomeContext.Provider>
  );
}

export const useMetronomeContext = () => {
  const ctx = useContext(MetronomeContext);
  if (!ctx) throw new Error('useMetronomeContext must be used within MetronomeProvider');
  return ctx;
};
