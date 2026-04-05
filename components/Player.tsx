import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { VideoFile } from '../types';

interface PlayerProps {
  video: VideoFile;
  onBack: () => void;
  onProgress?: (position: number, duration: number) => void;
}

interface SubtitleCue {
    start: number;
    end: number;
    text: string;
}

interface Track {
    id: string;
    label: string;
    lang?: string;
    isDefault?: boolean;
    cues?: SubtitleCue[];
}

// --- Helper: SRT Parser ---
const parseSRT = (content: string): SubtitleCue[] => {
    const cues: SubtitleCue[] = [];
    // Normalize line endings
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalized.split('\n\n');

    blocks.forEach(block => {
        const lines = block.trim().split('\n');
        if (lines.length < 2) return;

        // Determine if first line is an index or timestamp (sometimes index is missing)
        let timeIndex = 0;
        if (lines[0].match(/^\d+$/) && lines[1]?.includes('-->')) {
            timeIndex = 1;
        }

        const timeLine = lines[timeIndex];
        if (!timeLine || !timeLine.includes('-->')) return;

        const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
        
        const parseTime = (timeStr: string) => {
            if (!timeStr) return 0;
            // Handle both comma (SRT) and dot (VTT) for milliseconds
            const [hms, msStr] = timeStr.split(/[,.]/); 
            const [h, m, s] = hms.split(':').map(Number);
            const ms = parseInt(msStr || '0', 10);
            return (h * 3600) + (m * 60) + s + (ms / 1000);
        };

        const start = parseTime(startStr);
        const end = parseTime(endStr);
        const text = lines.slice(timeIndex + 1).join('\n').replace(/<\/?[^>]+(>|$)/g, ""); // basic strip HTML tags

        if (!isNaN(start) && !isNaN(end)) {
            cues.push({ start, end, text });
        }
    });

    return cues;
};

// --- Helper: Format Bytes ---
const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- SVG Icons ---

