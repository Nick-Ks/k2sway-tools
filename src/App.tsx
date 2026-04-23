/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Music, Mic2, Settings as SettingsIcon } from 'lucide-react';
import { TuningFork } from './components/icons/TuningFork.tsx';
import { ToolType } from './types.ts';
import Metronome from './components/Metronome.tsx';
import Tuner from './components/Tuner.tsx';
import PitchCheck from './components/PitchCheck.tsx';
import Settings from './components/Settings.tsx';
import { cn } from './lib/utils.ts';
import { MetronomeProvider } from './context/MetronomeContext.tsx';

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolType>(() => {
    return (localStorage.getItem('last_tool') as ToolType) || 'metronome';
  });

  useEffect(() => {
    localStorage.setItem('last_tool', activeTool);
  }, [activeTool]);

  const renderTool = () => {
    switch (activeTool) {
      case 'metronome':
        return <Metronome key="metronome" />;
      case 'tuner':
        return <Tuner key="tuner" />;
      case 'pitch':
        return <PitchCheck key="pitch" />;
      case 'settings':
        return <Settings key="settings" />;
      default:
        return <Metronome key="metronome" />;
    }
  };

  const navItems = [
    { id: 'metronome', label: '메트로놈', icon: Timer },
    { id: 'tuner', label: '튜너', icon: TuningFork },
    { id: 'pitch', label: '보컬 피치', icon: Mic2 },
    { id: 'settings', label: '설정', icon: SettingsIcon },
  ];

  return (
    <MetronomeProvider>
      <div className="flex h-screen w-full flex-col bg-slate-950 font-sans text-slate-100 overflow-hidden">
        {/* Status Bar Spacer (Safe Area) */}
        <div className="h-safe-top" />

        {/* Main Content Area */}
        <main className="relative flex-1 overflow-hidden p-4 md:p-6 pb-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTool}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="h-full w-full bento-card overflow-hidden"
            >
              {renderTool()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <nav className="z-50 flex h-20 w-full items-center justify-around bg-slate-950/80 backdrop-blur-md pb-safe-bottom px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTool === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => setActiveTool(item.id as ToolType)}
                className={cn(
                  "group relative flex flex-col items-center justify-center gap-1 min-w-[72px] transition-colors",
                  isActive ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"
                )}
              >
                <div className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300",
                  isActive ? "bg-cyan-500/10" : "bg-transparent"
                )}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-bold tracking-tight uppercase">
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="active-nav"
                    className="absolute -bottom-2 h-1 w-1 rounded-full bg-cyan-400"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </MetronomeProvider>
  );
}
