import React from 'react';
import { VideoFile } from '../types';

interface VideoTileProps {
  video: VideoFile;
  onClick: (video: VideoFile) => void;
}

// --- SVG Icons ---

const LogoDolby = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="currentColor">
    {/* Double D Symbol */}
    <path d="M4 8h6c4.4 0 8 3.6 8 8s-3.6 8-8 8H4V8zm6 13c2.8 0 5-2.2 5-5s-2.2-5-5-5H7v10h3zm18-13h-6c-4.4 0-8 3.6-8 8s3.6 8 8 8h6V8zm-6 13c-2.8 0-5-2.2-5-5s2.2-5 5-5h3v10h-3z" />
  </svg>
);

const LogoDolbyVision = ({ className }: { className?: string }) => (
  <div className={`flex items-center space-x-1 ${className}`}>
    <LogoDolby className="h-3 w-3" />
    <span className="text-[9px] font-black tracking-tighter leading-none font-sans transform scale-y-90">VISION</span>
  </div>
);

export const VideoTile: React.FC<VideoTileProps> = ({ video, onClick }) => {
  const isDolbyVision = video.metadata.hdrType === 'Dolby Vision';
  const isAtmos = video.metadata.audioCodec?.includes('Atmos');
  const isDTS = video.metadata.audioCodec?.includes('DTS');
  const isDD = video.metadata.audioCodec === 'Dolby Digital';
  const wasPlayed = !!video.lastPlayed;
  const isHDR = video.metadata.hdrType && video.metadata.hdrType !== 'SDR';

  return (
    <div 
      onClick={() => onClick(video)}
      className="group relative flex flex-col w-full cursor-pointer transition-transform duration-200 ease-out hover:scale-[1.01]"
    >
      {/* Thumbnail Aspect Ratio Container */}
      <div className={`
        relative w-full aspect-video bg-white dark:bg-surface-dark rounded-2xl overflow-hidden 
        border transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-zinc-200/50 dark:hover:shadow-white/5
        ${wasPlayed ? 'border-vision-purple/50 dark:border-vision-purple/40 ring-1 ring-vision-purple/20' : 'border-zinc-200 dark:border-white/5 group-hover:border-zinc-300 dark:group-hover:border-white/30'}
      `}>
        
        {/* Placeholder Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-300 dark:from-zinc-800 dark:to-black opacity-80 group-hover:opacity-70 transition-opacity"></div>
        <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-icons-round text-4xl text-zinc-300 dark:text-white/10 group-hover:text-zinc-600 dark:group-hover:text-white transition-colors duration-300">play_circle</span>
        </div>

        {/* Recently Played Indicator - Resume Bar */}
        {wasPlayed && (
           <>
             {/* Progress Bar */}
             <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-10">
                 <div className="h-full w-2/5 bg-vision-purple dark:bg-vision-purple shadow-[0_0_8px_rgba(192,132,252,0.6)] rounded-r-full"></div>
             </div>
             
             {/* Recently Played Icon/Badge */}
             <div className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-vision-purple/20 backdrop-blur-md border border-vision-purple/40 shadow-[0_0_10px_rgba(192,132,252,0.3)] z-20 animate-fade-in" title="Recently Played">
                 <span className="material-icons-round text-[14px] text-vision-purple">history</span>
             </div>
           </>
        )}

        {/* Duration Badge */}
        <div className="absolute bottom-1.5 right-1.5 px-1 py-0.5 bg-black/60 backdrop-blur-md border border-white/5 rounded-md text-[10px] font-medium text-white/90 tracking-wide leading-none z-20">
          {video.metadata.duration}
        </div>

        {/* HDR Badge Logic (On Thumbnail) - Reverted to White/Original */}
        {isHDR && (
           <>
              {isDolbyVision ? (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-1 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-white/90">
                      <LogoDolbyVision />
                  </div>
              ) : (
                  <div className="absolute top-1.5 left-1.5 px-1 py-0.5 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-[10px] font-bold text-white/90 tracking-wider leading-none">
                      {video.metadata.hdrType}
                  </div>
              )}
           </>
        )}
      </div>

      {/* Info */}
      <div className="mt-2.5 px-0.5">
        <div className="flex items-center justify-between">
            <h3 className={`text-sm font-medium truncate leading-tight transition-colors flex-1 ${wasPlayed ? 'text-vision-purple dark:text-vision-purple' : 'text-zinc-800 dark:text-text-main/90 group-hover:text-zinc-900 dark:group-hover:text-white'}`}>
            {video.name}
            </h3>
        </div>
        
        <div className="flex items-center space-x-2 mt-1.5 h-4">
          <span className="text-[10px] font-medium text-zinc-500 dark:text-text-muted border border-zinc-200 dark:border-white/5 px-1 rounded uppercase group-hover:border-zinc-300 dark:group-hover:border-white/10 transition-colors">
            {video.metadata.resolution}
          </span>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-text-muted uppercase">
             {video.metadata.container}
          </span>

          {/* HDR Badge in Metadata Row */}
          {isHDR && (
            <span className={`
                text-[10px] font-bold px-1 rounded uppercase border transition-colors
                ${isDolbyVision 
                    ? 'text-white border-white/20 bg-white/5' 
                    : 'text-zinc-400 border-zinc-500/30 bg-zinc-500/5'
                }
            `}>
                {isDolbyVision ? 'DV' : video.metadata.hdrType}
            </span>
          )}
          
          {/* Audio Badge */}
          {isAtmos ? (
            <span className="flex items-center text-[10px] font-bold px-1 rounded uppercase border border-zinc-200 dark:border-zinc-500/30 bg-zinc-50 dark:bg-zinc-500/5 text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-white group-hover:border-zinc-300 dark:group-hover:border-white/20 transition-colors">
                <LogoDolby className="h-2 w-2 mr-0.5" />
                ATMOS
            </span>
          ) : isDTS ? (
             <span className="text-[10px] font-bold px-1 rounded uppercase border border-zinc-200 dark:border-zinc-500/30 bg-zinc-50 dark:bg-zinc-500/5 text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-white group-hover:border-zinc-300 dark:group-hover:border-white/20 transition-colors">
                 DTS
             </span>
          ) : isDD ? (
             <span className="flex items-center text-[10px] font-bold px-1 rounded uppercase border border-zinc-200 dark:border-zinc-500/30 bg-zinc-50 dark:bg-zinc-500/5 text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-white group-hover:border-zinc-300 dark:group-hover:border-white/20 transition-colors">
                 <LogoDolby className="h-2 w-2 mr-0.5" />
                 DD+
             </span>
          ) : null}

        </div>
      </div>
    </div>
  );
};