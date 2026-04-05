import mediaInfoFactory, { type MediaInfo, type MediaInfoResult } from 'mediainfo.js';
import mediaInfoWasmUrl from 'mediainfo.js/MediaInfoModule.wasm?url';
import {
  type Chapter,
  type MediaTechnicalReport,
  type MediaTechnicalTrack,
  type TechnicalTrackType,
  type VideoMetadata,
} from '../types';

type MediaAnalysisResult = {
  metadata: VideoMetadata;
  report: MediaTechnicalReport;
};

type TrackBucketKey = keyof MediaTechnicalReport['tracks'];

let mediaInfoInstancePromise: Promise<MediaInfo<'object'>> | null = null;

const TRACK_TYPE_TO_BUCKET: Record<TechnicalTrackType, TrackBucketKey> = {
  General: 'general',
  Video: 'video',
  Audio: 'audio',
  Text: 'text',
  Image: 'image',
  Menu: 'menu',
  Other: 'other',
};

const CHAPTER_TIME_RE = /^(\d{2}):(\d{2}):(\d{2})(?:[.:](\d{1,3}))?$/;

const getMediaInfoInstance = () => {
  if (!mediaInfoInstancePromise) {
    mediaInfoInstancePromise = mediaInfoFactory({
      format: 'object',
      full: true,
      locateFile: (path) => (path.endsWith('.wasm') ? mediaInfoWasmUrl : path),
    });
  }

  return mediaInfoInstancePromise;
};

const getFirstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
};

const getNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatBitrate = (bps?: number) => {
  if (!bps || bps <= 0) {
    return undefined;
  }

  return `${(bps / 1_000_000).toFixed(2)} Mb/s`;
};

const parseTechnicalTrackType = (typeValue: unknown): TechnicalTrackType => {
  if (typeValue === 'General' || typeValue === 'Video' || typeValue === 'Audio' || typeValue === 'Text' || typeValue === 'Image' || typeValue === 'Menu' || typeValue === 'Other') {
    return typeValue;
  }

  return 'Other';
};

const sanitizeFieldMap = (source: Record<string, unknown>) => {
  const cleaned: Record<string, unknown> = {};

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined || typeof value === 'function') {
      return;
    }
    cleaned[key] = value;
  });

  return cleaned;
};

const toTechnicalTrack = (track: Record<string, unknown>, index: number): MediaTechnicalTrack => {
  const type = parseTechnicalTrackType(track['@type']);

  return {
    type,
    index,
    order: getFirstString(track['@typeorder']),
    id: getFirstString(track.ID_String, track.ID),
    language: getFirstString(track.Language_String3, track.Language_String, track.Language),
    title: getFirstString(track.Title, track.Track, track.Format_Commercial_IfAny, track.Format_Commercial),
    format: getFirstString(track.Format_Commercial_IfAny, track.Format_Commercial, track.Format),
    codecId: getFirstString(track.CodecID, track.CodecID_String),
    fields: sanitizeFieldMap(track),
  };
};

const parseHdrType = (videoTrack?: Record<string, unknown>): VideoMetadata['hdrType'] | undefined => {
  if (!videoTrack) {
    return undefined;
  }

  const hdrText = getFirstString(
    videoTrack.HDR_Format_String,
    videoTrack.HDR_Format,
    videoTrack.HDR_Format_Compatibility,
    videoTrack.Transfer_Characteristics,
  )?.toLowerCase();

  if (!hdrText) {
    return 'SDR';
  }

  if (hdrText.includes('dolby vision')) return 'Dolby Vision';
  if (hdrText.includes('hdr10+')) return 'HDR10+';
  if (hdrText.includes('hdr10')) return 'HDR10';
  if (hdrText.includes('hlg')) return 'HLG';
  return 'SDR';
};

const parseChaptersFromMenuTracks = (menuTracks: MediaTechnicalTrack[]): Chapter[] => {
  const chapters: Chapter[] = [];

  menuTracks.forEach((track) => {
    Object.entries(track.fields).forEach(([key, value]) => {
      const match = key.match(CHAPTER_TIME_RE);
      if (!match) {
        return;
      }

      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      const seconds = Number(match[3]);
      const milliseconds = Number((match[4] || '0').padEnd(3, '0'));
      const startTime = (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000);

      const valueLabel = typeof value === 'string' ? value : '';
      const title = valueLabel.trim() || `Chapter ${chapters.length + 1}`;

      chapters.push({ title, startTime });
    });
  });

  return chapters.sort((a, b) => a.startTime - b.startTime);
};

const createTechnicalReport = (file: File, result: MediaInfoResult): MediaTechnicalReport => {
  const tracksRaw = result.media?.track ?? [];
  const groupedTracks: MediaTechnicalReport['tracks'] = {
    general: [],
    video: [],
    audio: [],
    text: [],
    image: [],
    menu: [],
    other: [],
  };

  tracksRaw.forEach((rawTrack, index) => {
    const track = toTechnicalTrack(rawTrack as unknown as Record<string, unknown>, index);
    const bucket = TRACK_TYPE_TO_BUCKET[track.type] ?? 'other';
    groupedTracks[bucket].push(track);
  });

  return {
    analyzer: 'mediainfo.js',
    generatedAt: Date.now(),
    fileName: file.name,
    fileSize: file.size,
    creatingLibrary: {
      name: 'MediaInfoLib',
      version: result.creatingLibrary?.version,
      url: result.creatingLibrary?.url,
    },
    tracks: groupedTracks,
    raw: result as unknown as Record<string, unknown>,
  };
};

