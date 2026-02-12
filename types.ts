export interface QuickAccessItem {
    id: string;
    label: string;
    icon: string;
    colorClass: string;
    iconColorClass: string;
    isActive?: boolean;
}

export interface NavItem {
    id: string;
    label: string;
}

export interface Chapter {
    title: string;
    startTime: number;
    endTime?: number; // Optional, can be inferred from next chapter
}

export interface VideoMetadata {
    duration: string;
    resolution: string;
    videoCodec: string;
    audioCodec: string;
    container: string;
    hdrType?: 'HDR10' | 'HDR10+' | 'Dolby Vision' | 'HLG' | 'SDR';
    audioChannels?: string;
    bitrate?: string;
    frameRate?: string;
    colorSpace?: string;
    intro?: { start: number; end: number };
    chapters?: Chapter[];
}

export interface VideoFile {
    id: string;
    file: File;
    name: string;
    url: string;
    size: number;
    metadata: VideoMetadata;
    lastPlayed?: number; // timestamp in seconds
}