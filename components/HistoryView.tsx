import React from 'react';
import { VideoFile, WatchHistoryEntry } from '../types';

interface HistoryViewProps {
    history: WatchHistoryEntry[];
    library: VideoFile[];
    onPlayVideo: (video: VideoFile) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, library, onPlayVideo }) => {
    const getVideo = (videoId: string) => library.find(v => v.id === videoId);
    
    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        }
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const formatWatchedDate = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    const sortedHistory = [...history].sort((a, b) => b.watchedAt - a.watchedAt);

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-medium text-foreground dark:text-text-main tracking-tight">Watch History</h2>
                {history.length > 0 && (
                    <span className="text-xs text-muted-foreground dark:text-text-muted">
                        {history.length} videos
                    </span>
                )}
            </div>

            {history.length === 0 ? (
                <div className="text-center py-20">
                    <span className="material-icons-round text-6xl text-muted-foreground dark:text-zinc-700 mb-4">history</span>
                    <p className="text-muted-foreground dark:text-text-muted">No watch history yet</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sortedHistory.map((entry, index) => {
                        const video = getVideo(entry.videoId);
                        const progress = entry.duration > 0 ? (entry.position / entry.duration) * 100 : 0;
                        
                        return (
                            <div
                                key={`${entry.videoId}-${entry.watchedAt}`}
                                className="flex items-center p-3 rounded-xl hover:bg-muted dark:hover:bg-white/5 transition-colors cursor-pointer group"
                                style={{ animationDelay: `${index * 30}ms` }}
                                onClick={() => video && onPlayVideo(video)}
                            >
                                <div className="relative w-40 aspect-video bg-muted dark:bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
                                    {video ? (
                                        <>
                                            <div className="absolute inset-0 bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center">
                                                <span className="material-icons-round text-3xl text-muted-foreground dark:text-muted-foreground">play_circle</span>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                                                <div 
                                                    className="h-full bg-blue-500" 
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/60 rounded text-[9px] text-white">
                                                {formatDuration(entry.position)}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="material-icons-round text-3xl text-muted-foreground">error</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="ml-4 flex-1 min-w-0">
                                    <h3 className="text-sm font-medium text-foreground dark:text-foreground truncate">
                                        {entry.videoName}
                                    </h3>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                                            {formatWatchedDate(entry.watchedAt)}
                                        </span>
                                        {progress > 0 && (
                                            <>
                                                <span className="text-muted-foreground dark:text-zinc-600">•</span>
                                                <span className="text-xs text-muted-foreground dark:text-muted-foreground">
                                                    {progress.toFixed(0)}% watched
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="material-icons-round text-muted-foreground">chevron_right</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
