export interface NavItem {
    id: string;
    label: string;
}

export interface Chapter {
    title: string;
    startTime: number;
    endTime?: number;
}

export type MediaAnalysisStatus = 'pending' | 'ready' | 'failed';

export type TechnicalTrackType = 'General' | 'Video' | 'Audio' | 'Text' | 'Image' | 'Menu' | 'Other';

export interface MediaTechnicalTrack {
    type: TechnicalTrackType;
    index: number;
    order?: string;
    id?: string;
    language?: string;
    title?: string;
    format?: string;
    codecId?: string;
    fields: Record<string, unknown>;
}

export interface MediaTechnicalReport {
    analyzer: 'mediainfo.js' | 'fallback';
    generatedAt: number;
    fileName: string;
    fileSize: number;
    creatingLibrary?: {
        name?: string;
        version?: string;
        url?: string;
    };
    tracks: {
        general: MediaTechnicalTrack[];
        video: MediaTechnicalTrack[];
        audio: MediaTechnicalTrack[];
        text: MediaTechnicalTrack[];
        image: MediaTechnicalTrack[];
        menu: MediaTechnicalTrack[];
        other: MediaTechnicalTrack[];
    };
    raw?: Record<string, unknown>;
    analysisError?: string;
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
    videoBitDepth?: string;
    chromaSubsampling?: string;
    scanType?: string;
    masteringDisplay?: string;
    maxCLL?: string;
    maxFALL?: string;
    intro?: { start: number; end: number };
    chapters?: Chapter[];
    analysisStatus?: MediaAnalysisStatus;
    analysisError?: string;
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