import { BadgeDolbyVision, BadgeDolbyAtmos, BadgeHDR10Plus, BadgeDTS, BadgeDDPlus } from './FormatBadges';

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const detectBrowserName = (userAgent: string) => {
  if (/edg\//i.test(userAgent)) return 'Edge';
  if (/opr\//i.test(userAgent)) return 'Opera';
  if (/chrome\//i.test(userAgent)) return 'Chrome';
  if (/firefox\//i.test(userAgent)) return 'Firefox';
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return 'Safari';
  return 'Unknown Browser';
};

const detectPlatformName = (userAgent: string, platform: string) => {
  if (/windows/i.test(userAgent) || /win/i.test(platform)) return 'Windows';
  if (/mac os x|macintosh/i.test(userAgent) || /mac/i.test(platform)) return 'macOS';
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
  if (/linux/i.test(userAgent) || /linux/i.test(platform)) return 'Linux';
  return platform || 'Unknown Platform';
};

export const Player: React.FC<PlayerProps> = ({ video, onBack, onProgress }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [showChapterList, setShowChapterList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isHoveringSeekBar, setIsHoveringSeekBar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Video Settings State
  const [aspectRatio, setAspectRatio] = useState('fit');
  const [colorSpace, setColorSpace] = useState<'bt709' | 'dcip3' | 'bt2020' | 'srgb'>('bt709');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Audio State
  const [audioTracks, setAudioTracks] = useState<Track[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>('1');

  // Subtitle State
  const [subtitleTracks, setSubtitleTracks] = useState<Track[]>([]);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState<string>('off');
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  
  const [subtitleSize, setSubtitleSize] = useState(1); // 1 = 100%
  const [subtitleOffset, setSubtitleOffset] = useState(0); // in seconds
  const [subtitleBackgroundColor, setSubtitleBackgroundColor] = useState('rgba(0,0,0,0.4)');
  const [subtitleTextColor, setSubtitleTextColor] = useState('#ffffff');
  
  // Real-time Stats State
  const [realtimeStats, setRealtimeStats] = useState({
      dropped: 0,
      totalFrames: 0,
      buffer: 0,
      videoWidth: 0,
      videoHeight: 0,
      displayWidth: 0,
      displayHeight: 0,
      viewportWidth: 0,
      viewportHeight: 0,
      fps: 0,
  });
  
  const fpsTracker = useRef({ frames: 0, lastTime: 0, value: 0 });

  // State to store HDR support capabilities
  const [isScreenHDR, setIsScreenHDR] = useState(false);
  
  const controlsTimeoutRef = useRef<number | null>(null);
  const lastProgressEmitRef = useRef(0);
  const copySpecsTimeoutRef = useRef<number | null>(null);
  const [specsCopyState, setSpecsCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  // --- Initialize Tracks (Mocking based on Metadata) ---
  useEffect(() => {
    // 1. Audio Tracks
    const mockAudio: Track[] = [
        { id: '1', label: `${video.metadata.audioCodec || 'AAC'} 5.1 (Default)`, lang: 'en', isDefault: true },
        { id: '2', label: 'Stereo (AAC)', lang: 'en' }
    ];
    
    // Parse duration string to seconds
    const timeParts = video.metadata.duration.split(':').reverse().map(Number);
    let seconds = 0;
    if (timeParts[0]) seconds += timeParts[0];
    if (timeParts[1]) seconds += timeParts[1] * 60;
    if (timeParts[2]) seconds += timeParts[2] * 3600;

    // Add commentary if it looks like a movie
    if (seconds > 1800) { // > 30 mins
        mockAudio.push({ id: '3', label: 'Director Commentary', lang: 'en' });
    }
    setAudioTracks(mockAudio);

    // 2. Subtitle Tracks
    // We start with none unless we want to mock embedded ones. 
    // Let's assume one embedded English track if it's a "file" type that usually supports it.
    const mockSubs: Track[] = [];
    setSubtitleTracks(mockSubs);
  }, [video]);

  // --- HDR Support Check ---
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
        const mediaQuery = window.matchMedia('(dynamic-range: high)');
        setIsScreenHDR(mediaQuery.matches);
        
        // Auto-set color space if HDR detected
        if (mediaQuery.matches && video.metadata.hdrType) {
            setColorSpace('bt2020');
        }

        const handleChange = (e: MediaQueryListEvent) => {
            setIsScreenHDR(e.matches);
            if (e.matches && video.metadata.hdrType) setColorSpace('bt2020');
            else if (!e.matches) setColorSpace('bt709');
        };
        
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [video.metadata.hdrType]);

  // --- Realtime Stats Loop ---
  useEffect(() => {
    if (!showStats) return;
    let animationFrameId: number;
    fpsTracker.current = { frames: 0, lastTime: performance.now(), value: 0 };

    const updateStats = () => {
        if (videoRef.current) {
            const v = videoRef.current;
            
            // Buffer Health Calculation
            let bufferEnd = 0;
            for (let i = 0; i < v.buffered.length; i++) {
                if (v.buffered.start(i) <= v.currentTime && v.buffered.end(i) >= v.currentTime) {
                    bufferEnd = v.buffered.end(i);
                    break;
                }
            }
            
            // Frame Stats
            let dropped = 0;
            let total = 0;
            
            if (v.getVideoPlaybackQuality) {
                const q = v.getVideoPlaybackQuality();
                dropped = q.droppedVideoFrames;
                total = q.totalVideoFrames;
            } else {
                 dropped = (v as any).webkitDroppedFrameCount || 0;
                 total = (v as any).webkitDecodedFrameCount || 0;
            }
            
            // FPS Calculation
            const now = performance.now();
            const delta = now - fpsTracker.current.lastTime;
            if (delta >= 1000) {
                 const newFrames = total - fpsTracker.current.frames;
                 fpsTracker.current.value = Math.round((newFrames * 1000) / delta);
                 fpsTracker.current.lastTime = now;
                 fpsTracker.current.frames = total;
            } else if (fpsTracker.current.frames === 0 && total > 0) {
                // Initialize offset
                 fpsTracker.current.frames = total;
            }

            setRealtimeStats({
                dropped,
                totalFrames: total,
                buffer: Math.max(0, bufferEnd - v.currentTime),
                videoWidth: v.videoWidth,
                videoHeight: v.videoHeight,
                displayWidth: v.clientWidth,
                displayHeight: v.clientHeight,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                fps: fpsTracker.current.value
            });
        }
        animationFrameId = requestAnimationFrame(updateStats);
    };

    updateStats();
    return () => cancelAnimationFrame(animationFrameId);
  }, [showStats]);

  // --- Metadata Flags & Chapters ---
  const isDolbyVision = video.metadata.hdrType === 'Dolby Vision';
  // Check if content is HDR AND screen supports it for the "active" badge, 
  // but we might want to show it exists regardless. 
  // Requirement: "if the display supports HDR"
  const isHDR = video.metadata.hdrType && video.metadata.hdrType !== 'SDR' && isScreenHDR;
  const isAtmos = video.metadata.audioCodec?.includes('Atmos');
  const isDTS = video.metadata.audioCodec?.includes('DTS');
  const isDD = video.metadata.audioCodec === 'Dolby Digital';
  const wasPlayed = !!video.lastPlayed;

  const runtimeInfo = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return {
        userAgent: 'Unavailable',
        browser: 'Unknown Browser',
        platform: 'Unknown Platform',
      };
    }

    const userAgent = navigator.userAgent || 'Unavailable';
    const platform = navigator.platform || '';
    return {
      userAgent,
      browser: detectBrowserName(userAgent),
      platform: detectPlatformName(userAgent, platform),
    };
  }, []);

  const selectedAudioTrackLabel = useMemo(() => {
    return audioTracks.find((track) => track.id === selectedAudioTrack)?.label ?? 'Unknown';
  }, [audioTracks, selectedAudioTrack]);

  const effectiveDuration = duration > 0 ? duration : video.metadata.durationSeconds;
  const playedPercent = useMemo(() => {
    if (!effectiveDuration || effectiveDuration <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, (currentTime / effectiveDuration) * 100));
  }, [currentTime, effectiveDuration]);

  const droppedFramePercent = useMemo(() => {
    if (realtimeStats.totalFrames <= 0) {
      return 0;
    }
    return (realtimeStats.dropped / realtimeStats.totalFrames) * 100;
  }, [realtimeStats.dropped, realtimeStats.totalFrames]);

  const estimatedSourceBitrateMbps = useMemo(() => {
    if (!effectiveDuration || effectiveDuration <= 0 || video.size <= 0) {
      return null;
    }
    return (video.size * 8) / effectiveDuration / 1_000_000;
  }, [effectiveDuration, video.size]);

  const streamHealth = useMemo(() => {
    if (realtimeStats.buffer < 1) return 'Critical';
    if (droppedFramePercent > 2) return 'Degraded';
    if (droppedFramePercent > 0.5) return 'Fair';
    return 'Stable';
  }, [droppedFramePercent, realtimeStats.buffer]);

  const nerdSnapshot = useMemo(() => {
    return {
      media: {
        id: video.id,
        name: video.name,
        sizeBytes: video.size,
        sizeLabel: formatBytes(video.size),
        container: video.metadata.container,
        resolution: video.metadata.resolution,
        durationSeconds: effectiveDuration,
        estimatedBitrateMbps: estimatedSourceBitrateMbps,
      },
      playback: {
        positionSeconds: currentTime,
        playedPercent,
        playbackSpeed,
        volumePercent: Math.round(volume * 100),
        muted: isMuted,
        aspectRatio,
      },
      render: {
        droppedFrames: realtimeStats.dropped,
        totalFrames: realtimeStats.totalFrames,
        droppedFramePercent,
        fps: realtimeStats.fps,
        bufferSeconds: Number(realtimeStats.buffer.toFixed(2)),
        streamHealth,
      },
      output: {
        viewport: `${realtimeStats.viewportWidth}x${realtimeStats.viewportHeight}`,
        display: `${realtimeStats.displayWidth}x${realtimeStats.displayHeight}`,
        source: `${realtimeStats.videoWidth}x${realtimeStats.videoHeight}`,
        colorSpace: colorSpace.toUpperCase(),
        hdr: video.metadata.hdrType || 'SDR',
      },
      audio: {
        activeTrack: selectedAudioTrackLabel,
        codec: video.metadata.audioCodec,
        channels: video.metadata.audioChannels || '2.0',
      },
      environment: {
        browser: runtimeInfo.browser,
        platform: runtimeInfo.platform,
        userAgent: runtimeInfo.userAgent,
      },
      capturedAt: new Date().toISOString(),
    };
  }, [
    aspectRatio,
    colorSpace,
    currentTime,
    droppedFramePercent,
    effectiveDuration,
    estimatedSourceBitrateMbps,
    isMuted,
    playbackSpeed,
    playedPercent,
    realtimeStats.buffer,
    realtimeStats.displayHeight,
    realtimeStats.displayWidth,
    realtimeStats.dropped,
    realtimeStats.fps,
    realtimeStats.totalFrames,
    realtimeStats.videoHeight,
    realtimeStats.videoWidth,
    realtimeStats.viewportHeight,
    realtimeStats.viewportWidth,
    runtimeInfo.browser,
    runtimeInfo.platform,
    runtimeInfo.userAgent,
    selectedAudioTrackLabel,
    streamHealth,
    video.id,
    video.metadata.audioChannels,
    video.metadata.audioCodec,
    video.metadata.container,
    video.metadata.hdrType,
    video.metadata.resolution,
    video.name,
    video.size,
    volume,
  ]);

  const handleCopyNerdSpecs = useCallback(async () => {
    if (!navigator.clipboard?.writeText) {
      setSpecsCopyState('failed');
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(nerdSnapshot, null, 2));
      setSpecsCopyState('copied');
    } catch (err) {
      console.error('Failed to copy nerd specs:', err);
      setSpecsCopyState('failed');
    }

    if (copySpecsTimeoutRef.current) {
      window.clearTimeout(copySpecsTimeoutRef.current);
    }
    copySpecsTimeoutRef.current = window.setTimeout(() => setSpecsCopyState('idle'), 2000);
  }, [nerdSnapshot]);
  
  const intro = video.metadata.intro;
  const showSkipIntro = intro && currentTime >= intro.start && currentTime < intro.end;

  const chapters = useMemo(() => {
    if (!video.metadata.chapters || duration === 0) return [];
    return video.metadata.chapters.filter(c => c.startTime < duration).sort((a, b) => a.startTime - b.startTime);
  }, [video.metadata.chapters, duration]);

  const currentChapter = useMemo(() => {
    if (chapters.length === 0) return null;
    return [...chapters].reverse().find(c => currentTime >= c.startTime);
  }, [chapters, currentTime]);

  const hoverChapter = useMemo(() => {
    if (hoverTime === null || chapters.length === 0) return null;
    return [...chapters].reverse().find(c => hoverTime >= c.startTime);
  }, [chapters, hoverTime]);

  const currentTrackCues = useMemo(() => {
    if (selectedSubtitleTrack === 'off') {
      return [] as SubtitleCue[];
    }

    const selectedTrack = subtitleTracks.find((track) => track.id === selectedSubtitleTrack);
    return selectedTrack?.cues ?? [];
  }, [subtitleTracks, selectedSubtitleTrack]);

  // --- Subtitle Logic ---
  const handleSubtitleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (r) => {
          if (typeof r.target?.result === 'string') {
              const parsed = parseSRT(r.target.result);
              
              // Add new track
              const newTrackId = `upload-${Date.now()}`;
              const newTrack: Track = { id: newTrackId, label: file.name, lang: 'Unknown', cues: parsed };
              
              setSubtitleTracks(prev => [...prev, newTrack]);
              setSelectedSubtitleTrack(newTrackId);
              
              setShowSettings(true); 
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const toggleSubtitles = () => {
      if (selectedSubtitleTrack === 'off') {
          // If tracks exist, select first, else open upload
          if (subtitleTracks.length > 0) {
              setSelectedSubtitleTrack(subtitleTracks[0].id);
          } else {
              subtitleInputRef.current?.click();
          }
      } else {
          setSelectedSubtitleTrack('off');
      }
  };

  // Update current subtitle text
  useEffect(() => {
      if (selectedSubtitleTrack === 'off' || currentTrackCues.length === 0) {
          setCurrentSubtitle('');
          return;
      }
      const adjustedTime = currentTime - subtitleOffset;
      const cue = currentTrackCues.find(s => adjustedTime >= s.start && adjustedTime <= s.end);
      setCurrentSubtitle(cue ? cue.text : '');
  }, [currentTime, currentTrackCues, selectedSubtitleTrack, subtitleOffset]);


  // --- Controls & Activity Logic ---

  const handleMouseMove = () => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    
    if (isPlaying && !showChapterList && !showSettings) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const togglePip = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.error('PiP error:', e);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    if (newMuted) setVolume(0);
    else setVolume(1);
  }, [isMuted]);

  const changeVolume = useCallback((delta: number) => {
    if (!videoRef.current) return;
    let newVol = Math.min(Math.max(videoRef.current.volume + delta, 0), 1);
    videoRef.current.volume = newVol;
    setVolume(newVol);
    setIsMuted(newVol === 0);
  }, []);

  const seek = useCallback((delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime += delta;
    showControlsTemp();
  }, []);

  const showControlsTemp = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = window.setTimeout(() => setShowControls(false), 2000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
      if (copySpecsTimeoutRef.current) {
        window.clearTimeout(copySpecsTimeoutRef.current);
      }
      document.body.style.cursor = '';
    };
  }, []);

  const skipIntro = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (intro && videoRef.current) {
        videoRef.current.currentTime = intro.end;
        setCurrentTime(intro.end);
        showControlsTemp();
    }
  }, [intro]);

  const skipNextChapter = useCallback(() => {
    if (chapters.length === 0 || !videoRef.current) return;
    const next = chapters.find(c => c.startTime > currentTime + 1);
    if (next) {
        videoRef.current.currentTime = next.startTime;
        setCurrentTime(next.startTime);
    }
    showControlsTemp();
  }, [chapters, currentTime, duration]);

  const skipPrevChapter = useCallback(() => {
    if (chapters.length === 0 || !videoRef.current) return;
    const current = [...chapters].reverse().find(c => currentTime >= c.startTime);
    if (!current) {
        videoRef.current.currentTime = 0;
    } else {
        if (currentTime - current.startTime < 3) {
             const prevIndex = chapters.indexOf(current) - 1;
             if (prevIndex >= 0) {
                 videoRef.current.currentTime = chapters[prevIndex].startTime;
             } else {
                 videoRef.current.currentTime = 0;
             }
        } else {
            videoRef.current.currentTime = current.startTime;
        }
    }
    setCurrentTime(videoRef.current.currentTime);
    showControlsTemp();
  }, [chapters, currentTime]);

  // --- Keyboard Shortcuts ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement) return;

      switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'c':
          e.preventDefault();
          toggleSubtitles();
          break;
        case 's':
          if (showSkipIntro) {
             e.preventDefault();
             skipIntro();
          }
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          seek(-10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          seek(10);
          break;
        case 'arrowup':
          e.preventDefault();
          changeVolume(0.1);
          showControlsTemp();
          break;
        case 'arrowdown':
          e.preventDefault();
          changeVolume(-0.1);
          showControlsTemp();
          break;
        case 'n':
            if (e.shiftKey) {
                e.preventDefault();
                skipNextChapter();
            }
            break;
        case 'p':
          if (e.shiftKey) {
            e.preventDefault();
            skipPrevChapter();
          } else {
            e.preventDefault();
            togglePip();
          }
          break;
        case 'i':
          e.preventDefault();
          setShowStats(prev => !prev);
          setShowChapterList(false);
          setShowSettings(false);
          showControlsTemp();
          break;
        case 'escape':
          e.preventDefault();
          if (showStats) setShowStats(false);
          else if (showChapterList) setShowChapterList(false);
          else if (showSettings) setShowSettings(false);
          else if (document.fullscreenElement) toggleFullscreen();
          else onBack();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute, changeVolume, seek, onBack, showSkipIntro, skipIntro, skipNextChapter, skipPrevChapter, showStats, showChapterList, showSettings, toggleSubtitles, selectedSubtitleTrack]);

  // --- Video Event Listeners ---

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const emitProgress = () => {
        if (!onProgress || !Number.isFinite(v.duration) || v.duration <= 0) {
            return;
        }

        const now = Date.now();
        const shouldEmit =
            now - lastProgressEmitRef.current >= 1000 ||
            v.currentTime === 0 ||
            Math.abs(v.duration - v.currentTime) < 0.35;

        if (shouldEmit) {
            onProgress(v.currentTime, v.duration);
            lastProgressEmitRef.current = now;
        }
    };

    const onTimeUpdate = () => {
        setCurrentTime(v.currentTime);
        emitProgress();
    };
    const onLoadedMetadata = () => {
        lastProgressEmitRef.current = 0;
        setDuration(v.duration);
        v.play().then(() => setIsPlaying(true)).catch((e) => {
            if (e.name !== 'AbortError') setIsPlaying(false);
        });
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onEnded = () => {
        setIsPlaying(false);
        if (onProgress && Number.isFinite(v.duration) && v.duration > 0) {
            onProgress(v.duration, v.duration);
        }
    };
    
    // Updated Error Handler
    const onError = () => {
        if (v.error) {
            let msg = 'An unknown playback error occurred.';
            // Use codes as MediaError constants might not be globally available in all TS envs without DOM lib, but values are standard
            switch (v.error.code) {
                case 1: // MEDIA_ERR_ABORTED
                    // Don't show error if aborted, typically handled by other logic or intentional
                    return; 
                case 2: // MEDIA_ERR_NETWORK
                    msg = 'A network error caused the video download to fail.';
                    break;
                case 3: // MEDIA_ERR_DECODE
                    msg = 'The video playback was aborted due to a corruption problem or because the video used features your browser did not support.';
                    break;
                case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                    msg = 'The video could not be loaded, either because the server or network failed or because the format is not supported.';
                    break;
            }
            console.error('Video Error:', v.error);
            setError(msg);
            setIsPlaying(false);
            setIsBuffering(false);
        }
    };

    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('ended', onEnded);
    v.addEventListener('error', onError);

    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('error', onError);
      
      v.pause();
      v.removeAttribute('src');
      v.load();
    };
  }, [video, onProgress]);


  const handleSeekRange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSeekBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(percent * duration);
    setIsHoveringSeekBar(true);
  };

  const handleSeekBarMouseLeave = () => {
    setIsHoveringSeekBar(false);
    setHoverTime(null);
  };

  const handleVolumeRange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = Number(e.target.value);
      if (videoRef.current) {
          videoRef.current.volume = vol;
          videoRef.current.muted = (vol === 0);
          setVolume(vol);
          setIsMuted(vol === 0);
      }
  };

  // --- Video Styles ---
  const getVideoStyle = (): React.CSSProperties => {
      const base: React.CSSProperties = { outline: 'none' };
      
      // Apply Aspect Ratio
      let arStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'contain' };
      switch (aspectRatio) {
          case 'cover': arStyle = { width: '100%', height: '100%', objectFit: 'cover' }; break;
          case 'original': arStyle = { width: '100%', height: '100%', objectFit: 'none' }; break;
          case '16:9': arStyle = { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', aspectRatio: '16/9', objectFit: 'fill' }; break;
          case '4:3': arStyle = { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', aspectRatio: '4/3', objectFit: 'fill' }; break;
          case '21:9': arStyle = { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', aspectRatio: '21/9', objectFit: 'fill' }; break;
          case 'imax-1.90': arStyle = { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', aspectRatio: '1.9/1', objectFit: 'fill' }; break;
          case 'imax-1.43': arStyle = { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', aspectRatio: '1.43/1', objectFit: 'fill' }; break;
      }

      // Apply Color Space (Simulation via CSS Filters)
      let filter = 'none';
      switch(colorSpace) {
          case 'dcip3': filter = 'saturate(1.05) contrast(1.02)'; break; // Subtle boost
          case 'bt2020': filter = 'saturate(1.15) contrast(1.05)'; break; // Vibrant
          case 'srgb': filter = 'saturate(0.95)'; break; // Muted
      }

      return { ...base, ...arStyle, filter };
  };

  const hideCursor = isPlaying && !showControls && !showChapterList && !showSettings && !showStats && !error;

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 bg-black z-[100] flex items-center justify-center overflow-hidden font-sans select-none ${hideCursor ? 'cursor-none' : 'cursor-default'}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && !showChapterList && !showSettings && setShowControls(false)}
      onClick={() => { if(!showControls && !showChapterList && !showSettings) togglePlay(); }}
    >
      <video
        ref={videoRef}
        src={video.url}
        style={getVideoStyle()}
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
      />
      
      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8 animate-fade-in">
           <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
               <span className="material-icons-round text-4xl text-red-500">error_outline</span>
           </div>
           <h2 className="text-2xl font-bold text-white mb-3">Playback Error</h2>
           <p className="text-zinc-400 max-w-md mb-8 leading-relaxed">{error}</p>
           <button 
             onClick={onBack}
             className="px-8 py-3 bg-white text-black rounded-full font-medium hover:bg-zinc-200 transition-colors flex items-center shadow-lg shadow-white/5"
           >
               <span className="material-icons-round mr-2">arrow_back</span>
               Back to Library
           </button>
        </div>
      )}
      
      {/* Hidden Subtitle Input */}
      <input 
        type="file" 
        accept=".srt,.vtt" 
        className="hidden" 
        ref={subtitleInputRef} 
        onChange={handleSubtitleFile} 
      />

      {/* Subtitle Overlay */}
      {selectedSubtitleTrack !== 'off' && currentSubtitle && !error && (
          <div className="absolute bottom-24 left-0 right-0 text-center pointer-events-none z-10 px-10">
               <span 
                  className="inline-block px-2 py-1 leading-relaxed whitespace-pre-wrap transition-all duration-200"
                  style={{ 
                      fontSize: `${1.5 * subtitleSize}rem`, 
                      textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.5)',
                      color: subtitleTextColor,
                      backgroundColor: subtitleBackgroundColor,
                      borderRadius: '4px'
                  }}
               >
                   {currentSubtitle}
               </span>
          </div>
      )}

      {/* Buffering Indicator */}
      {isBuffering && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
          </div>
      )}

      {/* Skip Intro Button */}
      {!error && (
      <div className={`
          absolute bottom-32 right-8 z-30 transition-all duration-500 ease-out transform
          ${showSkipIntro ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}
      `}>
          <button
              onClick={skipIntro}
              className="group flex items-center space-x-2 bg-black/60 hover:bg-white/20 backdrop-blur-md border border-white/20 hover:border-white/40 px-5 py-2.5 rounded-lg text-white font-medium transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
          >
              <span className="text-sm tracking-wide uppercase font-bold drop-shadow-md">Skip Intro</span>
              <span className="material-icons-round text-lg group-hover:translate-x-1 transition-transform">skip_next</span>
          </button>
      </div>
      )}

       {/* Chapter List Sidebar */}
       <div className={`
          absolute top-0 right-0 bottom-0 w-80 bg-black/95 backdrop-blur-2xl border-l border-white/10 z-40 p-6 
          transform transition-transform duration-300 ease-out flex flex-col shadow-2xl
          ${showChapterList && !error ? 'translate-x-0' : 'translate-x-full'}
      `}>
          <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-medium text-white tracking-tight">Chapters</h2>
              <button 
                onClick={() => setShowChapterList(false)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white"
              >
                  <span className="material-icons-round">close</span>
              </button>
          </div>
          
          <div className="flex-1 overflow-y-auto -mr-2 pr-2 custom-scrollbar space-y-1">
              {chapters.map((chapter, i) => {
                  const isActive = currentChapter === chapter;
                  return (
                    <button
                        key={i}
                        onClick={(e) => {
                            e.stopPropagation();
                            if(videoRef.current) {
                                videoRef.current.currentTime = chapter.startTime;
                                setCurrentTime(chapter.startTime);
                            }
                        }}
                        className={`
                            group w-full flex items-center p-3 rounded-xl text-left transition-all duration-200
                            ${isActive 
                                ? 'bg-white text-black shadow-lg shadow-white/5' 
                                : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                            }
                        `}
                    >   
                        {/* Index */}
                        <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center mr-3 text-xs font-bold transition-colors
                            ${isActive ? 'bg-black/10 text-black' : 'bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white'}
                        `}>
                            {i + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{chapter.title}</div>
                            <div className={`text-xs font-mono mt-0.5 ${isActive ? 'text-black/60' : 'text-white/30'}`}>
                                {formatTime(chapter.startTime)}
                            </div>
                        </div>
                        
                        {isActive && (
                            <span className="material-icons-round text-lg ml-2 animate-pulse">equalizer</span>
                        )}
                    </button>
                  );
              })}
          </div>
      </div>

      {/* Top Bar (Title & Back) */}
      <div className={`
        absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/90 via-black/40 to-transparent 
        flex items-start justify-between p-6 transition-all duration-500 ease-out z-20
        ${(showControls && !error) ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}
      `}>
          <div className="flex items-center space-x-6">
              <button 
                onClick={onBack}
                className="group p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 backdrop-blur-md transition-all duration-200 hover:scale-110"
              >
                  <span className="material-icons-round text-white text-xl">arrow_back</span>
              </button>
              <div>
                  <h1 className="text-white font-medium text-lg tracking-wide drop-shadow-md flex items-center">
                    {video.name}
                    {wasPlayed && (
                        <span className="ml-3 px-2 py-0.5 rounded bg-white/10 border border-white/10 text-[9px] font-bold text-vision-purple tracking-wider uppercase">
                            Resumed
                        </span>
                    )}
                  </h1>
                  <div className="flex items-center space-x-2 text-xs text-white/60 mt-0.5">
                      <span className="uppercase tracking-wider font-bold">{video.metadata.resolution}</span>
                      <span>•</span>
                      <span>{video.metadata.duration}</span>
                  </div>
              </div>
          </div>

          <div className="flex items-center space-x-3">
              {/* Chapter List Toggle */}
              {chapters.length > 0 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowChapterList(!showChapterList); setShowStats(false); setShowSettings(false); }}
                    className={`p-2.5 rounded-full transition-all duration-200 ${showChapterList ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'}`}
                    title="Chapters"
                  >
                      <span className="material-icons-round text-xl">format_list_bulleted</span>
                  </button>
              )}
              
              <button 
                onClick={() => { setShowStats(!showStats); setShowChapterList(false); setShowSettings(false); }}
                className={`p-2.5 rounded-full transition-all duration-200 ${showStats ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'}`}
                title="Stats for Nerds (I)"
              >
                  <span className="material-icons-round text-xl">insights</span>
              </button>
          </div>
      </div>

      {/* Nerd Stats Overlay */}
      <div className={`
        absolute top-20 right-3 sm:right-6 w-[calc(100vw-1.5rem)] max-w-[26rem] bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-0 text-[11px] text-white/90 z-20 shadow-2xl transition-all duration-500 ease-out font-mono overflow-hidden
        ${showStats && !error ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}
      `}>
          <div className="bg-white/5 px-4 py-3 flex justify-between items-center border-b border-white/10 gap-2">
              <div>
                  <h3 className="font-bold uppercase tracking-widest text-xs">Stats for Nerds</h3>
                  <p className="text-[10px] text-white/50 mt-0.5">{runtimeInfo.browser} • {runtimeInfo.platform}</p>
              </div>
              <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyNerdSpecs}
                    className="px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors"
                    title="Copy all specs"
                  >
                    {specsCopyState === 'copied' ? 'Copied' : specsCopyState === 'failed' ? 'Retry' : 'Copy'}
                  </button>
                  <button onClick={() => setShowStats(false)} className="text-white/50 hover:text-white"><span className="material-icons-round text-sm">close</span></button>
              </div>
          </div>
          
          <div className="p-4 space-y-3 leading-relaxed selection:bg-white/20">
              <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">Playback</div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">Played</span>
                      <span>{formatTime(currentTime)} / {formatTime(effectiveDuration)} ({playedPercent.toFixed(1)}%)</span>
                  </div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">Buffer</span>
                      <span className={realtimeStats.buffer < 2 ? 'text-red-400' : 'text-green-400'}>{realtimeStats.buffer.toFixed(2)} s</span>
                  </div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">Health</span>
                      <span>{streamHealth}</span>
                  </div>
              </div>

              <div className="h-px bg-white/10"></div>

              <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">Video</div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">Source</span>
                      <span>{realtimeStats.videoWidth}x{realtimeStats.videoHeight} @ {video.metadata.frameRate || '24'} fps</span>
                  </div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">Frames</span>
                      <span>{realtimeStats.dropped} dropped / {realtimeStats.totalFrames} decoded ({droppedFramePercent.toFixed(2)}%)</span>
                  </div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">FPS</span>
                      <span>{realtimeStats.fps} fps</span>
                  </div>
              </div>

              <div className="h-px bg-white/10"></div>

              <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">Display</div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">Viewport</span>
                      <span>{realtimeStats.viewportWidth}x{realtimeStats.viewportHeight}</span>
                  </div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">Canvas</span>
                      <span>{realtimeStats.displayWidth}x{realtimeStats.displayHeight} / {aspectRatio}</span>
                  </div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">Color</span>
                      <span>{colorSpace.toUpperCase()} / {video.metadata.hdrType || 'SDR'}</span>
                  </div>
              </div>

              <div className="h-px bg-white/10"></div>

              <div>
                  <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">Audio + Source</div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">Track</span>
                      <span className="truncate" title={selectedAudioTrackLabel}>{selectedAudioTrackLabel}</span>
                  </div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">Audio</span>
                      <span>{video.metadata.audioChannels || '2.0'} ch / {video.metadata.audioCodec}</span>
                  </div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">Bitrate</span>
                      <span>{estimatedSourceBitrateMbps ? `${estimatedSourceBitrateMbps.toFixed(2)} Mb/s (est)` : 'Unavailable'}</span>
                  </div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">File</span>
                      <span>{video.metadata.container} / {formatBytes(video.size)}</span>
                  </div>
                  <div className="grid grid-cols-[6.5rem_1fr] gap-x-2">
                      <span className="text-white/50">Video ID</span>
                      <span className="truncate" title={video.id}>{video.id}</span>
                  </div>
              </div>
          </div>
      </div>
      
      {/* Settings Menu Overlay */}
      <div className={`
        absolute bottom-28 right-8 w-80 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-0 text-white z-30 shadow-2xl transition-all duration-300 ease-out origin-bottom-right overflow-hidden
        ${showSettings && showControls && !error ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
      `}>
           <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/90">Settings</h4>
                <button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-white"><span className="material-icons-round text-sm">close</span></button>
           </div>
           
           <div className="p-5 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                
                {/* Section: Video */}
                <div>
                    <h5 className="text-[10px] uppercase font-bold text-white/40 mb-3 tracking-wider">Video</h5>
                    
                    {/* Aspect Ratio */}
                    <div className="mb-4">
                        <span className="block text-xs font-medium text-white/80 mb-2">Aspect Ratio</span>
                        <div className="grid grid-cols-4 gap-1.5">
                            {['fit', 'cover', '16:9', 'original'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setAspectRatio(opt)}
                                    className={`
                                        text-[9px] uppercase py-1.5 rounded border transition-all duration-200
                                        ${aspectRatio === opt 
                                            ? 'bg-white text-black border-white font-bold' 
                                            : 'bg-white/5 text-white/70 border-white/5 hover:bg-white/10 hover:border-white/20'
                                        }
                                    `}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                        
                        {/* IMAX Options */}
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                            {['imax-1.90', 'imax-1.43'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setAspectRatio(opt)}
                                    className={`
                                        text-[9px] uppercase py-1.5 rounded border transition-all duration-200 flex items-center justify-center
                                        ${aspectRatio === opt 
                                            ? 'bg-white text-black border-white font-bold' 
                                            : 'bg-white/5 text-white/70 border-white/5 hover:bg-white/10 hover:border-white/20'
                                        }
                                    `}
                                >
                                    <span className="mr-1.5 font-black tracking-tighter">IMAX</span>
                                    {opt.split('-')[1]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Color Space */}
                    <div>
                        <span className="block text-xs font-medium text-white/80 mb-2">Color Space</span>
                        <div className="grid grid-cols-2 gap-2">
                             {([
                                { id: 'bt709', label: 'BT.709 (SDR)' },
                                { id: 'dcip3', label: 'DCI-P3' },
                                { id: 'bt2020', label: 'BT.2020 (HDR)' },
                                { id: 'srgb', label: 'sRGB' },
                             ] as const).map((opt) => (
                                 <button
                                    key={opt.id}
                                    onClick={() => setColorSpace(opt.id)}
                                    className={`
                                        flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all
                                        ${colorSpace === opt.id ? 'bg-white/10 border border-white/30 text-white' : 'hover:bg-white/5 border border-transparent text-white/60'}
                                    `}
                                 >
                                     <span className="text-[10px] font-medium">{opt.label}</span>
                                     {colorSpace === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>}
                                 </button>
                             ))}
                        </div>
                    </div>
                </div>

                <div className="h-px bg-white/10 w-full"></div>

                {/* Section: Audio */}
                <div>
                     <h5 className="text-[10px] uppercase font-bold text-white/40 mb-3 tracking-wider">Audio</h5>
                     <div className="space-y-1">
                         {audioTracks.map((track) => (
                             <button
                                key={track.id}
                                onClick={() => setSelectedAudioTrack(track.id)}
                                className={`
                                    w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-colors
                                    ${selectedAudioTrack === track.id ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-white/70'}
                                `}
                             >
                                 <div className="flex-1">
                                    <div className="text-xs font-medium">{track.label}</div>
                                 </div>
                                 {selectedAudioTrack === track.id && <span className="material-icons-round text-sm">check</span>}
                             </button>
                         ))}
                     </div>
                </div>

                <div className="h-px bg-white/10 w-full"></div>

                {/* Section: Playback Speed */}
                <div>
                    <h5 className="text-[10px] uppercase font-bold text-white/40 mb-3 tracking-wider">Playback Speed</h5>
                    <div className="grid grid-cols-6 gap-1.5">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                            <button
                                key={speed}
                                onClick={() => {
                                    if (videoRef.current) {
                                        videoRef.current.playbackRate = speed;
                                        setPlaybackSpeed(speed);
                                    }
                                }}
                                className={`
                                    text-[9px] py-1.5 rounded border transition-all duration-200
                                    ${playbackSpeed === speed
                                        ? 'bg-white text-black border-white font-bold'
                                        : 'bg-white/5 text-white/70 border-white/5 hover:bg-white/10 hover:border-white/20'
                                    }
                                `}
                            >
                                {speed}x
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-px bg-white/10 w-full"></div>

                {/* Section: Subtitles */}
                <div>
                   <div className="flex items-center justify-between mb-3">
                       <h5 className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Subtitles</h5>
                       <button 
                            onClick={() => subtitleInputRef.current?.click()}
                            className="text-[10px] bg-white/10 hover:bg-white/20 border border-white/5 px-2 py-1 rounded transition-colors"
                       >
                           Upload .SRT
                       </button>
                   </div>
                   
                   <div className="space-y-1 mb-4">
                       <button
                            onClick={() => setSelectedSubtitleTrack('off')}
                            className={`
                                w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors
                                ${selectedSubtitleTrack === 'off' ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/60'}
                            `}
                        >
                             <span className="text-xs font-medium">Off</span>
                             {selectedSubtitleTrack === 'off' && <span className="ml-auto material-icons-round text-sm">check</span>}
                        </button>

                       {subtitleTracks.map((track) => (
                           <button
                              key={track.id}
                              onClick={() => setSelectedSubtitleTrack(track.id)}
                              className={`
                                  w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors
                                  ${selectedSubtitleTrack === track.id ? 'bg-white text-black' : 'hover:bg-white/5 text-white/70'}
                              `}
                           >
                               <span className="text-xs font-medium">{track.label}</span>
                               {selectedSubtitleTrack === track.id && <span className="ml-auto material-icons-round text-sm">check</span>}
                           </button>
                       ))}
                   </div>
                   
                   {/* Subtitle Adjustments */}
                   {selectedSubtitleTrack !== 'off' && (
                       <div className="bg-white/5 rounded-lg p-3 space-y-3">
                            <div>
                                <div className="flex justify-between text-[10px] text-white/60 mb-1.5">
                                    <span>Size</span>
                                    <span>{Math.round(subtitleSize * 100)}%</span>
                                </div>
                                <input 
                                     type="range" min="0.5" max="2" step="0.1" 
                                     value={subtitleSize}
                                     onChange={(e) => setSubtitleSize(parseFloat(e.target.value))}
                                     className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                                />
                            </div>
                            
                            <div>
                                <div className="flex justify-between text-[10px] text-white/60 mb-1.5">
                                    <span>Sync Offset</span>
                                    <span className={subtitleOffset !== 0 ? 'text-primary' : ''}>{subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s</span>
                                </div>
                                <div className="flex items-center space-x-2 bg-black/20 rounded p-1">
                                     <button onClick={() => setSubtitleOffset(prev => Number((prev - 0.1).toFixed(1)))} className="p-1 hover:bg-white/10 rounded"><span className="material-icons-round text-xs text-white/80">remove</span></button>
                                     <div className="flex-1 text-center text-[10px] font-mono">{subtitleOffset.toFixed(1)}s</div>
                                     <button onClick={() => setSubtitleOffset(prev => Number((prev + 0.1).toFixed(1)))} className="p-1 hover:bg-white/10 rounded"><span className="material-icons-round text-xs text-white/80">add</span></button>
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] text-white/60 mb-2">Background</div>
                                <div className="flex gap-2">
                                    {['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)', 'rgba(255,255,255,0.2)', 'transparent'].map((bg, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setSubtitleBackgroundColor(bg)}
                                            className={`w-6 h-6 rounded border ${subtitleBackgroundColor === bg ? 'border-white ring-1 ring-white/60' : 'border-white/20'}`}
                                            style={{ background: bg }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] text-white/60 mb-2">Text Color</div>
                                <div className="flex gap-2">
                                    {['#ffffff', '#ffff00', '#00ffff', '#ff0000'].map((color, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setSubtitleTextColor(color)}
                                            className={`w-6 h-6 rounded border ${subtitleTextColor === color ? 'border-white ring-1 ring-white/60' : 'border-white/20'}`}
                                            style={{ background: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                       </div>
                   )}
                </div>
           </div>
      </div>

      {/* Bottom Controls */}
      <div className={`
        absolute bottom-0 left-0 right-0 pb-8 pt-20 px-8 bg-gradient-to-t from-black via-black/80 to-transparent 
        flex flex-col space-y-4 transition-all duration-500 ease-out z-20
        ${(showControls && !error) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}
      `}>
          
          {/* Chapter Title Indicator */}
          <div className="flex items-center justify-between h-6 mb-1">
             {currentChapter ? (
                 <span className="text-sm font-medium text-white/90 drop-shadow-md animate-fade-in">
                     {currentChapter.title}
                     <span className="text-white/40 mx-2">•</span>
                     <span className="text-white/60 text-xs">Chapter {chapters.indexOf(currentChapter) + 1} of {chapters.length}</span>
                 </span>
             ) : <div></div>}
          </div>

          {/* Progress Bar (Interactive) */}
          <div 
            className="relative group w-full h-1 hover:h-1.5 transition-all duration-200 cursor-pointer flex items-center"
            onMouseMove={handleSeekBarMouseMove}
            onMouseLeave={handleSeekBarMouseLeave}
          >
             {/* Background Track */}
             <div className="absolute inset-0 bg-white/20 rounded-full"></div>

             {/* Chapter Markers (Gaps) */}
             {chapters.map((chapter, i) => {
                 if (i === 0) return null; // Skip start marker
                 const left = (chapter.startTime / duration) * 100;
                 return (
                     <div 
                        key={i} 
                        className="absolute top-0 bottom-0 w-0.5 bg-black/80 z-20 pointer-events-none"
                        style={{ left: `${left}%` }}
                     />
                 )
             })}
             
             {/* Buffered (Mock) */}
             <div 
                className="absolute left-0 top-0 bottom-0 bg-white/10 rounded-full" 
                style={{ width: `${(currentTime/duration) * 100 + 15}%`, maxWidth: '100%' }}
             />

             {/* Hover Ghost Track */}
             {isHoveringSeekBar && hoverTime !== null && (
                <div 
                    className="absolute left-0 top-0 bottom-0 bg-white/25 rounded-full pointer-events-none transition-all duration-75 ease-out"
                    style={{ width: `${(hoverTime / duration) * 100}%` }}
                />
             )}

             {/* Played Track */}
             <div 
                className="absolute left-0 top-0 bottom-0 bg-primary dark:bg-white rounded-full transition-all duration-100"
                style={{ width: `${(currentTime / duration) * 100}%` }}
             >
                {/* Thumb Scrubber (Visible on Hover) */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full scale-0 group-hover:scale-100 transition-transform shadow-lg"></div>
             </div>

             {/* Seek Bar Hover Tooltip */}
             {isHoveringSeekBar && hoverTime !== null && (
                 <div 
                    className="absolute bottom-4 -translate-x-1/2 flex flex-col items-center pointer-events-none z-30"
                    style={{ left: `${(hoverTime / duration) * 100}%` }}
                 >
                     <div className="bg-black/80 backdrop-blur border border-white/10 px-2 py-1 rounded text-[10px] font-medium text-white whitespace-nowrap shadow-xl mb-1">
                         {hoverChapter ? (
                             <>
                                <span className="text-white/70 mr-1.5">{hoverChapter.title}</span>
                                <span className="font-mono text-white">{formatTime(hoverTime)}</span>
                             </>
                         ) : (
                             <span className="font-mono">{formatTime(hoverTime)}</span>
                         )}
                     </div>
                 </div>
             )}

             <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeekRange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
             />
          </div>

          <div className="flex items-center justify-between">
              {/* Left: Controls & Time */}
              <div className="flex items-center space-x-4">
                  
                  {/* Skip Previous Chapter */}
                  {chapters.length > 0 && (
                      <button 
                        onClick={skipPrevChapter}
                        className="text-white/70 hover:text-white transition-colors"
                        title="Previous Chapter"
                      >
                          <span className="material-icons-round text-2xl">skip_previous</span>
                      </button>
                  )}

                  {/* Play / Pause */}
                  <button 
                    onClick={togglePlay}
                    className="text-white hover:text-white/80 transition-transform active:scale-95"
                  >
                      <span className="material-icons-round text-4xl">
                          {isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                  </button>

                  {/* Skip Next Chapter */}
                  {chapters.length > 0 && (
                      <button 
                        onClick={skipNextChapter}
                        className="text-white/70 hover:text-white transition-colors"
                        title="Next Chapter"
                      >
                          <span className="material-icons-round text-2xl">skip_next</span>
                      </button>
                  )}

                  {/* Volume Group */}
                  <div className="group flex items-center space-x-2 ml-2">
                      <button onClick={toggleMute} className="text-white/80 hover:text-white">
                          <span className="material-icons-round text-2xl">
                              {isMuted || volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
                          </span>
                      </button>
                      
                      {/* Volume Slider (Expands on hover) */}
                      <div className="w-0 overflow-hidden group-hover:w-24 transition-all duration-300 flex items-center">
                          <input 
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={volume}
                            onChange={handleVolumeRange}
                            className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                          />
                      </div>
                  </div>

                  {/* Time Display */}
                  <div className="text-sm font-medium font-mono text-white/90 ml-2">
                      <span>{formatTime(currentTime)}</span>
                      <span className="mx-2 text-white/40">/</span>
                      <span className="text-white/60">{formatTime(duration)}</span>
                  </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center space-x-5">
                   
                   {/* Format Badges */}
                   <div className="flex items-center space-x-3 mr-2 border-r border-white/10 pr-4 h-6">
                        {isHDR && (
                            <div className={`
                                flex items-center px-2 py-0.5 rounded border select-none
                                ${isDolbyVision 
                                    ? 'bg-white/10 border-white/30 text-white' 
                                    : 'bg-black/20 border-white/20 text-white/80'
                                }
                            `}>
                                {isDolbyVision ? (
                                    <BadgeDolbyVision className="h-2.5 text-[10px]" />
                                ) : video.metadata.hdrType === 'HDR10+' ? (
                                    <BadgeHDR10Plus className="h-2.5 text-[10px]" />
                                ) : (
                                    <span className="text-[10px] font-bold tracking-wider leading-none">HDR</span>
                                )}
                            </div>
                        )}

                        {isAtmos ? (
                            <div className="flex items-center px-2 py-0.5 rounded border border-white/30 bg-white/10 text-white select-none">
                                <BadgeDolbyAtmos className="h-2.5 text-[10px]" />
                            </div>
                        ) : isDTS ? (
                            <div className="flex items-center px-2 py-0.5 rounded border border-white/20 bg-black/20 text-white/80 select-none">
                                <BadgeDTS className="h-2.5 text-[12px]" />
                            </div>
                        ) : isDD ? (
                           <div className="flex items-center px-2 py-0.5 rounded border border-white/20 bg-black/20 text-white/80 select-none">
                               <BadgeDDPlus className="h-2.5 text-[10px]" />
                           </div>
                        ) : null}
                   </div>

                   {/* CC Button */}
                   <button 
                        onClick={toggleSubtitles}
                        className={`text-2xl transition-colors ${selectedSubtitleTrack !== 'off' ? 'text-white' : 'text-white/60 hover:text-white'}`}
                        title={subtitleTracks.length > 0 ? (selectedSubtitleTrack !== 'off' ? "Disable Subtitles" : "Enable Subtitles") : "Upload Subtitles"}
                   >
                       <span className="material-icons-round">{selectedSubtitleTrack !== 'off' ? 'closed_caption' : 'closed_caption_disabled'}</span>
                   </button>

                   <button 
                        onClick={() => { setShowSettings(!showSettings); setShowStats(false); setShowChapterList(false); }}
                        className={`transition-colors ${showSettings ? 'text-white' : 'text-white/60 hover:text-white'}`} 
                        title="Settings"
                   >
                       <span className="material-icons-round text-2xl">settings</span>
                   </button>
                   
                    <button 
                        onClick={togglePip}
                        className="text-white/60 hover:text-white transition-colors" 
                        title="Picture in Picture"
                    >
                        <span className="material-icons-round text-2xl">picture_in_picture_alt</span>
                    </button>

                   <button 
                        onClick={toggleFullscreen}
                        className="text-white hover:text-white/80 transition-transform active:scale-90" 
                        title="Fullscreen"
                    >
                       <span className="material-icons-round text-3xl">
                           {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                       </span>
                   </button>
              </div>
          </div>
      </div>
    </div>
  );
};