const createMetadataFromReport = (
  file: File,
  report: MediaTechnicalReport,
  fallbackMetadata?: VideoMetadata,
): VideoMetadata => {
  const general = report.tracks.general[0]?.fields ?? {};
  const video = report.tracks.video[0]?.fields ?? {};
  const audio = report.tracks.audio[0]?.fields ?? {};

  const durationSeconds =
    getNumber(general.Duration) ??
    getNumber(video.Duration) ??
    getNumber(audio.Duration) ??
    fallbackMetadata?.durationSeconds ??
    0;

  const width = getNumber(video.Width);
  const height = getNumber(video.Height);
  const resolution =
    (width && height)
      ? `${Math.round(width)}x${Math.round(height)}`
      : fallbackMetadata?.resolution ?? 'Unknown';

  const container = getFirstString(general.Format, general.InternetMediaType, fallbackMetadata?.container, file.name.split('.').pop()) ?? 'Unknown';
  const videoCodec = getFirstString(video.Format_Commercial_IfAny, video.Format_Commercial, video.Format, video.CodecID, fallbackMetadata?.videoCodec) ?? 'Unknown';
  const audioCodec = getFirstString(audio.Format_Commercial_IfAny, audio.Format_Commercial, audio.Format, audio.CodecID, fallbackMetadata?.audioCodec) ?? 'Unknown';
  const audioChannels = getFirstString(audio.ChannelLayout, audio.ChannelLayout_Original, audio.Channels_String2, audio.Channels, fallbackMetadata?.audioChannels);
  const frameRateValue = getNumber(video.FrameRate);
  const frameRate = frameRateValue ? frameRateValue.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1') : fallbackMetadata?.frameRate;
  const colorSpace = getFirstString(video.ColorSpace, video.colour_primaries, fallbackMetadata?.colorSpace);
  const bitrate = getFirstString(general.OverallBitRate_String, video.BitRate_String, audio.BitRate_String, formatBitrate(getNumber(general.OverallBitRate)), fallbackMetadata?.bitrate);

  const hdrType = parseHdrType(video);
  const chapters = parseChaptersFromMenuTracks(report.tracks.menu);

  return {
    duration: formatDuration(durationSeconds),
    durationSeconds,
    resolution,
    videoCodec,
    audioCodec,
    container,
    hdrType: hdrType ?? fallbackMetadata?.hdrType,
    audioChannels,
    bitrate,
    frameRate,
    colorSpace,
    videoBitDepth: getFirstString(video.BitDepth, fallbackMetadata?.videoBitDepth),
    chromaSubsampling: getFirstString(video.ChromaSubsampling, fallbackMetadata?.chromaSubsampling),
    scanType: getFirstString(video.ScanType, fallbackMetadata?.scanType),
    masteringDisplay: getFirstString(video.MasteringDisplay_ColorPrimaries, video.MasteringDisplay_Luminance, fallbackMetadata?.masteringDisplay),
    maxCLL: getFirstString(video.MaxCLL_String, video.MaxCLL, fallbackMetadata?.maxCLL),
    maxFALL: getFirstString(video.MaxFALL_String, video.MaxFALL, fallbackMetadata?.maxFALL),
    intro: fallbackMetadata?.intro,
    chapters: chapters.length > 0 ? chapters : fallbackMetadata?.chapters,
    analysisStatus: 'ready',
  };
};

export const buildFallbackTechnicalReport = (
  file: File,
  metadata: VideoMetadata,
  analysisError?: string,
): MediaTechnicalReport => {
  const fallbackTrack: MediaTechnicalTrack = {
    type: 'General',
    index: 0,
    title: file.name,
    format: metadata.container,
    fields: {
      FileName: file.name,
      FileSize: file.size,
      Duration: metadata.durationSeconds,
      Resolution: metadata.resolution,
      VideoCodec: metadata.videoCodec,
      AudioCodec: metadata.audioCodec,
      Container: metadata.container,
      HDR: metadata.hdrType,
      Bitrate: metadata.bitrate,
      FrameRate: metadata.frameRate,
      ColorSpace: metadata.colorSpace,
      AnalysisError: analysisError,
    },
  };

  return {
    analyzer: 'fallback',
    generatedAt: Date.now(),
    fileName: file.name,
    fileSize: file.size,
    tracks: {
      general: [fallbackTrack],
      video: [],
      audio: [],
      text: [],
      image: [],
      menu: [],
      other: [],
    },
    analysisError,
  };
};

export const analyzeMediaFile = async (
  file: File,
  fallbackMetadata?: VideoMetadata,
): Promise<MediaAnalysisResult> => {
  const mediaInfo = await getMediaInfoInstance();

  const readChunk = async (chunkSize: number, offset: number) => {
    const buffer = await file.slice(offset, offset + chunkSize).arrayBuffer();
    return new Uint8Array(buffer);
  };

  const result = await mediaInfo.analyzeData(file.size, readChunk) as MediaInfoResult;
  const report = createTechnicalReport(file, result);
  const metadata = createMetadataFromReport(file, report, fallbackMetadata);

  return { metadata, report };
};

export const analyzeMediaBlob = async (
  blob: Blob,
  fileName: string,
  fallbackMetadata?: VideoMetadata,
): Promise<MediaAnalysisResult> => {
  const file = blob instanceof File
    ? blob
    : new File([blob], fileName, { type: blob.type || 'application/octet-stream' });

  return analyzeMediaFile(file, fallbackMetadata);
};
