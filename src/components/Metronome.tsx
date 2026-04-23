/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Minus, Plus, Play, Pause, Zap } from 'lucide-react';
import { useMetronomeContext } from '../context/MetronomeContext.tsx';
import { cn } from '../lib/utils.ts';

export default function Metronome() {
  const {
    state: { isPlaying, bpm, timeSignature, subdivision, currentBeat, presets },
    setBpm,
    setTimeSignature,
    setSubdivision,
    toggle,
    tap
  } = useMetronomeContext();

  const isAccent = (currentBeat % subdivision) === 0;
  const isFirstBeat = (currentBeat % (timeSignature * subdivision)) === 0;

  return (
    <div className="flex h-full flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-cyan-400">
            <Zap size={16} /> 메트로놈
          </h2>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">Metronome</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 px-5 py-2.5 rounded-2xl text-[12px] font-black tracking-widest text-cyan-400">
          {timeSignature} BEAT
        </div>
      </div>

      {/* 2. Settings / Presets Area */}
      <div className="flex flex-col gap-5 mb-6">
        {/* BPM Presets */}
        <div className="bg-slate-900/50 p-3 rounded-[2.5rem] border border-slate-800 overflow-hidden">
          <div className="grid grid-cols-6 gap-2">
            {presets.map((preset, idx) => (
              <button
                key={`${preset}-${idx}`}
                onClick={() => setBpm(preset)}
                className={cn(
                  "h-14 text-base font-black rounded-2xl transition-all border",
                  bpm === preset ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]" : "bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800"
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Beats & Subdivision */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800 flex flex-col gap-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">박자수(Beats)</span>
            <div className="flex gap-2">
              {[2, 3, 4, 6].map(opt => (
                <button
                  key={opt}
                  onClick={() => setTimeSignature(opt as any)}
                  className={cn(
                    "flex-1 h-12 text-sm font-black rounded-xl transition-all border",
                    timeSignature === opt ? "bg-cyan-500 text-slate-950 border-cyan-400" : "bg-slate-950 text-slate-300 border-slate-900"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800 flex flex-col gap-3">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">나누기(Subdiv)</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(opt => (
                <button
                  key={opt}
                  onClick={() => setSubdivision(opt as any)}
                  className={cn(
                    "flex-1 h-12 text-sm font-black rounded-xl transition-all border",
                    subdivision === opt ? "bg-cyan-500 text-slate-950 border-cyan-400" : "bg-slate-950 text-slate-300 border-slate-900"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Context Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative w-full bg-slate-950 rounded-[3rem] border border-slate-900/50 py-8 mb-6">
        <div className="absolute top-8 w-full flex justify-center gap-3 px-12">
          {Array.from({ length: timeSignature }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 flex-1 rounded-full transition-all duration-75",
                Math.floor(currentBeat / subdivision) === i
                  ? (i === 0 ? "bg-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.8)]" : "bg-white shadow-[0_0_15px_rgba(255,255,255,0.6)]")
                  : "bg-slate-900"
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-8 group">
          <button
            onClick={() => setBpm(bpm - 1)}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 transition-all text-cyan-400 shadow-xl"
          >
            <Minus size={32} />
          </button>

          <div className="flex flex-col items-center relative">
            <motion.div
              animate={isPlaying ? { scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] } : { opacity: 0.05 }}
              className="absolute -inset-16 bg-cyan-500 rounded-full blur-[60px] pointer-events-none"
            />
            <motion.span
              animate={isPlaying && isAccent ? { scale: isFirstBeat ? 1.08 : 1.04 } : { scale: 1 }}
              className={cn(
                "text-[140px] font-black leading-none tracking-tighter tabular-nums drop-shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-colors duration-300",
                isPlaying ? "text-cyan-400" : "text-white"
              )}
            >
              {bpm}
            </motion.span>
          </div>

          <button
            onClick={() => setBpm(bpm + 1)}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-95 transition-all text-cyan-400 shadow-xl"
          >
            <Plus size={32} />
          </button>
        </div>
        
        <div className="mt-4 flex flex-col items-center gap-1">
          <span className="text-xs font-black text-slate-400 tracking-[0.4em] uppercase">ALLEGRO</span>
          <span className="text-[11px] font-bold text-slate-300 italic">박자에 맞춰 찬양하세요</span>
        </div>
      </div>

      {/* 4. Footer Buttons */}
      <div className="flex w-full flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={tap}
            className="col-span-1 flex h-24 flex-col items-center justify-center gap-2 rounded-3xl bg-slate-900 border border-slate-800 hover:border-cyan-500/30 active:scale-95 transition-all"
          >
            <Zap size={24} className="text-cyan-500/50" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 leading-none">TAP</span>
            <span className="text-[10px] font-bold text-slate-400">템포 직접 맞추기</span>
          </button>

          <button
            onClick={toggle}
            className={cn(
              "col-span-2 flex h-24 flex-col items-center justify-center gap-1 rounded-3xl transition-all shadow-2xl active:scale-95",
              isPlaying 
                ? "bg-slate-800 text-cyan-400 border border-cyan-500/30" 
                : "bg-cyan-500 text-slate-950 shadow-cyan-500/20"
            )}
          >
            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
            <span className="text-xl font-black uppercase tracking-tight leading-none">
              {isPlaying ? '그만하기' : '시작하기'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
