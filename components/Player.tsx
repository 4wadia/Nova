import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { VideoFile } from '../types';

interface PlayerProps {
    video: VideoFile;
    onBack: () => void;
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

// --- SVG Icons (imported from shared Logos) ---
import { LogoDolby, LogoDolbyVision, LogoDolbyAtmos, LogoHDR10Plus } from './Logos';
import { NerdStats } from './NerdStats';

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

export const Player: React.FC<PlayerProps> = ({ video, onBack }) => {
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

    // Audio State
    const [audioTracks, setAudioTracks] = useState<Track[]>([]);
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>('1');

    // Subtitle State
    const [subtitleTracks, setSubtitleTracks] = useState<Track[]>([]);
    const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState<string>('off');

    // Parsed cues for the currently selected subtitle track
    const [activeCues, setActiveCues] = useState<SubtitleCue[]>([]);
    const [currentSubtitle, setCurrentSubtitle] = useState<string>('');

    const [subtitleSize, setSubtitleSize] = useState(1); // 1 = 100%
    const [subtitleOffset, setSubtitleOffset] = useState(0); // in seconds

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
        playbackRate: 1,
        currentQuality: 'auto',
        gpuAccelerated: true,
    });

    const fpsTracker = useRef({ frames: 0, lastTime: 0, value: 0 });

    // State to store HDR support capabilities
    const [isScreenHDR, setIsScreenHDR] = useState(false);

    const controlsTimeoutRef = useRef<number | null>(null);

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

                setRealtimeStats(prev => ({
                    ...prev,
                    dropped,
                    totalFrames: total,
                    buffer: Math.max(0, bufferEnd - v.currentTime),
                    videoWidth: v.videoWidth,
                    videoHeight: v.videoHeight,
                    displayWidth: v.clientWidth,
                    displayHeight: v.clientHeight,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                    fps: fpsTracker.current.value,
                    playbackRate: v.playbackRate,
                }));
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
                const newTrack: Track = { id: newTrackId, label: file.name, lang: 'Unknown' };

                setSubtitleTracks(prev => [...prev, newTrack]);
                setSelectedSubtitleTrack(newTrackId);
                setActiveCues(parsed); // Set immediately active

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
        if (selectedSubtitleTrack === 'off' || activeCues.length === 0) {
            setCurrentSubtitle('');
            return;
        }
        const adjustedTime = currentTime - subtitleOffset;
        const cue = activeCues.find(s => adjustedTime >= s.start && adjustedTime <= s.end);
        setCurrentSubtitle(cue ? cue.text : '');
    }, [currentTime, activeCues, selectedSubtitleTrack, subtitleOffset]);


    // --- Controls & Activity Logic ---

    const handleMouseMove = () => {
        setShowControls(true);
        document.body.style.cursor = 'default';

        if (controlsTimeoutRef.current) {
            window.clearTimeout(controlsTimeoutRef.current);
        }

        if (isPlaying && !showChapterList && !showSettings) {
            controlsTimeoutRef.current = window.setTimeout(() => {
                setShowControls(false);
                document.body.style.cursor = 'none';
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

            switch (e.key.toLowerCase()) {
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
                    }
                    break;
                case 'escape':
                    e.preventDefault();
                    if (showChapterList) setShowChapterList(false);
                    else if (showSettings) setShowSettings(false);
                    else if (document.fullscreenElement) toggleFullscreen();
                    else onBack();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, toggleFullscreen, toggleMute, changeVolume, seek, onBack, showSkipIntro, skipIntro, skipNextChapter, skipPrevChapter, showChapterList, showSettings, toggleSubtitles, selectedSubtitleTrack]);

    // --- Video Event Listeners ---

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;

        const onTimeUpdate = () => setCurrentTime(v.currentTime);
        const onLoadedMetadata = () => {
            setDuration(v.duration);
            v.play().then(() => setIsPlaying(true)).catch((e) => {
                if (e.name !== 'AbortError') setIsPlaying(false);
            });
        };
        const onWaiting = () => setIsBuffering(true);
        const onPlaying = () => setIsBuffering(false);
        const onEnded = () => setIsPlaying(false);

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
    }, [video]);


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
        switch (colorSpace) {
            case 'dcip3': filter = 'saturate(1.05) contrast(1.02)'; break; // Subtle boost
            case 'bt2020': filter = 'saturate(1.15) contrast(1.05)'; break; // Vibrant
            case 'srgb': filter = 'saturate(0.95)'; break; // Muted
        }

        return { ...base, ...arStyle, filter };
    };

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 bg-black z-[100] flex items-center justify-center overflow-hidden font-sans select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && !showChapterList && !showSettings && setShowControls(false)}
            onClick={() => { if (!showControls && !showChapterList && !showSettings) togglePlay(); }}
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
                            color: '#ffffff',
                            backgroundColor: 'rgba(0,0,0,0.4)',
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
          absolute top-0 right-0 bottom-0 w-80 bg-black/40 backdrop-blur-3xl border-l border-white/10 z-40 p-0 
          transform transition-transform duration-600 ease-expressive flex flex-col shadow-[-12px_0_40px_rgba(0,0,0,0.4)]
          ${showChapterList && !error ? 'translate-x-0' : 'translate-x-full'}
      `}>
                <div className="flex items-center justify-between px-6 py-8 border-b border-border bg-muted/30">
                    <h2 className="text-xl font-bold text-foreground tracking-tight">Chapters</h2>
                    <button
                        onClick={() => setShowChapterList(false)}
                        className="p-2 rounded-full hover:bg-muted/50 transition-all duration-300 text-muted-foreground hover:text-foreground"
                    >
                        <span className="material-icons-round">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar space-y-2">
                    {chapters.map((chapter, i) => {
                        const isActive = currentChapter === chapter;
                        return (
                            <button
                                key={i}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (videoRef.current) {
                                        videoRef.current.currentTime = chapter.startTime;
                                        setCurrentTime(chapter.startTime);
                                    }
                                }}
                                className={`
                            group w-full flex items-center p-3.5 rounded-2xl text-left transition-all duration-500 ease-expressive
                            ${isActive
                                        ? 'bg-primary text-primary-foreground shadow-[0_8px_16px_rgba(216,121,67,0.25)] scale-[1.02]'
                                        : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground active:scale-95'
                                    }
                        `}
                            >
                                {/* Index */}
                                <div className={`
                            w-9 h-9 rounded-xl flex items-center justify-center mr-4 text-xs font-black transition-all duration-500
                            ${isActive ? 'bg-primary-foreground/10 text-primary-foreground' : 'bg-muted/30 text-muted-foreground/40 group-hover:bg-muted/50 group-hover:text-foreground'}
                        `}>
                                    {String(i + 1).padStart(2, '0')}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-bold truncate tracking-tight">{chapter.title}</div>
                                    <div className={`text-[10px] font-black font-mono mt-1 tracking-widest uppercase ${isActive ? 'text-primary-foreground/60' : 'text-muted-foreground/30'}`}>
                                        {formatTime(chapter.startTime)}
                                    </div>
                                </div>

                                {isActive && (
                                    <div className="flex items-center space-x-0.5 ml-2 h-3.5">
                                        {[1, 2, 3].map(n => (
                                            <div key={n} className="w-0.5 bg-primary-foreground rounded-full animate-[bounce_1s_infinite]" style={{ animationDelay: `${n * 0.15}s` }} />
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Top Bar (Title & Back) */}
            <div className={`
        absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/80 via-black/30 to-transparent 
        flex items-start justify-between p-8 transition-all duration-600 ease-expressive z-20
        ${(showControls && !error) ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 pointer-events-none'}
      `}>
                <div className="flex items-center space-x-6">
                    <button
                        onClick={onBack}
                        className="group w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-2xl transition-all duration-500 hover:scale-110 active:scale-90"
                    >
                        <span className="material-icons-round text-white text-lg group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-white font-semibold text-xl tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] flex items-center">
                            {video.name}
                            {wasPlayed && (
                                <span className="ml-4 px-2 py-0.5 rounded-lg bg-primary/20 border border-primary/30 text-[10px] font-black text-primary tracking-widest uppercase shadow-[0_0_12px_rgba(216,121,67,0.3)]">
                                    Resumed
                                </span>
                            )}
                        </h1>
                        <div className="flex items-center space-x-3 text-[11px] text-white/50 mt-1.5 font-bold tracking-wider uppercase">
                            <span>{video.metadata.resolution}</span>
                            <span className="w-1 h-1 rounded-full bg-white/20"></span>
                            <span>{video.metadata.duration}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    {/* Chapter List Toggle */}
                    {chapters.length > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowChapterList(!showChapterList); setShowStats(false); setShowSettings(false); }}
                            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500 ease-expressive ${showChapterList ? 'bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(216,121,67,0.3)]' : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5'}`}
                            title="Chapters"
                        >
                            <span className="material-icons-round text-2xl">format_list_bulleted</span>
                        </button>
                    )}

                    <button
                        onClick={() => { setShowStats(!showStats); setShowChapterList(false); setShowSettings(false); }}
                        className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500 ease-expressive ${showStats ? 'bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(216,121,67,0.3)]' : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5'}`}
                        title="Stats for Nerds"
                    >
                        <span className="material-icons-round text-2xl">insights</span>
                    </button>
                </div>
            </div>

            {/* Nerd Stats Overlay */}
            <NerdStats
                video={video}
                realtimeStats={realtimeStats}
                currentTime={currentTime}
                duration={duration}
                volume={volume}
                colorSpace={colorSpace}
                aspectRatio={aspectRatio}
                isHDR={isHDR}
                isScreenHDR={isScreenHDR}
                visible={showStats && showControls && !error}
                onClose={() => setShowStats(false)}
            />

            {/* Settings Menu Overlay */}
            <div className={`
        absolute bottom-28 right-8 w-80 bg-card/80 backdrop-blur-3xl border border-border rounded-3xl p-0 text-foreground z-30 shadow-[-20px_0_40px_rgba(0,0,0,0.4)] transition-all duration-600 ease-expressive origin-bottom-right overflow-hidden
        ${showSettings && showControls && !error ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
      `}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Settings</h4>
                    <button onClick={() => setShowSettings(false)} className="p-1 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"><span className="material-icons-round text-sm">close</span></button>
                </div>

                <div className="p-6 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">

                    {/* Section: Video */}
                    <div>
                        <h5 className="text-[10px] uppercase font-black text-primary mb-4 tracking-widest">Visuals</h5>

                        {/* Aspect Ratio */}
                        <div className="mb-6">
                            <span className="block text-[11px] font-bold text-foreground/80 mb-3 ml-1">Aspect Ratio</span>
                            <div className="grid grid-cols-4 gap-2">
                                {['fit', 'cover', '16:9', 'original'].map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setAspectRatio(opt)}
                                        className={`
                                        text-[9px] uppercase py-2 rounded-xl border transition-all duration-500 ease-expressive
                                        ${aspectRatio === opt
                                                ? 'bg-primary text-primary-foreground border-primary font-black shadow-[0_8px_16px_rgba(216,121,67,0.25)]'
                                                : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50 hover:border-primary/30'
                                            }
                                    `}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>

                            {/* IMAX Options */}
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                {['imax-1.90', 'imax-1.43'].map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setAspectRatio(opt)}
                                        className={`
                                        text-[9px] uppercase py-2 rounded-xl border transition-all duration-500 ease-expressive flex items-center justify-center
                                        ${aspectRatio === opt
                                                ? 'bg-primary text-primary-foreground border-primary font-black shadow-[0_8px_16px_rgba(216,121,67,0.25)]'
                                                : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50 hover:border-primary/30'
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
                            <span className="block text-[11px] font-bold text-foreground/80 mb-3 ml-1">Color Mastering</span>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'bt709', label: 'BT.709' },
                                    { id: 'dcip3', label: 'DCI-P3' },
                                    { id: 'bt2020', label: 'BT.2020' },
                                    { id: 'srgb', label: 'sRGB' },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setColorSpace(opt.id as any)}
                                        className={`
                                        flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-500 ease-expressive border
                                        ${colorSpace === opt.id ? 'bg-primary/15 border-primary/30 text-foreground shadow-lg' : 'hover:bg-muted/30 border-transparent text-muted-foreground'}
                                    `}
                                    >
                                        <span className="text-[10px] font-bold">{opt.label}</span>
                                        {colorSpace === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(216,121,67,0.8)]"></div>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-border w-full"></div>

                    {/* Section: Audio */}
                    <div>
                        <h5 className="text-[10px] uppercase font-black text-primary mb-4 tracking-widest">Acoustics</h5>
                        <div className="space-y-1.5">
                            {audioTracks.map((track) => (
                                <button
                                    key={track.id}
                                    onClick={() => setSelectedAudioTrack(track.id)}
                                    className={`
                                    w-full flex items-center px-4 py-3 rounded-xl text-left transition-all duration-500 ease-expressive
                                    ${selectedAudioTrack === track.id ? 'bg-primary text-primary-foreground shadow-xl scale-[1.02]' : 'hover:bg-muted/30 text-muted-foreground'}
                                `}
                                >
                                    <div className="flex-1">
                                        <div className="text-[11px] font-bold">{track.label}</div>
                                    </div>
                                    {selectedAudioTrack === track.id && <span className="material-icons-round text-sm">check</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-white/5 w-full"></div>

                    {/* Section: Subtitles */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h5 className="text-[10px] uppercase font-black text-primary tracking-widest">Subtitles</h5>
                            <button
                                onClick={() => subtitleInputRef.current?.click()}
                                className="text-[9px] font-black uppercase bg-muted/30 hover:bg-muted/50 border border-border px-2.5 py-1.5 rounded-lg transition-all duration-300"
                            >
                                Import .SRT
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <button
                                onClick={() => setSelectedSubtitleTrack('off')}
                                className={`
                                flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-500 ease-expressive border
                                ${selectedSubtitleTrack === 'off' ? 'bg-primary/15 border-primary/30 text-foreground shadow-lg' : 'hover:bg-muted/30 border-transparent text-muted-foreground'}
                            `}
                            >
                                <span className="text-[10px] font-bold">Disabled</span>
                                {selectedSubtitleTrack === 'off' && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(216,121,67,0.8)]"></div>}
                            </button>

                            {subtitleTracks.map((track) => (
                                <button
                                    key={track.id}
                                    onClick={() => setSelectedSubtitleTrack(track.id)}
                                    className={`
                                  flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-500 ease-expressive border
                                  ${selectedSubtitleTrack === track.id ? 'bg-primary text-primary-foreground shadow-xl scale-[1.02]' : 'hover:bg-muted/30 border-transparent text-muted-foreground'}
                              `}
                                >
                                    <span className="text-[10px] font-bold truncate pr-2">{track.label}</span>
                                    {selectedSubtitleTrack === track.id && <span className="material-icons-round text-xs">check</span>}
                                </button>
                            ))}
                        </div>

                        {/* Subtitle Adjustments */}
                        {selectedSubtitleTrack !== 'off' && (
                            <div className="bg-muted/20 rounded-2xl p-4 space-y-4 border border-border">
                                <div>
                                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground mb-2 px-1">
                                        <span className="uppercase tracking-widest">Scaling</span>
                                        <span className="text-foreground font-mono">{Math.round(subtitleSize * 100)}%</span>
                                    </div>
                                    <input
                                        type="range" min="0.5" max="2" step="0.1"
                                        value={subtitleSize}
                                        onChange={(e) => setSubtitleSize(parseFloat(e.target.value))}
                                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between text-[10px] font-bold text-white/40 mb-2 px-1">
                                        <span className="uppercase tracking-widest">Timing Offset</span>
                                        <span className={`font-mono ${subtitleOffset !== 0 ? 'text-primary' : 'text-foreground'}`}>{subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s</span>
                                    </div>
                                    <div className="flex items-center space-x-2 bg-black/20 rounded-xl p-1.5 border border-white/5">
                                        <button onClick={() => setSubtitleOffset(prev => Number((prev - 0.1).toFixed(1)))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><span className="material-icons-round text-sm text-white/80">remove</span></button>
                                        <div className="flex-1 text-center text-[10px] font-black font-mono tracking-tighter">{subtitleOffset.toFixed(1)}s</div>
                                        <button onClick={() => setSubtitleOffset(prev => Number((prev + 0.1).toFixed(1)))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><span className="material-icons-round text-sm text-white/80">add</span></button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Controls */}
            <div className={`
        absolute bottom-0 left-0 right-0 pb-10 pt-24 px-10 bg-gradient-to-t from-black via-black/80 to-transparent 
        flex flex-col space-y-5 transition-all duration-600 ease-expressive z-20
        ${(showControls && !error) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none'}
      `}>

                {/* Chapter Title Indicator */}
                <div className="flex items-center justify-between h-8 mb-2">
                    {currentChapter ? (
                        <div className="flex flex-col animate-fade-in group/chapter cursor-pointer" onClick={() => setShowChapterList(true)}>
                            <div className="flex items-center space-x-2">
                                <span className="text-white font-black text-lg tracking-tight drop-shadow-lg group-hover/chapter:text-primary transition-colors">
                                    {currentChapter.title}
                                </span>
                                <span className="material-icons-round text-white/20 text-sm group-hover/chapter:translate-x-1 transition-transform">chevron_right</span>
                            </div>
                            <span className="text-primary/60 text-[10px] font-black uppercase tracking-[0.25em] -mt-1">
                                Chapter {chapters.indexOf(currentChapter) + 1} of {chapters.length}
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col opacity-40">
                            <span className="text-white font-bold text-lg tracking-tight">Nova Player</span>
                            <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{video.metadata.resolution} • {video.metadata.duration}</span>
                        </div>
                    )}

                    {/* Quick Format Badges (Right side of chapter) */}
                    <div className="flex items-center space-x-2">
                        {isHDR && (
                            <div className="bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-lg text-[10px] font-black tracking-widest flex items-center shadow-[0_0_12px_rgba(216,121,67,0.1)]">
                                HDR
                            </div>
                        )}
                        {isAtmos && (
                            <div className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded-lg flex items-center shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                                <LogoDolbyAtmos className="h-4" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress Bar (Interactive) */}
                <div
                    className="relative group w-full h-1.5 hover:h-2 transition-all duration-500 ease-expressive cursor-pointer flex items-center"
                    onMouseMove={handleSeekBarMouseMove}
                    onMouseLeave={handleSeekBarMouseLeave}
                >
                    {/* Background Track */}
                    <div className="absolute inset-0 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm"></div>

                    {/* Chapter Markers (Gaps) */}
                    {chapters.map((chapter, i) => {
                        if (i === 0) return null; // Skip start marker
                        const left = (chapter.startTime / duration) * 100;
                        return (
                            <div
                                key={i}
                                className="absolute top-0 bottom-0 w-[3px] bg-black/40 z-20 pointer-events-none transform -translate-x-1/2"
                                style={{ left: `${left}%` }}
                            />
                        )
                    })}

                    {/* Buffered (Mock) */}
                    <div
                        className="absolute left-0 top-0 bottom-0 bg-white/10 rounded-full transition-all duration-500"
                        style={{ width: `${(currentTime / duration) * 100 + 12}%`, maxWidth: '100%' }}
                    />

                    {/* Hover Ghost Track */}
                    {isHoveringSeekBar && hoverTime !== null && (
                        <div
                            className="absolute left-0 top-0 bottom-0 bg-white/20 rounded-full pointer-events-none transition-all duration-150 ease-out"
                            style={{ width: `${(hoverTime / duration) * 100}%` }}
                        />
                    )}

                    {/* Played Track */}
                    <div
                        className="absolute left-0 top-0 bottom-0 bg-primary rounded-full transition-all duration-100 ease-out shadow-[0_0_12px_rgba(216,121,67,0.5)]"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                    >
                        {/* Thumb Scrubber (Visible on Hover) */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full scale-0 group-hover:scale-100 transition-transform duration-500 ease-expressive shadow-[0_0_20px_rgba(255,255,255,0.8)] border-[3px] border-primary"></div>
                    </div>

                    {/* Seek Bar Hover Tooltip */}
                    {isHoveringSeekBar && hoverTime !== null && (
                        <div
                            className="absolute bottom-6 -translate-x-1/2 flex flex-col items-center pointer-events-none z-30 transition-all duration-150 ease-out"
                            style={{ left: `${(hoverTime / duration) * 100}%` }}
                        >
                            <div className="bg-black/60 backdrop-blur-3xl border border-white/20 px-4 py-2 rounded-2xl text-[11px] font-bold text-white whitespace-nowrap shadow-2xl mb-2 flex flex-col items-center">
                                {hoverChapter && (
                                    <span className="text-primary text-[9px] font-black uppercase tracking-widest mb-1">{hoverChapter.title}</span>
                                )}
                                <span className="font-mono text-lg tracking-tighter">{formatTime(hoverTime)}</span>
                            </div>
                            {/* Visual Indicator on track */}
                            <div className="w-1 h-3 bg-white rounded-full opacity-50"></div>
                        </div>
                    )}

                    <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeekRange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                    />
                </div>

                <div className="flex items-center justify-between pointer-events-auto">
                    {/* Left: Controls & Time */}
                    <div className="flex items-center space-x-6">

                        {/* Skip Previous Chapter */}
                        {chapters.length > 0 && (
                            <button
                                onClick={skipPrevChapter}
                                className="text-white/40 hover:text-white transition-all duration-500 hover:scale-110 active:scale-95"
                                title="Previous Chapter"
                            >
                                <span className="material-icons-round text-3xl">skip_previous</span>
                            </button>
                        )}

                        {/* Play / Pause - Premium Large Button */}
                        <button
                            onClick={togglePlay}
                            className="w-16 h-16 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:scale-110 active:scale-90 transition-all duration-500 ease-expressive shadow-[0_8px_24px_rgba(216,121,67,0.3)]"
                        >
                            <span className="material-icons-round text-5xl">
                                {isPlaying ? 'pause' : 'play_arrow'}
                            </span>
                        </button>

                        {/* Skip Next Chapter */}
                        {chapters.length > 0 && (
                            <button
                                onClick={skipNextChapter}
                                className="text-white/40 hover:text-white transition-all duration-500 hover:scale-110 active:scale-95"
                                title="Next Chapter"
                            >
                                <span className="material-icons-round text-3xl">skip_next</span>
                            </button>
                        )}

                        {/* Volume Group */}
                        <div className="group flex items-center space-x-3 ml-4">
                            <button onClick={toggleMute} className="text-white/60 hover:text-white hover:scale-110 transition-all duration-500">
                                <span className="material-icons-round text-3xl">
                                    {isMuted || volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
                                </span>
                            </button>

                            {/* Volume Slider (Expands on hover) */}
                            <div className="w-0 opacity-0 group-hover:w-32 group-hover:opacity-100 transition-all duration-700 ease-expressive flex items-center px-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={volume}
                                    onChange={handleVolumeRange}
                                    className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full shadow-lg"
                                />
                            </div>
                        </div>

                        {/* Time Display */}
                        <div className="flex items-baseline space-x-2 ml-4">
                            <span className="text-2xl font-black font-mono text-white tracking-tighter transition-all duration-300">
                                {formatTime(currentTime)}
                            </span>
                            <span className="text-white/20 font-black text-xs font-mono">/</span>
                            <span className="text-white/40 font-bold font-mono text-sm uppercase">
                                {formatTime(duration)}
                            </span>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center space-x-6">

                        {/* Format Badges (Full Set) */}
                        <div className="hidden lg:flex items-center space-x-4 mr-4 px-6 border-x border-white/10 h-10">
                            {isDolbyVision ? (
                                <LogoDolbyVision className="text-white opacity-80" />
                            ) : isHDR ? (
                                <LogoHDR10Plus className="text-primary" />
                            ) : null}

                            {isAtmos ? (
                                <LogoDolbyAtmos className="text-white/80 h-4" />
                            ) : isDTS ? (
                                <div className="text-[10px] font-black tracking-widest text-white/60">DTS-HD</div>
                            ) : null}
                        </div>

                        {/* CC Button */}
                        <button
                            onClick={toggleSubtitles}
                            className={`p-3 rounded-2xl transition-all duration-500 ease-expressive ${selectedSubtitleTrack !== 'off' ? 'bg-primary text-primary-foreground shadow-lg scale-110' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                            title={subtitleTracks.length > 0 ? (selectedSubtitleTrack !== 'off' ? "Disable Subtitles" : "Enable Subtitles") : "Upload Subtitles"}
                        >
                            <span className="material-icons-round text-2xl">{selectedSubtitleTrack !== 'off' ? 'closed_caption' : 'closed_caption_disabled'}</span>
                        </button>

                        <button
                            onClick={() => { setShowSettings(!showSettings); setShowStats(false); setShowChapterList(false); }}
                            className={`p-3 rounded-2xl transition-all duration-500 ease-expressive ${showSettings ? 'bg-primary text-primary-foreground shadow-lg scale-110' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                            title="Settings"
                        >
                            <span className="material-icons-round text-2xl">settings</span>
                        </button>

                        <button
                            onClick={toggleFullscreen}
                            className="p-3 rounded-2xl text-white/40 hover:text-white hover:bg-white/5 transition-all duration-500 hover:scale-110 active:scale-90"
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

export default Player;
