import React from 'react';
import { VideoFile } from '../types';

interface VideoTileProps {
  video: VideoFile;
  onClick: (video: VideoFile) => void;
}

import { BadgeDolbyVision, BadgeDolbyAtmos, BadgeHDR10Plus, BadgeDTS, BadgeDDPlus } from './FormatBadges';

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
      className="group relative flex flex-col w-full cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1"
    >
      {/* Thumbnail Aspect Ratio Container */}
      <div className={`
        relative w-full aspect-video bg-white dark:bg-surface-dark rounded-xl overflow-hidden
        border transition-all duration-300 shadow-md group-hover:shadow-xl dark:shadow-black/40
        ${wasPlayed ? 'border-vision-purple/50 dark:border-vision-purple/40 ring-1 ring-vision-purple/20' : 'border-zinc-200 dark:border-white/5 group-hover:border-zinc-300 dark:group-hover:border-white/20'}
      `}>
        
        {/* Placeholder Gradient */}
        <div className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800/80 transition-colors group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700/80"></div>

        {/* Play Icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/10 dark:bg-black/40">
            <span className="material-icons-round text-5xl text-white drop-shadow-md transform scale-90 group-hover:scale-100 transition-transform duration-300">play_circle</span>
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

        {/* HDR Badge Logic (On Thumbnail) */}
        {isHDR && (
           <>
              {isDolbyVision ? (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-1 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-white/90">
                      <BadgeDolbyVision className="h-2 text-[9px]" />
                  </div>
              ) : video.metadata.hdrType === 'HDR10+' ? (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-1 bg-black/40 border border-white/10 backdrop-blur-md rounded-md text-white/90">
                      <BadgeHDR10Plus className="h-2 text-[10px]" />
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
            <span className="flex items-center text-[10px] font-bold px-1 py-0.5 rounded uppercase border border-zinc-200 dark:border-zinc-500/30 bg-zinc-50 dark:bg-zinc-500/5 text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-white group-hover:border-zinc-300 dark:group-hover:border-white/20 transition-colors">
                <BadgeDolbyAtmos className="h-2 text-[9px]" />
            </span>
          ) : isDTS ? (
             <span className="flex items-center text-[10px] font-bold px-1 py-0.5 rounded uppercase border border-zinc-200 dark:border-zinc-500/30 bg-zinc-50 dark:bg-zinc-500/5 text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-white group-hover:border-zinc-300 dark:group-hover:border-white/20 transition-colors">
                 <BadgeDTS className="h-2 text-[10px]" />
             </span>
          ) : isDD ? (
             <span className="flex items-center text-[10px] font-bold px-1 py-0.5 rounded uppercase border border-zinc-200 dark:border-zinc-500/30 bg-zinc-50 dark:bg-zinc-500/5 text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-white group-hover:border-zinc-300 dark:group-hover:border-white/20 transition-colors">
                 <BadgeDDPlus className="h-2 text-[9px]" />
             </span>
          ) : null}

        </div>
      </div>
    </div>
  );
};