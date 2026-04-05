import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Dropzone } from './components/Dropzone';
import { Player } from './components/Player';
import { VideoTile } from './components/VideoTile';
import { PlaylistView } from './components/PlaylistView';
import { HistoryView } from './components/HistoryView';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VideoFile, Playlist, WatchHistoryEntry, MediaTechnicalReport, VideoMetadata } from './types';
import { deleteMediaBlob, deleteTechnicalReport, getMediaBlob, getTechnicalReport, putMediaFile, putTechnicalReport } from './lib/mediaStore';
import { analyzeMediaBlob, analyzeMediaFile, buildFallbackTechnicalReport } from './lib/mediaInfo';

const STORAGE_KEY_LIBRARY = 'nova_library';
const STORAGE_KEY_PLAYLISTS = 'nova_playlists';
const STORAGE_KEY_HISTORY = 'nova_history';

type PersistedVideo = Omit<VideoFile, 'url' | 'file'>;

const guessMetadata = (file: File): VideoFile['metadata'] => {
    const name = file.name.toLowerCase();
    const is4K = name.includes('4k') || name.includes('2160p');
    const isHDR = name.includes('hdr');
    const isDV = name.includes('dv') || name.includes('dolby vision');
    
    let audioCodec = 'AAC 5.1';
    if (name.includes('atmos')) audioCodec = 'Dolby Atmos';
    else if (name.includes('dts') || name.includes('dts-hd') || name.includes('dts:x')) audioCodec = 'DTS';
    else if (name.includes('ac3') || name.includes('dd+')) audioCodec = 'Dolby Digital';
    else if (name.includes('aac')) audioCodec = 'AAC';

    const isEpisode = /s\d{2}e\d{2}/i.test(name) || name.includes('episode');

    const chapters = [
        { title: 'Prologue', startTime: 0 },
        { title: 'The Opening', startTime: 60 },
        { title: 'Act I: Initiation', startTime: 180 },
        { title: 'Act II: The Conflict', startTime: 420 },
        { title: 'Climax', startTime: 600 },
        { title: 'Resolution', startTime: 800 },
        { title: 'Credits', startTime: 950 }
    ];

    const hdrType: VideoFile['metadata']['hdrType'] = isDV ? 'Dolby Vision' : isHDR ? 'HDR10' : 'SDR';

    return {
        duration: '1:42:15',
        durationSeconds: 6165,
        resolution: is4K ? '4K UHD' : '1080p',
        videoCodec: name.includes('hevc') || name.includes('h265') ? 'HEVC' : 'H.264',
        audioCodec: audioCodec,
        container: name.split('.').pop()?.toUpperCase() || 'MKV',
        hdrType,
        bitrate: is4K ? '65.4 Mb/s' : '12.0 Mb/s',
        colorSpace: isHDR ? 'BT.2020' : 'BT.709',
        intro: isEpisode ? { start: 10, end: 40 } : undefined,
        chapters: chapters
    };
};

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState('media');
    const [view, setView] = useState<'library' | 'player'>('library');
    const [library, setLibrary] = useState<VideoFile[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
    const [currentVideo, setCurrentVideo] = useState<VideoFile | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [isStorageLoaded, setIsStorageLoaded] = useState(false);
    const [technicalReports, setTechnicalReports] = useState<Record<string, MediaTechnicalReport>>({});
    const [isTechnicalReportLoading, setIsTechnicalReportLoading] = useState(false);
    const managedUrlsRef = useRef<Set<string>>(new Set());

    const createManagedUrl = useCallback((blob: Blob) => {
        const url = URL.createObjectURL(blob);
        managedUrlsRef.current.add(url);
        return url;
    }, []);

    const revokeManagedUrl = useCallback((url?: string) => {
        if (!url) {
            return;
        }
        if (managedUrlsRef.current.delete(url)) {
            URL.revokeObjectURL(url);
        }
    }, []);

    const toPersistedLibrary = useCallback((videos: VideoFile[]): PersistedVideo[] => {
        return videos.map(({ url, file, ...rest }) => rest);
    }, []);

    const updateVideoMetadata = useCallback((videoId: string, updater: (previous: VideoMetadata) => VideoMetadata) => {
        setLibrary((prev) => prev.map((video) => {
            if (video.id !== videoId) {
                return video;
            }

            return {
                ...video,
                metadata: updater(video.metadata),
            };
        }));

        setCurrentVideo((prev) => {
            if (!prev || prev.id !== videoId) {
                return prev;
            }

            return {
                ...prev,
                metadata: updater(prev.metadata),
            };
        });
    }, []);

    useEffect(() => {
        return () => {
            for (const url of managedUrlsRef.current) {
                URL.revokeObjectURL(url);
            }
            managedUrlsRef.current.clear();
        };
    }, []);

    useEffect(() => {
        let isCancelled = false;

        const loadStoredData = async () => {
            try {
                const savedPlaylists = localStorage.getItem(STORAGE_KEY_PLAYLISTS);
                if (savedPlaylists) {
                    setPlaylists(JSON.parse(savedPlaylists));
                }

                const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
                if (savedHistory) {
                    setWatchHistory(JSON.parse(savedHistory));
                }
            } catch (e) {
                console.error('Failed to load playlist or history storage:', e);
            }

            try {
                const savedLibrary = localStorage.getItem(STORAGE_KEY_LIBRARY);
                if (savedLibrary) {
                    const parsedLibrary = JSON.parse(savedLibrary) as PersistedVideo[];
                    const hydratedLibrary = await Promise.all(
                        parsedLibrary.map(async (item) => {
                            if (!item?.id || !item?.metadata) {
                                return null;
                            }

                            const blob = await getMediaBlob(item.id);
                            if (!blob) {
                                return null;
                            }

                            return {
                                ...item,
                                size: item.size || blob.size,
                                url: createManagedUrl(blob),
                            } satisfies VideoFile;
                        })
                    );

                    if (!isCancelled) {
                        const validVideos = hydratedLibrary.filter((video): video is VideoFile => Boolean(video));
                        setLibrary(validVideos);

                        if (validVideos.length !== parsedLibrary.length) {
                            localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(toPersistedLibrary(validVideos)));
                        }
                    } else {
                        hydratedLibrary.forEach((video) => {
                            if (video?.url) {
                                revokeManagedUrl(video.url);
                            }
                        });
                    }
                }
            } catch (e) {
                console.error('Failed to load library storage:', e);
            } finally {
                if (!isCancelled) {
                    setIsStorageLoaded(true);
                }
            }
        };

        void loadStoredData();

        return () => {
            isCancelled = true;
        };
    }, [createManagedUrl, revokeManagedUrl, toPersistedLibrary]);

    useEffect(() => {
        if (!isStorageLoaded) {
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(toPersistedLibrary(library)));
        } catch (e) {
            console.error('Failed to save library:', e);
        }
    }, [isStorageLoaded, library, toPersistedLibrary]);

    useEffect(() => {
        if (!isStorageLoaded) {
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists));
        } catch (e) {
            console.error('Failed to save playlists:', e);
        }
    }, [isStorageLoaded, playlists]);

    useEffect(() => {
        if (!isStorageLoaded) {
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(watchHistory));
        } catch (e) {
            console.error('Failed to save history:', e);
        }
    }, [isStorageLoaded, watchHistory]);

    useEffect(() => {
        if (!currentVideo) {
            setIsTechnicalReportLoading(false);
            return;
        }

        if (technicalReports[currentVideo.id]) {
            setIsTechnicalReportLoading(false);
            return;
        }

        let isCancelled = false;

        const loadTechnicalReport = async () => {
            setIsTechnicalReportLoading(true);

            try {
                const storedReport = await getTechnicalReport(currentVideo.id);
                if (storedReport) {
                    if (!isCancelled) {
                        setTechnicalReports((prev) => ({
                            ...prev,
                            [currentVideo.id]: storedReport,
                        }));
                    }
                    return;
                }

                const blob = await getMediaBlob(currentVideo.id);
                if (!blob) {
                    return;
                }

                const extension = currentVideo.metadata.container?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
                const inferredName = currentVideo.name.includes('.') ? currentVideo.name : `${currentVideo.name}.${extension}`;

                const { metadata, report } = await analyzeMediaBlob(blob, inferredName, currentVideo.metadata);
                await putTechnicalReport(currentVideo.id, report);

                if (isCancelled) {
                    return;
                }

                setTechnicalReports((prev) => ({
                    ...prev,
                    [currentVideo.id]: report,
                }));

                updateVideoMetadata(currentVideo.id, () => ({
                    ...metadata,
                    analysisStatus: 'ready',
                    analysisError: undefined,
                }));
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load technical report.';

                if (!isCancelled) {
                    updateVideoMetadata(currentVideo.id, (previous) => ({
                        ...previous,
                        analysisStatus: 'failed',
                        analysisError: message,
                    }));
                }
            } finally {
                if (!isCancelled) {
                    setIsTechnicalReportLoading(false);
                }
            }
        };

        void loadTechnicalReport();

        return () => {
            isCancelled = true;
        };
    }, [currentVideo, technicalReports, updateVideoMetadata]);

    const handleFileDrop = useCallback((fileList: FileList) => {
        const files = Array.from(fileList);
        const newFiles: VideoFile[] = files.map((file) => {
            const guessedMetadata = guessMetadata(file);

            return {
                id: crypto.randomUUID(),
                name: file.name.replace(/\.[^/.]+$/, ""),
                url: createManagedUrl(file),
                size: file.size,
                metadata: {
                    ...guessedMetadata,
                    analysisStatus: 'pending',
                    analysisError: undefined,
                }
            };
        });

        setLibrary(prev => [...prev, ...newFiles]);

        void Promise.all(
            newFiles.map((video, index) => putMediaFile(video.id, files[index]))
        ).catch((error) => {
            console.error('Failed to persist dropped files in IndexedDB:', error);
        });

        void (async () => {
            for (let index = 0; index < files.length; index += 1) {
                const file = files[index];
                const video = newFiles[index];

                try {
                    const { metadata, report } = await analyzeMediaFile(file, video.metadata);
                    await putTechnicalReport(video.id, report);

                    setTechnicalReports((prev) => ({
                        ...prev,
                        [video.id]: report,
                    }));

                    updateVideoMetadata(video.id, () => ({
                        ...metadata,
                        analysisStatus: 'ready',
                        analysisError: undefined,
                    }));
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Media analysis failed.';
                    const fallbackReport = buildFallbackTechnicalReport(file, video.metadata, message);

                    await putTechnicalReport(video.id, fallbackReport);

                    setTechnicalReports((prev) => ({
                        ...prev,
                        [video.id]: fallbackReport,
                    }));

                    updateVideoMetadata(video.id, (previous) => ({
                        ...previous,
                        analysisStatus: 'failed',
                        analysisError: message,
                    }));
                }
            }
        })();
    }, [createManagedUrl, updateVideoMetadata]);

    const playVideo = useCallback((video: VideoFile) => {
        setLibrary(prev => prev.map(v => 
            v.id === video.id ? { ...v, lastPlayed: Date.now() } : v
        ));
        setCurrentVideo(video);
        setView('player');
        setIsSelectionMode(false);
        setSelectedVideos(new Set());
    }, []);

    const handleVideoProgress = useCallback((videoId: string, position: number, duration: number) => {
        if (!Number.isFinite(position) || !Number.isFinite(duration)) {
            return;
        }

        setLibrary(prev => prev.map(v => 
            v.id === videoId ? { ...v, playPosition: position } : v
        ));
        
        const video = library.find(v => v.id === videoId);
        if (video) {
            setWatchHistory(prev => {
                const existing = prev.find(h => h.videoId === videoId);
                if (existing) {
                    return prev.map(h => 
                        h.videoId === videoId 
                            ? { ...h, position, duration, watchedAt: Date.now() }
                            : h
                    );
                }
                return [...prev, {
                    videoId,
                    videoName: video.name,
                    watchedAt: Date.now(),
                    duration,
                    position
                }];
            });
        }
    }, [library]);

    const backToLibrary = useCallback(() => {
        setView('library');
        setCurrentVideo(null);
    }, []);

    const deleteVideos = useCallback((ids: string[]) => {
        const idSet = new Set(ids);

        setLibrary(prev => {
            const kept: VideoFile[] = [];
            prev.forEach((video) => {
                if (idSet.has(video.id)) {
                    revokeManagedUrl(video.url);
                    return;
                }
                kept.push(video);
            });
            return kept;
        });

        setCurrentVideo((prev) => {
            if (prev && idSet.has(prev.id)) {
                return null;
            }
            return prev;
        });

        if (currentVideo && idSet.has(currentVideo.id)) {
            setView('library');
            setIsTechnicalReportLoading(false);
        }

        setPlaylists((prev) =>
            prev.map((playlist) => ({
                ...playlist,
                videoIds: playlist.videoIds.filter((videoId) => !idSet.has(videoId)),
            }))
        );

        setWatchHistory((prev) => prev.filter((entry) => !idSet.has(entry.videoId)));

        setTechnicalReports((prev) => {
            const next = { ...prev };
            ids.forEach((id) => {
                delete next[id];
            });
            return next;
        });

        void Promise.all(ids.flatMap((id) => [deleteMediaBlob(id), deleteTechnicalReport(id)])).catch((error) => {
            console.error('Failed to delete videos from IndexedDB:', error);
        });

        setSelectedVideos(new Set());
        setIsSelectionMode(false);
    }, [currentVideo, revokeManagedUrl]);

    const addToPlaylist = useCallback((playlistId: string, videoIds: string[]) => {
        setPlaylists(prev => prev.map(p => 
            p.id === playlistId 
                ? { ...p, videoIds: [...new Set([...p.videoIds, ...videoIds])] }
                : p
        ));
        setSelectedVideos(new Set());
        setIsSelectionMode(false);
    }, []);

    const createPlaylist = useCallback((name: string) => {
        const newPlaylist: Playlist = {
            id: crypto.randomUUID(),
            name,
            videoIds: [],
            createdAt: Date.now()
        };
        setPlaylists(prev => [...prev, newPlaylist]);
    }, []);

    const deletePlaylist = useCallback((playlistId: string) => {
        setPlaylists(prev => prev.filter(p => p.id !== playlistId));
    }, []);

    const toggleVideoSelection = useCallback((videoId: string) => {
        setSelectedVideos(prev => {
            const newSet = new Set(prev);
            if (newSet.has(videoId)) {
                newSet.delete(videoId);
            } else {
                newSet.add(videoId);
            }
            return newSet;
        });
    }, []);

    const filteredLibrary = useMemo(() => {
        if (!searchQuery) return library;
        const query = searchQuery.toLowerCase();
        return library.filter(v => v.name.toLowerCase().includes(query));
    }, [library, searchQuery]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showShortcuts) setShowShortcuts(false);
                else if (isSelectionMode) {
                    setIsSelectionMode(false);
                    setSelectedVideos(new Set());
                }
                else if (showSearch) {
                    setShowSearch(false);
                    setSearchQuery('');
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowShortcuts(true);
            }
        };
        
        const handleClickOutside = (e: MouseEvent) => {
            if (showSearch) {
                const searchContainer = document.getElementById('search-container');
                if (searchContainer && !searchContainer.contains(e.target as Node)) {
                    setShowSearch(false);
                    setSearchQuery('');
                }
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        document.addEventListener('click', handleClickOutside);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showShortcuts, isSelectionMode, showSearch, setShowSearch, setSearchQuery]);

    if (view === 'player' && currentVideo) {
        return (
            <ErrorBoundary>
                <Player 
                    video={currentVideo} 
                    onBack={backToLibrary}
                    onProgress={(pos, dur) => handleVideoProgress(currentVideo.id, pos, dur)}
                    technicalReport={technicalReports[currentVideo.id] ?? null}
                    technicalReportLoading={isTechnicalReportLoading}
                />
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
            <div className="relative min-h-screen w-full flex flex-col items-center overflow-x-hidden bg-background dark:bg-background transition-colors duration-500">
                <Navbar 
                    activeTab={activeTab} 
                    onTabChange={setActiveTab}
                    onSearch={setSearchQuery}
                    searchQuery={searchQuery}
                    showSearch={showSearch}
                    setShowSearch={setShowSearch}
                />

                <main className="w-full max-w-7xl px-6 relative z-10 mt-28 pb-20">
                    {activeTab === 'media' && (
                        <>
                            {library.length === 0 ? (
                                <div className="min-h-[60vh] flex flex-col items-center justify-center">
                                    <Dropzone onFileDrop={handleFileDrop} />
                                </div>
                            ) : (
                                <div className="animate-fade-in">
                                    <div className="flex items-center justify-between mb-8">
                                        <h2 className="text-xl font-medium text-foreground dark:text-foreground tracking-tight transition-colors">
                                            {searchQuery ? `Search: "${searchQuery}"` : 'Library'}
                                        </h2>
                                        <div className="flex items-center space-x-2">
                                            {isSelectionMode && selectedVideos.size > 0 && (
                                                <div className="flex items-center space-x-2 mr-4">
                                                    <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                                                        {selectedVideos.size} selected
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            const name = prompt('Enter playlist name:');
                                                            if (name) createPlaylist(name);
                                                        }}
                                                        className="text-xs font-medium text-blue-500 hover:text-blue-600 px-2 py-1"
                                                    >
                                                        + Playlist
                                                    </button>
                                                    <button
                                                        onClick={() => deleteVideos(Array.from(selectedVideos))}
                                                        className="text-xs font-medium text-red-500 hover:text-red-600 px-2 py-1"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                            <button 
                                                className={`text-xs font-medium transition-colors uppercase tracking-wide px-3 py-1.5 rounded-full ${
                                                    isSelectionMode 
                                                        ? 'bg-muted text-foreground dark:text-foreground' 
                                                        : 'text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted'
                                                }`}
                                                onClick={() => setIsSelectionMode(!isSelectionMode)}
                                            >
                                                {isSelectionMode ? 'Cancel' : 'Select'}
                                            </button>
                                            <button 
                                                className="text-xs font-medium text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground transition-colors uppercase tracking-wide px-3 py-1.5 rounded-full hover:bg-muted dark:hover:bg-muted"
                                                onClick={() => document.getElementById('add-more-input')?.click()}
                                            >
                                                + Add Video
                                            </button>
                                            <button 
                                                className="text-xs font-medium text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground transition-colors px-2 py-1.5"
                                                onClick={() => setShowShortcuts(true)}
                                                title="Keyboard Shortcuts"
                                            >
                                                <span className="material-icons-round text-lg">keyboard</span>
                                            </button>
                                            <input 
                                                id="add-more-input" 
                                                type="file" 
                                                className="hidden" 
                                                multiple 
                                                accept="video/*" 
                                                onChange={(e) => e.target.files && handleFileDrop(e.target.files)} 
                                            />
                                        </div>
                                    </div>

                                    {filteredLibrary.length === 0 ? (
                                        <div className="text-center py-20">
                                            <p className="text-muted-foreground dark:text-muted-foreground">No videos found</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {filteredLibrary.map((video, index) => (
                                                <div
                                                    key={video.id}
                                                    className="animate-fade-in relative"
                                                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                                                >
                                                    {isSelectionMode && (
                                                        <div 
                                                            className={`absolute top-2 left-2 z-30 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
                                                                selectedVideos.has(video.id)
                                                                    ? 'bg-blue-500 border-blue-500'
                                                                    : 'bg-black/30 border-white/50 hover:border-white'
                                                            }`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleVideoSelection(video.id);
                                                            }}
                                                        >
                                                            {selectedVideos.has(video.id) && (
                                                                <span className="material-icons-round text-white text-sm">check</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <VideoTile 
                                                        video={video} 
                                                        onClick={() => isSelectionMode ? toggleVideoSelection(video.id) : playVideo(video)}
                                                        isSelected={selectedVideos.has(video.id)}
                                                    />
                                                </div>
                                            ))}
                                            
                                            <div 
                                                onClick={() => document.getElementById('add-more-input')?.click()}
                                                className="animate-fade-in group flex flex-col items-center justify-center aspect-video rounded-xl border border-dashed border-muted dark:border hover:border-muted-foreground dark:hover:border hover:bg-muted dark:hover:bg-muted transition-all duration-300 ease-out hover:-translate-y-1 cursor-pointer"
                                                style={{ animationDelay: `${filteredLibrary.length * 50}ms`, animationFillMode: 'both' }}
                                            >
                                                <span className="material-icons-round text-3xl text-primary dark:text-primary mb-2 transition-colors">add</span>
                                                <span className="text-xs text-primary dark:text-primary font-medium group-hover:text-primary dark:group-hover:text-primary transition-colors">Add to Library</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'playlists' && (
                        <PlaylistView 
                            playlists={playlists}
                            library={library}
                            onPlayVideo={playVideo}
                            onDeletePlaylist={deletePlaylist}
                            onAddVideos={addToPlaylist}
                            onCreatePlaylist={createPlaylist}
                        />
                    )}

                    {activeTab === 'history' && (
                        <HistoryView 
                            history={watchHistory}
                            library={library}
                            onPlayVideo={playVideo}
                        />
                    )}
                </main>

                {library.length === 0 && (
                    <footer className="absolute bottom-6 w-full text-center z-10 pointer-events-none">
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground font-medium tracking-wide">
                            Nova Player • v3.0.0
                        </p>
                    </footer>
                )}

                {showShortcuts && (
                    <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />
                )}
            </div>
        </ErrorBoundary>
    );
};

export default App;
