import React, { useState } from 'react';
import { Background } from './components/Background';
import { Navbar } from './components/Navbar';
import { Dropzone } from './components/Dropzone';
import { Player } from './components/Player';
import { VideoTile } from './components/VideoTile';
import { VideoFile } from './types';

// Helper to guess metadata since we don't have a real parser backend yet
const guessMetadata = (file: File) => {
    const name = file.name.toLowerCase();
    const is4K = name.includes('4k') || name.includes('2160p');
    const isHDR = name.includes('hdr');
    const isDV = name.includes('dv') || name.includes('dolby vision');

    // Audio detection
    let audioCodec = 'AAC 5.1';
    if (name.includes('atmos')) audioCodec = 'Dolby Atmos';
    else if (name.includes('dts') || name.includes('dts-hd') || name.includes('dts:x')) audioCodec = 'DTS';
    else if (name.includes('ac3') || name.includes('dd+')) audioCodec = 'Dolby Digital';
    else if (name.includes('aac')) audioCodec = 'AAC';

    // Mock intro detection for TV episodes (e.g., S01E01)
    const isEpisode = /s\d{2}e\d{2}/i.test(name) || name.includes('episode');

    // Mock chapters (generic structure)
    const chapters = [
        { title: 'Prologue', startTime: 0 },
        { title: 'The Opening', startTime: 60 },
        { title: 'Act I: Initiation', startTime: 180 },
        { title: 'Act II: The Conflict', startTime: 420 },
        { title: 'Climax', startTime: 600 },
        { title: 'Resolution', startTime: 800 },
        { title: 'Credits', startTime: 950 }
    ];

    return {
        duration: '1:42:15', // Mock
        resolution: is4K ? '4K UHD' : '1080p',
        videoCodec: name.includes('hevc') || name.includes('h265') ? 'HEVC' : 'H.264',
        audioCodec: audioCodec,
        container: name.split('.').pop()?.toUpperCase() || 'MKV',
        hdrType: isDV ? 'Dolby Vision' : (isHDR ? 'HDR10' : 'SDR') as any,
        bitrate: is4K ? '65.4 Mb/s' : '12.0 Mb/s',
        colorSpace: isHDR ? 'BT.2020' : 'BT.709',
        // Simulate an intro from 10s to 40s for episodes
        intro: isEpisode ? { start: 10, end: 40 } : undefined,
        chapters: chapters
    };
};

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState('media');
    const [view, setView] = useState<'library' | 'player'>('library');
    const [library, setLibrary] = useState<VideoFile[]>([]);
    const [currentVideo, setCurrentVideo] = useState<VideoFile | null>(null);

    // Generate a thumbnail from a video blob URL
    const generateThumbnail = (url: string): Promise<string> => {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = url;
            video.crossOrigin = 'anonymous';
            video.muted = true;
            video.preload = 'metadata';

            video.onloadedmetadata = () => {
                // Seek to 10% of duration for a good representative frame
                video.currentTime = Math.max(1, video.duration * 0.1);
            };

            video.onseeked = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/webp', 0.8));
                } else {
                    resolve('');
                }
                video.src = ''; // Release
            };

            video.onerror = () => resolve('');
        });
    };

    const handleFileDrop = (fileList: FileList) => {
        const newFiles: VideoFile[] = Array.from(fileList).map(file => ({
            id: crypto.randomUUID(),
            file,
            name: file.name.replace(/\.[^/.]+$/, ""),
            url: URL.createObjectURL(file),
            size: file.size,
            metadata: guessMetadata(file)
        }));

        setLibrary(prev => [...prev, ...newFiles]);

        // Generate thumbnails asynchronously
        newFiles.forEach(async (videoFile) => {
            const thumbnail = await generateThumbnail(videoFile.url);
            if (thumbnail) {
                setLibrary(prev => prev.map(v =>
                    v.id === videoFile.id ? { ...v, thumbnail } : v
                ));
            }
        });
    };

    const playVideo = (video: VideoFile) => {
        // Mark as played by updating timestamp
        setLibrary(prev => prev.map(v =>
            v.id === video.id ? { ...v, lastPlayed: Date.now() } : v
        ));
        setCurrentVideo(video);
        setView('player');
    };

    const backToLibrary = () => {
        setView('library');
        setCurrentVideo(null);
    };

    if (view === 'player' && currentVideo) {
        return (
            <>
                <Background />
                <Player video={currentVideo} onBack={backToLibrary} />
            </>
        )
    }

    return (
        <div className="relative min-h-screen w-full flex flex-col items-center overflow-x-hidden bg-background transition-colors duration-500">
            <Background />

            <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

            <main className="w-full max-w-7xl px-6 relative z-10 mt-28 pb-20">

                {/* Empty State / Dropzone */}
                {library.length === 0 ? (
                    <div className="min-h-[60vh] flex flex-col items-center justify-center">
                        <Dropzone onFileDrop={handleFileDrop} />
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        {/* Library Grid */}
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-medium text-foreground tracking-tight transition-colors">Library</h2>
                            <div className="flex items-center space-x-2">
                                <button
                                    className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-wide px-3 py-1.5 rounded-full hover:bg-primary/10"
                                    onClick={() => document.getElementById('add-more-input')?.click()}
                                >
                                    + Add Video
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {library.map(video => (
                                <VideoTile key={video.id} video={video} onClick={playVideo} />
                            ))}

                            {/* Add Card */}
                            <div
                                onClick={() => document.getElementById('add-more-input')?.click()}
                                className="group flex flex-col items-center justify-center aspect-video rounded-2xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
                            >
                                <span className="material-icons-round text-3xl text-muted-foreground group-hover:text-primary mb-2 transition-colors">add</span>
                                <span className="text-xs text-muted-foreground font-medium group-hover:text-primary transition-colors">Add to Library</span>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {library.length === 0 && (
                <footer className="absolute bottom-6 w-full text-center z-10 pointer-events-none">
                    <p className="text-xs text-muted-foreground/50 font-medium tracking-wide">
                        Nova Player • v2.5.0
                    </p>
                </footer>
            )}
        </div>
    );
};

export default App;