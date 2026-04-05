import React from 'react';
import { VideoFile } from '../types';

interface VideoTileProps {
  video: VideoFile;
  onClick: (video: VideoFile) => void;
  isSelected?: boolean;
}

import { BadgeDolbyVision, BadgeDolbyAtmos, BadgeHDR10Plus, BadgeDTS, BadgeDDPlus } from './FormatBadges';

export const VideoTile: React.FC<VideoTileProps> = ({ video, onClick, isSelected }) => {
  const isDolbyVision = video.metadata.hdrType === 'Dolby Vision';
  const isAtmos = video.metadata.audioCodec?.includes('Atmos');
  const isDTS = video.metadata.audioCodec?.includes('DTS');
  const isDD = video.metadata.audioCodec === 'Dolby Digital';
  const wasPlayed = !!video.lastPlayed;
  const isHDR = video.metadata.hdrType && video.metadata.hdrType !== 'SDR';
  
  const playPosition = video.playPosition || 0;
  const progressPercent = playPosition > 0 && video.metadata.durationSeconds > 0 
      ? (playPosition / video.metadata.durationSeconds) * 100 
      : 0;

  return (
    <div 
      onClick={() => onClick(video)}
      className={`group relative flex flex-col w-full cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 ${isSelected ? 'ring-2 ring-blue-500 rounded-xl' : ''}`}
    >
      {/* Thumbnail Aspect Ratio Container */}
      <div className={`
        relative w-full aspect-video bg-card dark:bg-card rounded-xl overflow-hidden
        border transition-all duration-300 shadow-md group-hover:shadow-xl
        ${wasPlayed ? 'border-primary/50 dark:border-primary/40 ring-1 ring-primary/20' : 'border group-hover:border'}
      `}>
        
        {/* Placeholder Gradient */}
        <div className="absolute inset-0 bg-muted dark:bg-muted/80 transition-colors group-hover:bg-muted dark:group-hover:bg-muted/80"></div>

        {/* Play Icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/10 dark:bg-black/40">
            <span className="material-icons-round text-5xl text-white drop-shadow-md transform scale-90 group-hover:scale-100 transition-transform duration-300">play_circle</span>
        </div>

        {/* Recently Played Indicator - Resume Bar */}
        {(wasPlayed || progressPercent > 0) && (
           <>
             {/* Progress Bar */}
             <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-10">
                 <div 
                    className="h-full bg-primary dark:bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)] rounded-r-full"
                    style={{ width: `${progressPercent}%` }}
                 ></div>
             </div>
             
             {/* Recently Played Icon/Badge */}
             <div className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 backdrop-blur-md border border-primary/40 shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)] z-20 animate-fade-in" title="Recently Played">
                 <span className="material-icons-round text-[14px] text-primary">history</span>
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
            <h3 className={`text-sm font-medium truncate leading-tight transition-colors flex-1 ${wasPlayed ? 'text-primary' : 'text-foreground dark:text-foreground/90 group-hover:text-foreground dark:group-hover:text-foreground'}`}>
            {video.name}
            </h3>
        </div>
        
        <div className="flex items-center space-x-2 mt-1.5 h-4">
          <span className="text-[10px] font-medium text-muted-foreground dark:text-muted-foreground border border px-1 rounded uppercase group-hover:border transition-colors">
            {video.metadata.resolution}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground dark:text-muted-foreground uppercase">
             {video.metadata.container}
          </span>

          {/* HDR Badge in Metadata Row */}
          {isHDR && (
            <span className={`
                text-[10px] font-bold px-1 rounded uppercase border transition-colors
                ${isDolbyVision 
                    ? 'text-primary-foreground border-primary/20 bg-primary/5' 
                    : 'text-muted-foreground border-muted-foreground/30 bg-muted/5'
                }
            `}>
                {isDolbyVision ? 'DV' : video.metadata.hdrType}
            </span>
          )}
          
          {/* Audio Badge */}
          {isAtmos ? (
            <span className="flex items-center text-[10px] font-bold px-1 py-0.5 rounded uppercase border border-muted dark:border-muted bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground group-hover:text-foreground dark:group-hover:text-foreground group-hover:border transition-colors">
                <BadgeDolbyAtmos className="h-2 text-[9px]" />
            </span>
          ) : isDTS ? (
             <span className="flex items-center text-[10px] font-bold px-1 py-0.5 rounded uppercase border border-muted dark:border-muted bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground group-hover:text-foreground dark:group-hover:text-foreground group-hover:border transition-colors">
                 <BadgeDTS className="h-2 text-[10px]" />
             </span>
          ) : isDD ? (
             <span className="flex items-center text-[10px] font-bold px-1 py-0.5 rounded uppercase border border-muted dark:border-muted bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground group-hover:text-foreground dark:group-hover:text-foreground group-hover:border transition-colors">
                 <BadgeDDPlus className="h-2 text-[9px]" />
             </span>
          ) : null}

        </div>
      </div>
    </div>
  );
};