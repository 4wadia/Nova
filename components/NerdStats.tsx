import React from 'react';
import { VideoFile } from '../types';

// --- Helpers ---
const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- Types ---
export interface RealtimeStats {
    dropped: number;
    totalFrames: number;
    buffer: number;
    videoWidth: number;
    videoHeight: number;
    displayWidth: number;
    displayHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    fps: number;
    playbackRate: number;
    currentQuality: string;
    gpuAccelerated: boolean;
}

interface NerdStatsProps {
    video: VideoFile;
    realtimeStats: RealtimeStats;
    currentTime: number;
    duration: number;
    volume: number;
    colorSpace: string;
    aspectRatio: string;
    isHDR: boolean;
    isScreenHDR: boolean;
    visible: boolean;
    onClose: () => void;
}

// --- Reusable stat row ---
const StatRow = ({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) => (
    <div className="flex justify-between items-baseline">
        <span className="text-white/40 text-[9px]">{label}</span>
        <span className={`text-[11px] ${valueClass || 'text-white/80'}`}>{value}</span>
    </div>
);

// --- Section wrapper ---
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5 space-y-2">
        <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">▸ {title}</h4>
        {children}
    </div>
);

// --- Main Component ---
export const NerdStats: React.FC<NerdStatsProps> = ({
    video,
    realtimeStats,
    currentTime,
    duration,
    volume,
    colorSpace,
    aspectRatio,
    isHDR,
    isScreenHDR,
    visible,
    onClose,
}) => {
    const frameLoss = realtimeStats.totalFrames > 0
        ? ((realtimeStats.dropped / realtimeStats.totalFrames) * 100).toFixed(2)
        : '0.00';

    return (
        <div className={`
            absolute top-32 right-8 w-[420px] bg-black/85 backdrop-blur-2xl border border-white/10 rounded-2xl p-0 text-[11px] text-white/90 z-20 shadow-[0_24px_48px_rgba(0,0,0,0.6)] transition-all duration-600 ease-expressive font-mono overflow-hidden
            ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-8 scale-95 pointer-events-none'}
        `}>
            {/* Header */}
            <div className="bg-white/5 px-5 py-3 flex justify-between items-center border-b border-white/10">
                <h3 className="font-black uppercase tracking-widest text-[10px] text-white/50 flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                    Stats for Nerds
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/30 font-medium">Nova v2.5</span>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors text-white/40 hover:text-white">
                        <span className="material-icons-round text-sm">close</span>
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-3 selection:bg-primary/30 max-h-[70vh] overflow-y-auto custom-scrollbar">

                {/* ── Section: Playback ── */}
                <Section title="Playback">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        <StatRow label="Live FPS" value={realtimeStats.fps} valueClass="text-green-400 font-black" />
                        <StatRow label="Speed" value={`${realtimeStats.playbackRate}x`} />
                        <StatRow label="Decoded" value={realtimeStats.totalFrames.toLocaleString()} />
                        <StatRow label="Dropped" value={realtimeStats.dropped} valueClass={`font-black ${realtimeStats.dropped > 0 ? 'text-red-400' : 'text-white/80'}`} />
                        <StatRow label="Position" value={`${formatTime(currentTime)} / ${formatTime(duration)}`} />
                        <StatRow label="Frame Loss" value={`${frameLoss}%`} valueClass={realtimeStats.totalFrames > 0 && (realtimeStats.dropped / realtimeStats.totalFrames) > 0.01 ? 'text-red-400' : 'text-white/80'} />
                    </div>
                </Section>

                {/* ── Section: Video Pipeline ── */}
                <Section title="Video Pipeline">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        <StatRow label="Source" value={`${realtimeStats.videoWidth}×${realtimeStats.videoHeight}`} />
                        <StatRow label="Display" value={`${realtimeStats.displayWidth}×${realtimeStats.displayHeight}`} />
                        <StatRow label="Codec" value={video.metadata.videoCodec} />
                        <StatRow label="Container" value={video.metadata.container} />
                        <StatRow label="Bitrate" value={video.metadata.bitrate || 'N/A'} />
                        <StatRow label="Frame Rate" value={`${video.metadata.frameRate || '24'} fps`} />
                        <StatRow label="Color Space" value={colorSpace.toUpperCase()} />
                        <StatRow label="HDR" value={isHDR ? video.metadata.hdrType : 'Off'} valueClass={`font-bold ${isHDR ? 'text-primary' : 'text-white/40'}`} />
                        <StatRow label="Aspect Ratio" value={aspectRatio} />
                        <StatRow label="GPU Accel" value={realtimeStats.gpuAccelerated ? 'Active' : 'Disabled'} valueClass={realtimeStats.gpuAccelerated ? 'text-green-400' : 'text-yellow-400'} />
                    </div>
                </Section>

                {/* ── Section: Audio Pipeline ── */}
                <Section title="Audio Pipeline">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        <StatRow label="Codec" value={video.metadata.audioCodec} />
                        <StatRow label="Channels" value={video.metadata.audioChannels || '5.1'} />
                        <StatRow label="Sample Rate" value="48000 Hz" />
                        <StatRow label="Volume" value={`${Math.round(volume * 100)}%`} />
                    </div>
                </Section>

                {/* ── Section: Buffer & File ── */}
                <Section title="Buffer & File">
                    <div className="space-y-2">
                        {/* Buffer health bar */}
                        <div className="flex items-center gap-3">
                            <span className="text-white/40 text-[9px] w-14 shrink-0">Buffer</span>
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${realtimeStats.buffer < 2 ? 'bg-red-500' : realtimeStats.buffer < 5 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                    style={{ width: `${Math.min(100, (realtimeStats.buffer / 30) * 100)}%` }}
                                />
                            </div>
                            <span className={`text-[11px] font-black w-10 text-right ${realtimeStats.buffer < 2 ? 'text-red-400' : realtimeStats.buffer < 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                                {realtimeStats.buffer.toFixed(1)}s
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                            <StatRow label="File Size" value={formatBytes(video.size)} />
                            <StatRow label="Duration" value={video.metadata.duration} />
                        </div>
                    </div>
                </Section>

                {/* ── Section: System ── */}
                <Section title="System">
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-baseline">
                            <span className="text-white/40 text-[9px]">Device</span>
                            <span className="text-white/60 text-[10px] truncate max-w-[280px] text-right">{navigator.userAgent.split(') ')[0]})</span>
                        </div>
                        <StatRow label="Viewport" value={`${realtimeStats.viewportWidth}×${realtimeStats.viewportHeight}`} />
                        <StatRow label="Screen HDR" value={isScreenHDR ? 'Supported' : 'Not Supported'} valueClass={isScreenHDR ? 'text-green-400' : 'text-white/40'} />
                        <div className="flex justify-between items-center cursor-pointer group" onClick={() => { navigator.clipboard.writeText(video.id); }}>
                            <span className="text-white/40 text-[9px]">Video ID</span>
                            <div className="flex items-center gap-1">
                                <span className="text-white/60 text-[10px] truncate max-w-[220px] group-hover:text-primary transition-colors">{video.id}</span>
                                <span className="material-icons-round text-[10px] text-white/20 group-hover:text-primary transition-colors">content_copy</span>
                            </div>
                        </div>
                    </div>
                </Section>
            </div>
        </div>
    );
};
