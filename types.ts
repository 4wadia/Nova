export interface NavItem {
    id: string;
    label: string;
}

export interface Chapter {
    title: string;
    startTime: number;
    endTime?: number;
}

export interface VideoMetadata {
    duration: string;
    durationSeconds: number;
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
    file?: File;
    name: string;
    url: string;
    size: number;
    metadata: VideoMetadata;
    lastPlayed?: number;
    playPosition?: number;
}

export interface Playlist {
    id: string;
    name: string;
    videoIds: string[];
    createdAt: number;
}

export interface WatchHistoryEntry {
    videoId: string;
    videoName: string;
    watchedAt: number;
    duration: number;
    position: number;
}

export interface SubtitleStyle {
    fontFamily: string;
    fontSize: number;
    color: string;
    backgroundColor: string;
    outlineColor: string;
    outlineWidth: number;
}
