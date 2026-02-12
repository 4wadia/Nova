import React from 'react';

export const Background: React.FC = () => {
  return (
    <>
      {/* Noise Texture Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.03] dark:opacity-[0.02] mix-blend-overlay"
        style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
      
      {/* Top Spotlight / Glow */}
      <div className="fixed top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-slate-200 dark:bg-white rounded-full blur-[120px] opacity-40 dark:opacity-[0.03] pointer-events-none z-0 transition-colors duration-700"></div>
      
      {/* Subtle bottom glow */}
      <div className="fixed bottom-[-40%] left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-slate-300 dark:bg-zinc-800 rounded-full blur-[150px] opacity-40 dark:opacity-[0.1] pointer-events-none z-0 transition-colors duration-700"></div>
    </>
  );
};