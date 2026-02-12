import React, { useState, useRef } from 'react';

interface DropzoneProps {
  onFileDrop: (files: FileList) => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFileDrop }) => {
  const [isHovering, setIsHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileDrop(e.dataTransfer.files);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileDrop(e.target.files);
    }
  };

  return (
    <div
      className="group relative flex flex-col items-center justify-center w-full max-w-lg aspect-square sm:aspect-[4/3] cursor-pointer transition-transform duration-500 ease-out"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        className="hidden"
        ref={inputRef}
        onChange={handleFileSelect}
        accept="video/*,audio/*,.mkv"
        multiple
      />

      {/* SVG Dashed Border Animation */}
      <div className={`absolute inset-0 transition-all duration-300 ${isHovering ? 'scale-[1.02]' : 'scale-100'}`}>
        <svg className="w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="none">
          <rect
            x="2"
            y="2"
            width="396"
            height="296"
            rx="48"
            fill="none"
            stroke="currentColor"
            strokeWidth={isHovering ? 3 : 2}
            strokeDasharray={isHovering ? "12 14" : "12 12"}
            className="text-border dark:text-primary opacity-60 dark:opacity-40 group-hover:opacity-100 transition-all duration-300"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* Inner Glow Effect */}
      <div className={`
        absolute inset-0 bg-primary/10 rounded-[3rem] 
        transition-opacity duration-500 
        ${isHovering ? 'opacity-100' : 'opacity-0'}
      `} />

      {/* Content */}
      <div className="relative flex flex-col items-center justify-center text-center space-y-6 p-10 z-10">
        {/* Icon Circle */}
        <div className={`
          w-20 h-20 rounded-full 
          bg-card 
          border border-border 
          flex items-center justify-center shadow-xl 
          transition-all duration-300 
          ${isHovering ? 'shadow-primary/30 scale-110' : 'group-hover:shadow-primary/20 group-hover:scale-110'}
        `}>
          <span className={`
            material-icons-round text-4xl transition-colors duration-300
            ${isHovering ? 'text-primary' : 'text-muted-foreground dark:text-primary group-hover:text-primary'}
          `}>
            add
          </span>
        </div>

        {/* Text */}
        <div className="space-y-2 pointer-events-none">
          <h2 className={`
            text-2xl sm:text-3xl font-light tracking-tight transition-colors duration-300
            ${isHovering ? 'text-primary' : 'text-foreground group-hover:text-primary'}
          `}>
            Add videos to library
          </h2>
          <p className="text-muted-foreground font-light text-sm tracking-wide">
            Support for MKV, MP4, HEVC, HDR10+
          </p>
        </div>
      </div>
    </div>
  );
};