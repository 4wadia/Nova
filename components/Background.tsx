import React from 'react';

export const Background: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Base Layer — uses darkmatter theme background */}
      <div className="absolute inset-0 bg-background transition-colors duration-1000" />

      {/* Noise Texture Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Cinematic Spotlight — darkmatter primary warm glow */}
      <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[140vw] h-[100vh] bg-primary/[0.06] rounded-full blur-[120px] pointer-events-none transition-all duration-1000 animate-pulse-subtle"></div>


      {/* Balanced Warm Glow — darkmatter primary orange */}
      <div className="absolute top-[20%] right-[-10%] w-[60vw] h-[60vh] bg-primary/[0.04] dark:bg-primary/[0.02] rounded-full blur-[140px] pointer-events-none"></div>
    </div>
  );
};