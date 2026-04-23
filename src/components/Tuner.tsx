/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, AlertCircle, ChevronDown, CheckCircle2, Volume2 } from 'lucide-react';
import { TuningFork } from './icons/TuningFork.tsx';
import { useTuner, INSTRUMENT_PROFILES, TuningProfile } from '../hooks/useTuner.ts';
import { cn } from '../lib/utils.ts';
import { CHROMATIC_FREQUENCIES, getNoteFromFrequency, NOTE_NAMES } from '../lib/pitchUtils.ts';

export default function Tuner() {
  const [refPresets] = useState<number[]>(() => {
    const saved = localStorage.getItem('ref_presets');
    return saved ? JSON.parse(saved) : [432, 440, 442, 444];
  });
  const [refPitch, setRefPitch] = useState(() => Number(localStorage.getItem('m_ref_freq')) || 440);
  const [enabledProfiles] = useState<string[]>(() => {
    const saved = localStorage.getItem('tuner_profiles');
    return saved ? JSON.parse(saved) : ['chromatic', 'guitar-std', 'bass-4', 'ukulele', 'violin', 'cello'];
  });

  const allProfiles = Object.values(INSTRUMENT_PROFILES).flat();
  const activeProfiles = allProfiles.filter(p => enabledProfiles.includes(p.id));
  
  const [selectedProfileId, setSelectedProfileId] = useState(() => activeProfiles[0]?.id || 'chromatic');
  const [showRefHz, setShowRefHz] = useState(false);
  
  const selectedProfile = allProfiles.find(p => p.id === selectedProfileId) || allProfiles[0];
  
  const { pitchData, isActive, start, stop, error, startTone, stopTone } = useTuner(refPitch, selectedProfileId);

  const toggle = () => {
    if (isActive) stop();
    else start();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const cents = pitchData?.cents || 0;
  const noteName = pitchData?.name || '-';
  const octave = pitchData?.octave !== undefined ? pitchData.octave : '';
  const inTune = Math.abs(cents) <= 3; 

  // Play reference note from profile
  const handleNoteClick = (note: string) => {
    const noteNamePart = note.replace(/[0-9]/g, '');
    const octavePart = parseInt(note.replace(/[^0-9]/g, '')) || 4;
    
    // Total semitones from C0
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const semitones = noteNames.indexOf(noteNamePart) + (octavePart + 1) * 12;
    const freq = refPitch * Math.pow(2, (semitones - 69) / 12);
    
    startTone(freq);
    setTimeout(stopTone, 1500);
  };

  const handleRefSelect = (hz: number) => {
    setRefPitch(hz);
    localStorage.setItem('m_ref_freq', hz.toString());
    setShowRefHz(false);
  };

  return (
    <div className="flex h-full flex-col p-6 overflow-hidden">
      {/* 1. Header Row */}
      <div className="flex justify-between items-center mb-6">
         <div className="flex flex-col">
           <h2 className="text-sm font-semibold flex items-center gap-2 text-amber-400">
             <TuningFork size={16} /> 악기 튜너
           </h2>
           <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">Instrument Tuner</p>
         </div>
          <div className="relative">
            <button 
              onClick={() => setShowRefHz(!showRefHz)}
              className="bg-slate-900 border border-amber-500/30 px-4 py-2.5 rounded-2xl text-[11px] font-black tracking-widest text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)] flex items-center gap-1.5 transition-all hover:bg-slate-800"
            >
              <span className="text-[9px] opacity-70 border border-amber-400/30 px-1.5 py-0.5 rounded uppercase">보정됨</span>
              A4={refPitch}Hz <ChevronDown size={14} />
            </button>
            {showRefHz && (
              <div className="absolute top-full right-0 mt-2 w-32 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden z-20 shadow-2xl">
                {refPresets.map(hz => (
                  <button
                    key={hz}
                    onClick={() => handleRefSelect(hz)}
                    className={cn(
                      "w-full text-center px-4 py-3 text-[12px] font-black tracking-widest border-b border-slate-800 last:border-0",
                      refPitch === hz ? "bg-amber-500 text-slate-950" : "text-slate-500 hover:bg-slate-900"
                    )}
                  >
                    {hz} Hz
                  </button>
                ))}
              </div>
            )}
          </div>
      </div>

      {/* 2. Settings / Grid Area */}
      <div className="bento-card p-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          {activeProfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProfileId(p.id)}
              className={cn(
                "flex flex-col items-center justify-center h-14 rounded-[1.5rem] border transition-all active:scale-95",
                selectedProfileId === p.id 
                  ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)]" 
                  : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800"
              )}
            >
              <span className="text-xs font-black tracking-tight leading-none text-center uppercase">{p.nameKo}</span>
              <span className="text-[8px] font-black opacity-50 uppercase tracking-[0.1em] mt-1">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Reference Targets - Relocated as requested */}
      {selectedProfile.notes.length > 0 && (
        <div className="bento-card p-3 mb-4">
          <div className="flex flex-col gap-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] text-center">Reference Targets</span>
            <div className="flex flex-wrap justify-center gap-2">
              {selectedProfile.notes.map((n) => {
                const isActive = noteName + octave === n;
                return (
                  <button 
                    key={n} 
                    onPointerDown={() => handleNoteClick(n)}
                    onPointerUp={() => stopTone()}
                    onPointerLeave={() => stopTone()}
                    className={cn(
                      "flex flex-col items-center justify-center h-14 w-[calc(100%/6-8px)] min-w-[45px] rounded-[1rem] transition-all border relative overflow-hidden active:scale-90",
                      isActive
                        ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.4)] z-10" 
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    )}
                  >
                    <span className="text-[11px] font-black leading-none uppercase">{n.replace(/[0-9]/g, '')}</span>
                    <span className="text-[9px] font-black opacity-40 leading-none mt-1">{n.replace(/[^0-9]/g, '')}</span>
                    <div className="absolute top-1 right-1">
                      <Volume2 size={7} className="opacity-30" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. Tuner Main Display */}
      <div className={cn(
        "flex-1 flex flex-col items-center justify-center relative w-full overflow-hidden rounded-[3rem] border transition-all duration-500",
        isActive && pitchData && inTune 
          ? "bg-emerald-500/[0.03] border-emerald-500/30 shadow-[0_0_80px_rgba(16,185,129,0.05)_inset]" 
          : "bg-slate-950 border-slate-900/50"
      )}>
        {/* Perfect Tune Glow Enhancement */}
        {isActive && inTune && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-64 w-64 bg-emerald-500/10 rounded-full blur-[80px] animate-pulse" />
          </div>
        )}

        {/* Scrolling Scale Visualization */}
        <div className="w-full relative h-40 flex items-center justify-center overflow-hidden mb-4">
          {/* Background decorative scale line */}
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-900" />
          
          {/* Main Display Area */}
          <div className="relative w-full h-full flex items-center justify-center">
            {isActive && pitchData && (
              <div className="relative w-full h-full">
                {/* Fixed Center Indicator */}
                <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-amber-400 z-50 -translate-x-1/2 shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 border-[8px] border-transparent border-t-amber-400" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 border-[8px] border-transparent border-b-amber-400" />
                </div>

                {/* Scrolling Notes Container */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {(() => {
                    const currentMidi = (pitchData.octave + 1) * 12 + NOTE_NAMES.indexOf(pitchData.name);
                    const notesToShow = [];
                    for (let i = -3; i <= 3; i++) {
                      notesToShow.push(currentMidi + i);
                    }

                    // Mapping function for non-linear scale (wider in center)
                    const mapCentsToX = (c: number) => {
                      const sign = Math.sign(c);
                      const absC = Math.abs(c);
                      // power < 1 makes it wider at center, power > 1 makes it thinner
                      // User asked for wider at center -> thinner at edges.
                      // x = c^0.8 is wider at center (derivative at 0 is inf)
                      return sign * Math.pow(absC, 0.8) * 4; 
                    };

                    return notesToShow.map((midi) => {
                      const noteIdx = midi % 12;
                      const oct = Math.floor(midi / 12) - 1;
                      const name = NOTE_NAMES[noteIdx];
                      
                      const diffInCents = (midi - currentMidi) * 100 - cents;
                      const x = mapCentsToX(diffInCents);
                      const opacity = Math.max(0, 1 - Math.abs(diffInCents) / 250);

                      return (
                        <motion.div
                          key={midi}
                          animate={{ x }}
                          transition={{ type: 'spring', stiffness: 200, damping: 25, mass: 0.5 }}
                          className="absolute flex flex-col items-center"
                          style={{ opacity }}
                        >
                          <div className={cn(
                            "h-20 w-[2px] rounded-full",
                            midi === currentMidi ? "bg-white h-24" : "bg-slate-800"
                          )} />
                          <div className="flex flex-col items-center mt-3">
                            <span className={cn(
                              "text-xl font-black",
                              midi === currentMidi ? "text-white" : "text-slate-600"
                            )}>
                              {name}
                            </span>
                            <span className="text-[10px] font-bold text-slate-700">{oct}</span>
                          </div>
                          
                          {/* Intermediate tick marks */}
                          {midi < notesToShow[notesToShow.length - 1] && [20, 40, 60, 80].map(tick => {
                            const tickCents = diffInCents + tick;
                            const tx = mapCentsToX(tickCents);
                            return (
                              <motion.div 
                                key={tick}
                                animate={{ x: tx }}
                                className="absolute top-1/2 -translate-y-1/2 h-8 w-[1px] bg-slate-900"
                              />
                            );
                          })}
                        </motion.div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
            
            {!isActive && (
              <div className="text-slate-800 font-bold italic tracking-widest text-sm uppercase opacity-30">
                Ready to tune...
              </div>
            )}
          </div>
        </div>

        {/* Big Note Feedback Area */}
        <div className="flex flex-col items-center relative py-4">
          <div className="flex items-center gap-3 h-8">
            {inTune && isActive && pitchData && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.5 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="text-emerald-400 flex items-center gap-1.5"
               >
                 <CheckCircle2 size={20} />
                 <span className="text-[14px] font-black uppercase tracking-[0.2em]">IN TUNE</span>
               </motion.div>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-baseline gap-2">
              <motion.span
                key={noteName}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  "text-[80px] font-black leading-none tracking-tighter drop-shadow-2xl transition-colors duration-300",
                  isActive && pitchData ? (inTune ? "text-emerald-400" : "text-white") : "text-slate-900"
                )}
              >
                {noteName}
              </motion.span>
              <span className="text-3xl font-bold text-amber-500/80">{octave}</span>
            </div>
            
            <div className="flex flex-col items-center h-12">
               {isActive && pitchData ? (
                 <div className="flex flex-col items-center">
                    <span className={cn(
                      "text-4xl font-black tabular-nums tracking-tight",
                      inTune ? "text-emerald-400" : (cents > 0 ? "text-right-offset text-amber-400" : "text-left-offset text-sky-400")
                    )}>
                      {cents > 0 ? `+${cents}` : cents}
                    </span>
                    <span className="text-[12px] font-black text-slate-500 uppercase tracking-widest mt-1">
                      {cents > 3 ? 'TOO HIGH' : cents < -3 ? 'TOO LOW' : 'PERFECT'}
                    </span>
                 </div>
               ) : null}
            </div>
          </div>
        </div>

      </div>

      {/* 4. Footer Controls */}
      <div className="flex flex-col gap-4 mt-6">
        {error && (
          <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs">
            <AlertCircle size={16} />
            <p className="font-bold uppercase tracking-tight">{error}</p>
          </div>
        )}

        <button
          onClick={toggle}
          className={cn(
            "w-full h-24 flex flex-col items-center justify-center gap-1 rounded-[2.5rem] transition-all shadow-2xl active:scale-95",
            isActive
              ? "bg-slate-800 text-amber-400 border border-amber-500/20"
              : "bg-amber-500 text-slate-950 shadow-amber-500/10"
          )}
        >
          {isActive ? <MicOff size={32} /> : <Mic size={32} />}
          <span className="text-xl font-black tracking-tight leading-none uppercase">
            {isActive ? '그만하기' : '튜닝 시작'}
          </span>
        </button>
      </div>
    </div>
  );
}
