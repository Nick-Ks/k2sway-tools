import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Star, Volume2, Music, ChevronDown, ChevronUp } from 'lucide-react';
import { usePitchCheck } from '../hooks/usePitchCheck.ts';
import { cn } from '../lib/utils.ts';
import { getNotationPreference, getNoteLabel } from '../lib/pitchUtils.ts';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [2, 3, 4, 5];

export default function PitchCheck() {
  const [selectedOctave, setSelectedOctave] = useState(3);
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
    low: { name: string, octave: number, freq: number }, 
    high: { name: string, octave: number, freq: number } 
  } | null>(null);

  React.useEffect(() => {
    if (pitchData && pitchData.clarity > 0.6) {
      const midi = (pitchData.octave + 1) * 12 + NOTES.indexOf(pitchData.name);
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      
      setVocalRange(prev => {
        if (!prev) {
          return {
            low: { name: pitchData.name, octave: pitchData.octave, freq },
            high: { name: pitchData.name, octave: pitchData.octave, freq }
          };
        }
        
        const newRange = { ...prev };
        const lowMidi = (prev.low.octave + 1) * 12 + NOTES.indexOf(prev.low.name);
        const highMidi = (prev.high.octave + 1) * 12 + NOTES.indexOf(prev.high.name);
        
        if (midi < lowMidi) newRange.low = { name: pitchData.name, octave: pitchData.octave, freq };
        if (midi > highMidi) newRange.high = { name: pitchData.name, octave: pitchData.octave, freq };
        
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
  const notation = getNotationPreference();
  const displayNoteName = pitchData ? getNoteLabel(noteName, notation) : noteName;
  const octave = pitchData?.octave !== undefined ? pitchData.octave : '';
  const inTune = Math.abs(cents) <= 8;

  return (
    <div className="flex h-full flex-col p-6 overflow-hidden">
      {/* 1. Header */}
      <div className="flex flex-col gap-1 px-1 mb-6">
        <h2 className="text-sm font-semibold flex items-center gap-2 text-rose-400">
           <Mic size={16} fill="currentColor" /> 보컬 피치 체크
        </h2>
        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none">Vocal Pitch Analysis</p>
      </div>

      {/* 2. Settings Area - Collapsible Reference Tone */}
      <div className="bento-card mb-4 transition-all">
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
                      <span className="text-sm font-black leading-none">{getNoteLabel(n, notation)}</span>
                      <span className="text-[9px] font-black opacity-60 mt-1.5">옥타브 {selectedOctave}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Session Stats / Vocal Range Component (Moved up) */}
      <div className="bento-card p-4 mb-4">
         <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 p-3 bg-slate-950 rounded-[1.5rem] border border-slate-900 border-dashed">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Lowest Note</span>
               {vocalRange ? (
                 <div className="flex items-center">
                    <span className="text-2xl font-black text-rose-400">
                      {getNoteLabel(vocalRange.low.name, notation)}<span className="text-sm opacity-70 ml-1">옥타브 {vocalRange.low.oct}</span>
                    </span>
                 </div>
               ) : (
                 <span className="text-sm font-black text-slate-800 italic uppercase tracking-tighter">None</span>
               )}
            </div>
            <div className="flex flex-col gap-1 p-3 bg-slate-950 rounded-[1.5rem] border border-slate-900 border-dashed">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Highest Note</span>
               {vocalRange ? (
                 <div className="flex items-center">
                    <span className="text-2xl font-black text-sky-400">
                      {getNoteLabel(vocalRange.high.name, notation)}<span className="text-sm opacity-70 ml-1">옥타브 {vocalRange.high.oct}</span>
                    </span>
                 </div>
               ) : (
                 <span className="text-sm font-black text-slate-800 italic uppercase tracking-tighter">None</span>
               )}
            </div>
         </div>
      </div>

      {/* 4. Main Context Area */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden mb-6">
        {/* Monitor */}
        <div className={cn(
          "flex-1 flex flex-col justify-center items-center rounded-[3.5rem] border transition-all duration-700 relative overflow-hidden min-h-[200px]",
          isActive && inTune ? "bg-rose-500/[0.03] border-rose-500/30 shadow-[0_0_80px_rgba(244,63,94,0.05)_inset]" : "bg-slate-950 border-slate-900/50"
        )}>
          {/* Perfect Pitch Celebration Glow */}
          {isActive && pitchData && inTune && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-64 w-64 bg-rose-500/10 rounded-full blur-[80px] animate-pulse" />
            </div>
          )}
          {/* Analysis indicator */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
            <div className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-emerald-400 animate-pulse shadow-[0_0_10px_#10b981]" : "bg-slate-900")} />
            <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest leading-none">Vocal Tracking</span>
          </div>

          {/* Scrolling Scale */}
          <div className="w-full relative h-24 flex items-center justify-center overflow-hidden mb-2 px-4 z-10">
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
                      const name = getNoteLabel(NOTES[noteIdx], notation);
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
                          <div className={cn("h-12 w-[1.5px]", midi === currentMidi ? "bg-white" : "bg-slate-800")} />
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
          <div className="flex flex-col items-center z-10">
             <div className="flex items-baseline gap-2">
              <motion.span
                animate={isActive && pitchData ? { scale: [1, 1.02, 1] } : {}}
                transition={{ duration: 0.5 }}
                className={cn(
                  "text-[80px] font-black leading-none tracking-tighter transition-colors duration-300 drop-shadow-2xl",
                  isActive && pitchData && inTune ? "text-rose-400" : (isActive && pitchData ? "text-white" : "text-slate-900")
                )}
              >
                {displayNoteName}
              </motion.span>
              <span className="text-xl font-bold text-rose-500/80">옥타브 {octave}</span>
            </div>

            <div className="h-8 flex flex-col items-center justify-center">
               {isActive && pitchData && (
                 <div className="flex flex-col items-center">
                    <span className={cn(
                      "text-2xl font-black tabular-nums tracking-tracking",
                      inTune ? "text-emerald-400" : (cents > 0 ? "text-rose-400" : "text-sky-400")
                    )}>
                      {cents > 0 ? `+${cents}` : cents}
                    </span>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Footer Controls */}
      <div className="mt-auto">
        <button
          onClick={toggle}
          className={cn(
            "w-full h-20 flex flex-col items-center justify-center gap-1 rounded-[2.5rem] transition-all shadow-2xl active:scale-95 group",
            isActive
              ? "bg-slate-800 text-rose-400 border border-rose-500/20"
              : "bg-rose-500 text-white shadow-rose-500/10"
          )}
        >
          {isActive ? <MicOff size={28} /> : <Mic size={28} className="group-hover:scale-110 transition-transform" />}
          <div className="flex flex-col items-center leading-none mt-1">
            <span className="text-lg font-black tracking-tight uppercase">{isActive ? '분석 중지' : '분석 시작'}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
