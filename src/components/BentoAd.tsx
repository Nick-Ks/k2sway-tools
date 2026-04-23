import React, { useState } from 'react';
import { cn } from '../lib/utils.ts';
import { ExternalLink } from 'lucide-react';

export default function BentoAd({ className }: { className?: string }) {
  // Logic to potentially hide the ad if not needed or failed to load
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className={cn(
      "bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden relative min-h-[90px] flex items-center justify-center transition-all duration-300",
      className
    )}>
      {/* Google AdSense Placeholder */}
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <ins className="adsbygoogle"
             style={{ display: 'block', width: '100%', height: '100%' }}
             data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
             data-ad-slot="XXXXXXXXXX"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
        
        {/* Placeholder text if AdSense is not active */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Advertisement</span>
           <span className="text-[8px] font-bold text-slate-700 mt-1">Google AdSense</span>
        </div>
      </div>

      {/* Close/Hide button for demo/manual control if needed */}
      <button 
        onClick={() => setIsVisible(false)}
        className="absolute top-2 right-2 h-4 w-4 rounded-full bg-slate-950 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
      >
        <span className="text-[8px] font-bold text-slate-500 italic">x</span>
      </button>
    </div>
  );
}
