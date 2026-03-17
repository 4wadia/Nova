import React from 'react';

// True Dolby Double-D SVG
export const LogoDolby = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 28" className={className} fill="currentColor">
    <path d="M12.5 4H4v20h8.5c5.5 0 10-4.5 10-10s-4.5-10-10-10zm-3.5 15H9V9h4c2.8 0 5 2.2 5 5s-2.2 5-5 5z"/>
    <path d="M27.5 4H36v20h-8.5c-5.5 0-10-4.5-10-10s4.5-10 10-10zm3.5 15h-4V9h-4c-2.8 0-5 2.2-5 5s2.2 5 5 5z"/>
  </svg>
);

export const BadgeDolbyVision = ({ className }: { className?: string }) => (
  <div className={`flex items-center justify-center space-x-[2px] ${className}`}>
    <LogoDolby className="h-full w-auto py-[2px]" />
    <span className="font-black tracking-tighter leading-none transform scale-y-90">VISION</span>
  </div>
);

export const BadgeDolbyAtmos = ({ className }: { className?: string }) => (
  <div className={`flex items-center justify-center space-x-[2px] ${className}`}>
    <LogoDolby className="h-full w-auto py-[2px]" />
    <span className="font-black tracking-tighter leading-none transform scale-y-90">ATMOS</span>
  </div>
);

export const BadgeHDR10Plus = ({ className }: { className?: string }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <span className="font-black tracking-tight leading-none">HDR10+</span>
  </div>
);

export const BadgeDTS = ({ className }: { className?: string }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <span className="font-black italic tracking-tighter leading-none lowercase">dts</span>
  </div>
);

export const BadgeDDPlus = ({ className }: { className?: string }) => (
  <div className={`flex items-center justify-center space-x-[2px] ${className}`}>
    <LogoDolby className="h-full w-auto py-[2px]" />
    <span className="font-black tracking-tighter leading-none transform scale-y-90">DD+</span>
  </div>
);
