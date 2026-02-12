import React from 'react';
import { VideoFile } from '../types';

interface VideoTileProps {
  video: VideoFile;
  onClick: (video: VideoFile) => void;
}

// --- SVG Icons ---
import { LogoDolby, LogoDolbyVision, LogoDolbyAtmos } from './Logos';

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
      className="group relative flex flex-col w-full cursor-pointer transition-all duration-500 ease-expressive hover:scale-[1.02] active:scale-[0.98]"
    >
      {/* No glow effect */}

      {/* Thumbnail Container */}
      <div className={`
        relative w-full aspect-video bg-card rounded-2xl overflow-hidden 
        border border-border transition-all duration-500 shadow-sm group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]
        ${wasPlayed ? 'ring-1 ring-primary/30' : 'group-hover:border-primary/30'}
      `}>

        {/* Thumbnail or Placeholder */}
        {video.thumbnail ? (
          <img src={video.thumbnail} alt={video.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-zinc-800 dark:bg-zinc-900 opacity-90 group-hover:opacity-80 transition-opacity duration-500" />
        )}

        {/* Play Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center transform scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500 ease-expressive">
            <span className="material-icons-round text-3xl text-white ml-1">play_arrow</span>
          </div>
        </div>

        {/* Recently Played Indicator - Resume Bar */}
        {wasPlayed && (
          <>
            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40 backdrop-blur-sm z-10">
              <div className="h-full w-2/5 bg-primary shadow-[0_0_12px_rgba(216,121,67,0.8)] rounded-r-full" />
            </div>

            {/* Recently Played Icon/Badge */}
            <div className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 shadow-lg z-20 animate-fade-in">
              <span className="material-icons-round text-[14px] text-white">history</span>
            </div>
          </>
        )}

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-xl rounded-lg text-[10px] font-bold text-white tracking-wide leading-none z-20">
          {video.metadata.duration}
        </div>

        {/* HDR Badge on Thumbnail */}
        {isHDR && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-xl rounded-lg text-white z-20">
            {isDolbyVision ? (
              <LogoDolbyVision />
            ) : (
              <span className="text-[10px] font-black tracking-widest leading-none">
                {video.metadata.hdrType}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="mt-3.5 px-1">
        <h3 className={`text-[14px] font-semibold truncate leading-tight transition-colors duration-400 ${wasPlayed ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>
          {video.name}
        </h3>

        <div className="flex items-center space-x-2 mt-2 h-4 overflow-hidden">
          <span className="text-[9px] font-black text-muted-foreground border border-border bg-muted/30 px-1.5 py-0.5 rounded tracking-widest uppercase transition-colors group-hover:border-primary/20">
            {video.metadata.resolution}
          </span>
          <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">
            {video.metadata.container}
          </span>

          {/* HDR Badge in Metadata Row */}
          {isHDR && (
            <span className={`
                text-[9px] font-black px-2.5 py-1 rounded-md tracking-widest uppercase border transition-all duration-500
                ${isDolbyVision
                ? 'text-foreground border-primary/20 bg-primary/10'
                : 'text-muted-foreground border-border bg-muted/30'
              }
            `}>
              {isDolbyVision ? 'DV' : video.metadata.hdrType}
            </span>
          )}

          {/* Audio Badge */}
          {isAtmos ? (
            <span className="flex items-center px-2.5 py-1 rounded-md border border-border bg-muted/30 text-muted-foreground group-hover:text-primary group-hover:border-primary/30 transition-all duration-500">
              <LogoDolbyAtmos className="h-3.5" />
            </span>
          ) : isDTS ? (
            <span className="text-[9px] font-black px-2.5 py-1 rounded-md tracking-widest uppercase border border-border bg-muted/30 text-muted-foreground group-hover:text-foreground group-hover:border-primary/20 transition-all duration-500">
              DTS
            </span>
          ) : isDD ? (
            <span className="flex items-center text-[9px] font-black px-2.5 py-1 rounded-md tracking-widest uppercase border border-border bg-muted/30 text-muted-foreground group-hover:text-foreground group-hover:border-primary/20 transition-all duration-500">
              <LogoDolby className="h-2 w-2 mr-1" />
              DD+
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
