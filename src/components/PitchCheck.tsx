import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Star, Heart, Volume2, Music, ChevronDown, ChevronUp } from 'lucide-react';
import { usePitchCheck } from '../hooks/usePitchCheck.ts';
import { cn } from '../lib/utils.ts';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [2, 3, 4, 5];

export default function PitchCheck() {
  const [selectedOctave, setSelectedOctave] = useState(4);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(0);
  const [isRefOpen, setIsRefOpen] = useState(false);
  const [refPitch] = useState(() => Number(localStorage.getItem('m_ref_freq')) || 440);
  
  const { 
    pitchData, 
    history, 
    isActive, 
    start, 
    stop, 
    startReferenceNote, 
    stopReferenceNote 
  } = usePitchCheck(refPitch);

  const [vocalRange, setVocalRange] = useState<{ 
    low: { name: string, oct: number, freq: number }, 
    high: { name: string, oct: number, freq: number } 
  } | null>(null);

  React.useEffect(() => {
    if (pitchData && pitchData.clarity > 0.6) {
      const midi = (pitchData.octave + 1) * 12 + NOTES.indexOf(pitchData.name);
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      
      setVocalRange(prev => {
        if (!prev) return { low: { ...pitchData, freq }, high: { ...pitchData, freq } };
        
        const newRange = { ...prev };
        const lowMidi = (prev.low.oct + 1) * 12 + NOTES.indexOf(prev.low.name);
        const highMidi = (prev.high.oct + 1) * 12 + NOTES.indexOf(prev.high.name);
        
        if (midi < lowMidi) newRange.low = { ...pitchData, freq };
        if (midi > highMidi) newRange.high = { ...pitchData, freq };
        
        return newRange;
      });
    }
  }, [pitchData]);

  const toggle = () => {
    if (isActive) stop();
    else start();
  };

  const handlePointerDown = (noteIdx: number) => {
    setSelectedNoteIndex(noteIdx);
    const midi = (selectedOctave + 1) * 12 + noteIdx;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    startReferenceNote(freq);
  };

  const handlePointerUp = () => {
    stopReferenceNote();
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stop();
      stopReferenceNote();
    };
  }, [stop, stopReferenceNote]);

  const cents = pitchData?.cents || 0;
  const noteName = pitchData?.name || '-';
  const octave = pitchData?.octave !== undefined ? pitchData.octave : '';
  const inTune = Math.abs(cents) <= 8;

  return (
    <div className="flex h-full flex-col p-6 overflow-hidden">
      {/* 1. Header */}
      <div className="flex flex-col gap-1 px-1 mb-6">
        <h2 className="text-sm font-semibold flex items-center gap-2 text-rose-400">
           <Heart size={16} fill="currentColor" /> 보컬 피치 체크
        </h2>
        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none">Vocal Pitch Analysis</p>
      </div>

      {/* 2. Settings Area - Collapsible Reference Tone */}
      <div className="bento-card mb-6 transition-all">
        <button 
          onClick={() => setIsRefOpen(!isRefOpen)}
          className="w-full flex justify-between items-center px-5 py-4 rounded-3xl hover:bg-slate-800/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Volume2 size={18} className="text-rose-400" />
            <span className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-100">Reference Tone</span>
          </div>
          {isRefOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
        </button>

        <AnimatePresence>
          {isRefOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 flex flex-col gap-5">
                <div className="flex gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-900">
                  {OCTAVES.map(o => (
                    <button
                      key={o}
                      onClick={() => setSelectedOctave(o)}
                      className={cn(
                        "flex-1 h-12 text-xs font-black rounded-xl transition-all border",
                        selectedOctave === o 
                          ? "bg-rose-500 text-white border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]" 
                          : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
                      )}
                    >
                      OCT {o}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {NOTES.map((n, i) => (
                    <button
                      key={n}
                      onPointerDown={() => handlePointerDown(i)}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                      className={cn(
                        "h-16 flex flex-col items-center justify-center rounded-[1.8rem] border transition-all active:scale-95 touch-none relative overflow-hidden",
                        selectedNoteIndex === i 
                          ? "bg-rose-500 border-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]" 
                          : "bg-slate-950 border-slate-900 text-slate-400 hover:bg-slate-800"
                      )}
                    >
                      <span className="text-sm font-black leading-none uppercase">{n}</span>
                      <span className="text-[9px] font-black opacity-40 uppercase mt-1.5">{selectedOctave}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Main Context Area */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden mb-6">
        {/* Monitor */}
        <div className={cn(
          "flex-1 flex flex-col justify-center items-center rounded-[3.5rem] border transition-all duration-700 relative overflow-hidden min-h-[300px]",
          isActive && inTune ? "bg-rose-500/[0.03] border-rose-500/30 shadow-[0_0_80px_rgba(244,63,94,0.05)_inset]" : "bg-slate-950 border-slate-900/50"
        )}>
          {/* Perfect Pitch Celebration Glow */}
          {isActive && pitchData && inTune && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-64 w-64 bg-rose-500/10 rounded-full blur-[80px] animate-pulse" />
            </div>
          )}
          {/* Analysis indicator */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-emerald-400 animate-pulse shadow-[0_0_10px_#10b981]" : "bg-slate-900")} />
            <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest leading-none">Vocal Tracking</span>
          </div>

          {/* Scrolling Scale */}
          <div className="w-full relative h-32 flex items-center justify-center overflow-hidden mb-4 px-4">
            {isActive && pitchData ? (
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Fixed Center Marker */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-rose-500 z-50 -translate-x-1/2 shadow-[0_0_15px_rgba(244,63,94,0.4)]" />

                {/* Notes Scale */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {(() => {
                    const currentMidi = (pitchData.octave + 1) * 12 + NOTES.indexOf(pitchData.name);
                    const notesToShow = [];
                    for (let i = -3; i <= 3; i++) notesToShow.push(currentMidi + i);

                    const mapCentsToX = (c: number) => {
                      const sign = Math.sign(c);
                      const absC = Math.abs(c);
                      return sign * Math.pow(absC, 0.8) * 3.5; 
                    };

                    return notesToShow.map((midi) => {
                      const noteIdx = midi % 12;
                      const oct = Math.floor(midi / 12) - 1;
                      const name = NOTES[noteIdx];
                      const diffInCents = (midi - currentMidi) * 100 - cents;
                      const x = mapCentsToX(diffInCents);
                      const opacity = Math.max(0, 1 - Math.abs(diffInCents) / 250);

                      return (
                        <motion.div
                          key={midi}
                          animate={{ x }}
                          transition={{ type: 'spring', stiffness: 180, damping: 25 }}
                          className="absolute flex flex-col items-center"
                          style={{ opacity }}
                        >
                          <div className={cn("h-16 w-[1.5px]", midi === currentMidi ? "bg-white" : "bg-slate-800")} />
                          <div className="flex flex-col items-center mt-2 px-2">
                             <span className={cn("text-lg font-black", midi === currentMidi ? "text-white" : "text-slate-600")}>{name}</span>
                             <span className="text-[9px] font-bold text-slate-800">{oct}</span>
                          </div>
                        </motion.div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-slate-900 font-bold italic tracking-widest text-[10px] uppercase opacity-20">Analyzing...</div>
            )}
          </div>

          {/* Large Text Feedback */}
          <div className="flex flex-col items-center mt-2">
             <div className="flex items-baseline gap-2">
              <motion.span
                animate={isActive && pitchData ? { scale: [1, 1.02, 1] } : {}}
                transition={{ duration: 0.5 }}
                className={cn(
                  "text-[90px] font-black leading-none tracking-tighter transition-colors duration-300 drop-shadow-2xl",
                  isActive && pitchData && inTune ? "text-rose-400" : (isActive && pitchData ? "text-white" : "text-slate-900")
                )}
              >
                {noteName}
              </motion.span>
              <span className="text-3xl font-bold text-rose-500/80">{octave}</span>
            </div>

            <div className="h-10 flex flex-col items-center justify-center">
               {isActive && pitchData && (
                 <div className="flex flex-col items-center">
                    <span className={cn(
                      "text-3xl font-black tabular-nums tracking-tracking",
                      inTune ? "text-emerald-400" : (cents > 0 ? "text-rose-400" : "text-sky-400")
                    )}>
                      {cents > 0 ? `+${cents}` : cents}
                    </span>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                       {inTune ? 'PERFECT PITCH' : (cents > 0 ? 'SLIGHTLY SHARP' : 'SLIGHTLY FLAT')}
                    </p>
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* 6. Session Stats / Vocal Range Component */}
        <div className="bento-card p-5 mt-4">
           <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 p-4 bg-slate-950 rounded-3xl border border-slate-900 border-dashed">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Lowest Note</span>
                 {vocalRange ? (
                   <div className="flex items-center gap-1.5">
                      <span className="text-3xl font-black text-rose-400">{vocalRange.low.name}</span>
                      <span className="px-1.5 py-0.5 bg-rose-500/10 rounded-md text-xs font-black text-rose-400/60">{vocalRange.low.oct}</span>
                   </div>
                 ) : (
                   <span className="text-sm font-black text-slate-800 italic uppercase tracking-tighter">None</span>
                 )}
              </div>
              <div className="flex flex-col gap-2 p-4 bg-slate-950 rounded-3xl border border-slate-900 border-dashed">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Highest Note</span>
                 {vocalRange ? (
                   <div className="flex items-center gap-1.5">
                      <span className="text-3xl font-black text-sky-400">{vocalRange.high.name}</span>
                      <span className="px-1.5 py-0.5 bg-sky-500/10 rounded-md text-xs font-black text-sky-400/60">{vocalRange.high.oct}</span>
                   </div>
                 ) : (
                   <span className="text-sm font-black text-slate-800 italic uppercase tracking-tighter">None</span>
                 )}
              </div>
           </div>
           
           <div className="mt-4 pt-4 border-t border-slate-900 flex justify-between items-center px-2">
              <div className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                 <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Active Analysis</span>
              </div>
              <div className="flex items-baseline gap-1">
                 <span className="text-[10px] font-black text-slate-600">PEAK</span>
                 <span className="text-lg font-black text-slate-200 tabular-nums">{pitchData ? Math.round(pitchData.frequency) : 0}</span>
                 <span className="text-[9px] font-black text-slate-600">Hz</span>
              </div>
           </div>
        </div>
      </div>

      {/* 4. Footer Controls */}
      <div className="mt-auto">
        <button
          onClick={toggle}
          className={cn(
            "w-full h-24 flex flex-col items-center justify-center gap-1 rounded-[2.5rem] transition-all shadow-2xl active:scale-95 group",
            isActive
              ? "bg-slate-800 text-rose-400 border border-rose-500/20"
              : "bg-rose-500 text-white shadow-rose-500/10"
          )}
        >
          {isActive ? <MicOff size={32} /> : <Mic size={32} className="group-hover:scale-110 transition-transform" />}
          <div className="flex flex-col items-center leading-none">
            <span className="text-xl font-black tracking-tight uppercase">{isActive ? 'Stop Analysis' : 'Start Monitoring'}</span>
            <span className="text-[10px] font-bold tracking-widest opacity-60 mt-1 uppercase leading-none">{isActive ? '분석 중지' : '분석 시작'}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
