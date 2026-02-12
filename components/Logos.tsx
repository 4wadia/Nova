import React from 'react';

// ─── Dolby Double-D Logo ───
// The official Dolby double-D mark
export const LogoDolby = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 64 36" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0h18.4C29.2 0 36 7.2 36 18s-6.8 18-17.6 18H0V0zm9.6 28.8h8.8c5.2 0 9.2-4.8 9.2-10.8s-4-10.8-9.2-10.8H9.6v21.6z" />
        <path d="M64 0H45.6C34.8 0 28 7.2 28 18s6.8 18 17.6 18H64V0zm-9.6 28.8h-8.8c-5.2 0-9.2-4.8-9.2-10.8s4-10.8 9.2-10.8h8.8v21.6z" />
    </svg>
);

// ─── Dolby Vision Logo ───
// Double-D mark + "VISION" wordmark
export const LogoDolbyVision = ({ className }: { className?: string }) => (
    <div className={`flex items-center gap-0.5 ${className || ''}`}>
        <LogoDolby className="h-3.5 w-auto" />
        <div className="flex flex-col justify-center leading-[0.8] ml-0.5">
            <span className="text-[7px] font-bold tracking-[0.02em] opacity-90">Dolby</span>
            <span className="text-[8px] font-black tracking-[0.02em] uppercase">VISION</span>
        </div>
    </div>
);

// ─── Dolby Atmos Logo ───
// Double-D mark + "ATMOS" wordmark
export const LogoDolbyAtmos = ({ className }: { className?: string }) => (
    <div className={`flex items-center gap-0.5 ${className || ''}`}>
        <LogoDolby className="h-3.5 w-auto" />
        <div className="flex flex-col justify-center leading-[0.8] ml-0.5">
            <span className="text-[7px] font-bold tracking-[0.02em] opacity-90">Dolby</span>
            <span className="text-[8px] font-black tracking-[0.02em] uppercase">ATMOS</span>
        </div>
    </div>
);

// ─── DTS Logo ───
// Accurate DTS wordmark with the distinctive styling
export const LogoDTS = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 120 40" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        {/* D */}
        <path d="M0 4h14c10 0 17 7 17 16s-7 16-17 16H0V4zm8 6v20h6c5.5 0 9.5-4.5 9.5-10S19.5 10 14 10H8z" />
        {/* T */}
        <path d="M36 4h28v7H54v25h-8V11H36V4z" />
        {/* S */}
        <path d="M69 4h26v7H78c-1.5 0-2.5 1-2.5 2.5S77 16 79 16h10c5 0 8 3.5 8 8.5S94 33 89 33v3H69v-7h18.5c1.5 0 2.5-1 2.5-2.5S89 24 87 24H77c-5 0-8-3.5-8-8.5S72.5 7 77 7h-8V4z" />
    </svg>
);

// ─── DTS:X Logo ───
export const LogoDTSX = ({ className }: { className?: string }) => (
    <div className={`flex items-center gap-0.5 ${className || ''}`}>
        <LogoDTS className="h-3.5 w-auto" />
        <span className="text-[9px] font-black">:X</span>
    </div>
);

// ─── HDR10 Badge ───
export const LogoHDR10 = ({ className }: { className?: string }) => (
    <span className={`font-black tracking-wider text-[10px] ${className || ''}`}>
        HDR10
    </span>
);

// ─── HDR10+ Badge ───
export const LogoHDR10Plus = ({ className }: { className?: string }) => (
    <span className={`font-black tracking-wider text-[10px] ${className || ''}`}>
        HDR10+
    </span>
);

// ─── IMAX Enhanced Logo ───
export const LogoIMAX = ({ className }: { className?: string }) => (
    <span className={`font-black tracking-[0.2em] text-[10px] ${className || ''}`}>
        IMAX
    </span>
);
