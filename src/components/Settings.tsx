/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, Gauge, Music, Timer, Keyboard, Check, Activity, Volume2, Info, Eye, EyeOff, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '../lib/utils.ts';
import { InstrumentType, INSTRUMENT_PROFILES } from '../hooks/useTuner.ts';
import { useMetronomeContext } from '../context/MetronomeContext.tsx';
import { motion, AnimatePresence } from 'motion/react';

export default function Settings() {
  const { state: mState, setPresets: setMetronomePresets } = useMetronomeContext();
  const [tunerSensitivity, setTunerSensitivity] = useState(() => Number(localStorage.getItem('tuner_sensitivity')) || 0.25);
  const [vocalSensitivity, setVocalSensitivity] = useState(() => Number(localStorage.getItem('vocal_sensitivity')) || 0.22);
  const [refPresets, setRefPresets] = useState<number[]>(() => {
    const saved = localStorage.getItem('ref_presets');
    return saved ? JSON.parse(saved) : [432, 440, 442, 444];
  });
  const [latency, setLatency] = useState(() => Number(localStorage.getItem('m_latency')) || 0);
  const [enabledProfiles, setEnabledProfiles] = useState<string[]>(() => {
    const saved = localStorage.getItem('tuner_profiles');
    return saved ? JSON.parse(saved) : ['chromatic', 'guitar-std', 'bass-4', 'ukulele', 'violin', 'cello'];
  });
  const [noteNotation, setNoteNotation] = useState<'latin' | 'solfege'>(() => {
    const saved = localStorage.getItem('note_notation');
    return saved === 'solfege' ? 'solfege' : 'latin';
  });
  const [tunerProcessInterval, setTunerProcessInterval] = useState(() => Number(localStorage.getItem('tuner_process_interval_ms')) || 20);
  const [vocalProcessInterval, setVocalProcessInterval] = useState(() => Number(localStorage.getItem('vocal_process_interval_ms')) || 22);

  const [activeTest, setActiveTest] = useState<'none' | 'metronome' | 'tuner' | 'vocal'>('none');
  const activeTestRef = useRef(activeTest);
  
  useEffect(() => {
    activeTestRef.current = activeTest;
  }, [activeTest]);

  const [realTimeLevel, setRealTimeLevel] = useState(0);
  const [testBeat, setTestBeat] = useState(false);
  
  const testAudioCtxRef = useRef<AudioContext | null>(null);
  const testAnalyserRef = useRef<AnalyserNode | null>(null);
  const testStreamRef = useRef<MediaStream | null>(null);
  const testTimerRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('tuner_sensitivity', tunerSensitivity.toString());
  }, [tunerSensitivity]);

  useEffect(() => {
    localStorage.setItem('vocal_sensitivity', vocalSensitivity.toString());
  }, [vocalSensitivity]);

  useEffect(() => {
    localStorage.setItem('ref_presets', JSON.stringify(refPresets));
  }, [refPresets]);

  useEffect(() => {
    localStorage.setItem('m_latency', latency.toString());
  }, [latency]);

  useEffect(() => {
    localStorage.setItem('tuner_profiles', JSON.stringify(enabledProfiles));
  }, [enabledProfiles]);

  useEffect(() => {
    localStorage.setItem('note_notation', noteNotation);
  }, [noteNotation]);

  useEffect(() => {
    localStorage.setItem('tuner_process_interval_ms', tunerProcessInterval.toString());
  }, [tunerProcessInterval]);

  useEffect(() => {
    localStorage.setItem('vocal_process_interval_ms', vocalProcessInterval.toString());
  }, [vocalProcessInterval]);

  const updateMetronomePreset = (idx: number, val: string) => {
    const newPresets = [...mState.presets];
    newPresets[idx] = parseInt(val) || 0;
    setMetronomePresets(newPresets);
  };

  const updateRefPreset = (idx: number, val: string) => {
    const newPresets = [...refPresets];
    newPresets[idx] = parseInt(val) || 0;
    setRefPresets(newPresets);
  };

  const toggleProfile = (id: string) => {
    setEnabledProfiles(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // --- Test Logic ---
  
  const stopAllTests = useCallback(() => {
    if (testTimerRef.current) clearInterval(testTimerRef.current);
    if (testStreamRef.current) testStreamRef.current.getTracks().forEach(t => t.stop());
    if (testAudioCtxRef.current && testAudioCtxRef.current.state !== 'closed') {
      testAudioCtxRef.current.close().catch(() => {});
    }
    testAudioCtxRef.current = null;
    setActiveTest('none');
    setRealTimeLevel(0);
    setTestBeat(false);
  }, []);

  // Unmount cleanup
  useEffect(() => {
    return () => stopAllTests();
  }, [stopAllTests]);

  const startMetronomeTest = async () => {
    stopAllTests();
    setActiveTest('metronome');
    testAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // 120 BPM = 0.5s per beat
    const interval = 500;
    let nextNoteTime = testAudioCtxRef.current.currentTime;

    const tick = () => {
      if (!testAudioCtxRef.current) return;
      
      const latencySec = latency / 1000;
      
      // Visual flash (instant)
      setTestBeat(true);
      setTimeout(() => setTestBeat(false), 100);

      // Sound (with latency)
      const osc = testAudioCtxRef.current.createOscillator();
      const gain = testAudioCtxRef.current.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, testAudioCtxRef.current.currentTime + latencySec);
      gain.gain.exponentialRampToValueAtTime(0.01, testAudioCtxRef.current.currentTime + latencySec + 0.1);
      osc.connect(gain);
      gain.connect(testAudioCtxRef.current.destination);
      osc.start(testAudioCtxRef.current.currentTime + latencySec);
      osc.stop(testAudioCtxRef.current.currentTime + latencySec + 0.1);
    };

    testTimerRef.current = window.setInterval(tick, interval);
  };

  const startSensitivityTest = async (type: 'tuner' | 'vocal') => {
    stopAllTests();
    setActiveTest(type);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStreamRef.current = stream;
      testAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      testAnalyserRef.current = testAudioCtxRef.current.createAnalyser();
      testAnalyserRef.current.fftSize = 256;
      
      const source = testAudioCtxRef.current.createMediaStreamSource(stream);
      source.connect(testAnalyserRef.current);
      
      const bufferLength = testAnalyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const update = () => {
        if (!testAnalyserRef.current || activeTestRef.current === 'none') return;
        testAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i=0; i<bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;
        // Boost factor for visibility in test
        setRealTimeLevel(Math.min(1, (average / 64))); 
        requestAnimationFrame(update);
      };
      update();
    } catch(e) {
      console.error(e);
      stopAllTests();
    }
  };

  return (
    <div className="flex h-full flex-col p-6 overflow-y-auto no-scrollbar gap-12 pb-32">
      <header className="pt-8 px-2">
        <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-4">
          설정
          <SettingsIcon className="text-cyan-400" size={32} />
        </h1>
        <p className="text-slate-400 font-bold text-[12px] uppercase tracking-[0.4em] mt-2">App Configuration & Tests</p>
      </header>

      <div className="flex flex-col gap-16">
        {/* --- METRONOME CATEGORY --- */}
        <section className="flex flex-col gap-8">
          <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
            <div className="p-3 bg-cyan-500/10 rounded-2xl">
              <Timer size={22} className="text-cyan-400" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-widest text-white">메트로놈 설정</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* BPM Presets */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 shadow-inner shadow-slate-950/50">
              <span className="text-label mb-6 block">BPM 프리셋</span>
              <div className="grid grid-cols-3 gap-4">
                {mState.presets.map((p, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase ml-1">프리셋 {i+1}</span>
                    <input 
                      type="number"
                      value={p}
                      onChange={(e) => updateMetronomePreset(i, e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-2xl px-3 py-4 text-lg font-black text-white focus:outline-none focus:border-cyan-500 text-center shadow-lg"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Latency Adjustment */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <span className="text-label block">지연 시간 보정</span>
                  <p className="text-desc mt-2 max-w-[240px]">
                    블루투스 사용 시 소리가 늦게 들리면 보정값을 조정하여 화면과 일치시키세요.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <input 
                    type="number"
                    value={latency}
                    onChange={(e) => setLatency(Number(e.target.value))}
                    className="w-24 bg-slate-950 border border-slate-800 rounded-2xl py-3 text-lg font-black text-white text-center focus:outline-none focus:border-cyan-500 shadow-lg"
                  />
                  <span className="text-[12px] font-bold text-slate-400">ms</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex justify-between text-[10px] font-black text-slate-600 uppercase px-1">
                  <span>-300ms</span>
                  <span>0ms (기본)</span>
                  <span>+300ms</span>
                </div>
                <input 
                  type="range" min="-300" max="300" step="1"
                  value={latency}
                  onChange={(e) => setLatency(Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" 
                />
                
                <button 
                  onClick={activeTest === 'metronome' ? stopAllTests : startMetronomeTest}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2",
                    activeTest === 'metronome' ? "bg-red-500/20 text-red-500 border border-red-500/30" : "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/10"
                  )}
                >
                  {activeTest === 'metronome' ? "테스트 중지" : "지연 시간 테스트 (120 BPM)"}
                  {activeTest === 'metronome' && <Activity size={14} className="animate-pulse" />}
                </button>

                {activeTest === 'metronome' && (
                  <div className="flex flex-col items-center gap-8 p-10 bg-slate-950 rounded-3xl border border-slate-800">
                    <motion.div 
                      animate={testBeat ? { scale: 1.5, opacity: 1 } : { scale: 1, opacity: 0.3 }}
                      className="h-24 w-24 rounded-full bg-cyan-500 shadow-[0_0_40px_rgba(34,211,238,0.6)]"
                    />
                    <span className="text-[14px] font-black text-slate-100 tracking-wider">깜빡임이 소리와 딱 맞을 때까지 바를 조절하세요</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* --- TUNER & VOCAL PITCH CATEGORY --- */}
        <section className="flex flex-col gap-8">
          <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
            <div className="p-3 bg-amber-500/10 rounded-2xl">
              <Music size={22} className="text-amber-400" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-widest text-white">조율 및 분석 설정</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Sensitivity Settings */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 space-y-12">
              {/* Tuner Sensitivity */}
              <div className="space-y-6">
                <div className="flex justify-between items-start leading-none">
                  <div>
                    <span className="text-label block">악기 튜너 감도</span>
                    <p className="text-desc mt-2">낮을수록 소리에 예민하게 반응합니다.</p>
                  </div>
                  <div className="flex items-end gap-1 group">
                     <input 
                       type="number"
                       value={Math.round(tunerSensitivity * 100)}
                       onChange={(e) => setTunerSensitivity(Number(e.target.value) / 100)}
                       className="w-16 bg-transparent text-xl font-black text-amber-400 text-right focus:outline-none border-b border-transparent focus:border-amber-400"
                     />
                     <span className="text-[10px] font-bold text-slate-700">%</span>
                  </div>
                </div>
                <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase px-1">
                  <span>10% (고감도)</span>
                  <span className="text-amber-500/50">25% (기본)</span>
                  <span>99% (저감도)</span>
                </div>
                <input 
                  type="range" min="0.1" max="0.99" step="0.01" 
                  value={tunerSensitivity}
                  onChange={(e) => setTunerSensitivity(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                />
              </div>

              {/* Vocal Sensitivity */}
              <div className="space-y-6">
                <div className="flex justify-between items-start leading-none">
                  <div>
                    <span className="text-label block">보컬 피치 감도</span>
                    <p className="text-desc mt-2">안정적인 목소리 분석을 위해 조절하세요.</p>
                  </div>
                  <div className="flex items-end gap-1 group">
                     <input 
                       type="number"
                       value={Math.round(vocalSensitivity * 100)}
                       onChange={(e) => setVocalSensitivity(Number(e.target.value) / 100)}
                       className="w-16 bg-transparent text-xl font-black text-rose-400 text-right focus:outline-none border-b border-transparent focus:border-rose-400"
                     />
                     <span className="text-[10px] font-bold text-slate-700">%</span>
                  </div>
                </div>
                <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase px-1">
                  <span>10% (고감도)</span>
                  <span className="text-rose-500/50">22% (기본)</span>
                  <span>99% (저감도)</span>
                </div>
                <input 
                  type="range" min="0.1" max="0.99" step="0.01" 
                  value={vocalSensitivity}
                  onChange={(e) => setVocalSensitivity(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500" 
                />
              </div>

              {/* Unified Sensitivity Test */}
              <div className="pt-8 border-t border-slate-800/50">
                <button 
                  onClick={activeTest !== 'none' ? stopAllTests : () => startSensitivityTest('tuner')}
                  className={cn(
                    "w-full py-5 rounded-2xl font-black text-[13px] transition-all border flex items-center justify-center gap-3",
                    activeTest !== 'none' && activeTest !== 'metronome' ? "bg-amber-500 text-slate-950 border-amber-400" : "bg-slate-950 text-amber-500 border-amber-500/30 hover:bg-slate-900"
                  )}
                >
                  <Activity size={18} />
                  {activeTest !== 'none' && activeTest !== 'metronome' ? "마이크 감도 테스트 중..." : "마이크 감도 테스트 시작"}
                </button>

                <AnimatePresence>
                  {(activeTest === 'tuner' || activeTest === 'vocal') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-8 p-6 bg-slate-950 rounded-[2rem] border border-slate-800 flex flex-col gap-4 overflow-hidden"
                    >
                       <div className="flex justify-between items-center text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">
                         <span>현재 입력 레벨</span>
                         <span>인식 기준: {activeTest === 'tuner' ? Math.round(tunerSensitivity*100) : Math.round(vocalSensitivity*100)}%</span>
                       </div>
                       <div className="h-6 bg-slate-900 rounded-full overflow-hidden relative border border-slate-800">
                          <motion.div 
                            animate={{ width: `${realTimeLevel * 100}%` }}
                            className={cn(
                              "h-full transition-[width] duration-75",
                              realTimeLevel > (activeTest === 'tuner' ? tunerSensitivity : vocalSensitivity)
                                ? (activeTest === 'tuner' ? "bg-amber-400 shadow-[0_0_15px_#fbbf24]" : "bg-rose-400 shadow-[0_0_15px_#f43f5e]")
                                : "bg-slate-600"
                            )}
                          />
                          <div 
                            className="absolute h-full w-0.5 bg-white z-10" 
                            style={{ left: `${(activeTest === 'tuner' ? tunerSensitivity : vocalSensitivity) * 100}%` }}
                          />
                       </div>
                       <p className="text-[11px] text-slate-600 font-bold text-center tracking-tight">색상이 노란색/분홍색으로 변할 때 소리가 인식됩니다</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 space-y-8">
              <div className="flex items-center gap-3">
                <Keyboard size={18} className="text-violet-400" />
                <span className="text-label">음표 표기 방식</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setNoteNotation('latin')}
                  className={cn(
                    "h-14 rounded-2xl border font-black text-sm transition-all",
                    noteNotation === 'latin'
                      ? "bg-violet-500 text-white border-violet-400"
                      : "bg-slate-950 border-slate-800 text-slate-300"
                  )}
                >
                  C D E F G A B
                </button>
                <button
                  onClick={() => setNoteNotation('solfege')}
                  className={cn(
                    "h-14 rounded-2xl border font-black text-sm transition-all",
                    noteNotation === 'solfege'
                      ? "bg-violet-500 text-white border-violet-400"
                      : "bg-slate-950 border-slate-800 text-slate-300"
                  )}
                >
                  도 레 미 파 솔 라 시
                </button>
              </div>
              <p className="text-desc">튜너와 보컬 피치 화면의 음표 표기에 즉시 반영됩니다.</p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 space-y-8">
              <span className="text-label block">소리 분석 처리 간격 (튀는 현상 완화)</span>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[12px] font-bold text-slate-300">
                  <span>악기 튜너</span>
                  <span>{tunerProcessInterval}ms</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="36"
                  step="1"
                  value={tunerProcessInterval}
                  onChange={(e) => setTunerProcessInterval(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[12px] font-bold text-slate-300">
                  <span>보컬 피치</span>
                  <span>{vocalProcessInterval}ms</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="36"
                  step="1"
                  value={vocalProcessInterval}
                  onChange={(e) => setVocalProcessInterval(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
              </div>
              <p className="text-desc">값을 높일수록 반응은 느려지지만 음정 표시가 더 안정적으로 유지됩니다.</p>
            </div>

            {/* Reference Presets */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-inner shadow-slate-950/50">
              <span className="text-label mb-6 block px-1">기준음 프리셋 (A4 Hz)</span>
              <div className="grid grid-cols-4 gap-3">
                {refPresets.map((p, i) => (
                  <input 
                    key={i}
                    type="number"
                    value={p}
                    onChange={(e) => updateRefPreset(i, e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-2xl py-4 text-base font-black text-white text-center focus:outline-none focus:border-amber-500 shadow-md"
                  />
                ))}
              </div>
            </div>

            {/* Profile Visibility */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-8">
              <span className="text-label mb-6 block px-2">악기 목록 관리</span>
              <div className="space-y-6">
                {(Object.keys(INSTRUMENT_PROFILES) as InstrumentType[]).map((type) => (
                  <div key={type} className="space-y-3">
                     <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-4">{type}</span>
                     <div className="grid grid-cols-1 gap-3">
                       {INSTRUMENT_PROFILES[type].map(profile => {
                         const isEnabled = enabledProfiles.includes(profile.id);
                         return (
                          <button
                            key={profile.id}
                            onClick={() => toggleProfile(profile.id)}
                            className={cn(
                              "flex items-center justify-between p-5 rounded-[2rem] border transition-all text-left",
                              isEnabled ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-950 border-slate-900 text-slate-400 grayscale"
                            )}
                          >
                            <div className="flex flex-col">
                              <span className="text-base font-black">{profile.nameKo}</span>
                              <span className="text-[10px] font-bold opacity-60 uppercase">{profile.name}</span>
                            </div>
                            <div className={cn(
                              "h-7 w-7 rounded-xl border flex items-center justify-center transition-all",
                              isEnabled ? "bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-slate-900 border-slate-800 text-transparent"
                            )}>
                              <Check size={16} className="text-slate-950" strokeWidth={5} />
                            </div>
                          </button>
                         );
                       })}
                     </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Security Info */}
        <section className="flex items-center gap-6 p-8 bg-slate-900/60 rounded-[3rem] border border-slate-800 shadow-xl mb-16">
           <div className="p-4 bg-emerald-500/10 rounded-3xl border border-emerald-500/20">
             <ShieldCheck size={32} className="text-emerald-500" />
           </div>
           <div className="flex flex-col gap-2">
             <span className="text-[13px] font-black uppercase tracking-widest text-slate-100 leading-none">Privacy & Security</span>
             <p className="text-[12px] text-slate-400 font-bold leading-relaxed">
               모든 설정과 오디오 분석은 기기 내에서만 이루어집니다. 외부 서버 저장이나 전송이 일체 없는 안전한 도구입니다.
             </p>
           </div>
        </section>
      </div>
    </div>
  );
}
