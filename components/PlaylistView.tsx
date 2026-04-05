import React, { useMemo, useState } from 'react';
import { VideoFile, Playlist } from '../types';

interface PlaylistViewProps {
    playlists: Playlist[];
    library: VideoFile[];
    onPlayVideo: (video: VideoFile) => void;
    onDeletePlaylist: (id: string) => void;
    onAddVideos: (playlistId: string, videoIds: string[]) => void;
    onCreatePlaylist: (name: string) => void;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
    playlists,
    library,
    onPlayVideo,
    onDeletePlaylist,
    onAddVideos,
    onCreatePlaylist
}) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
    const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());

    const handleCreate = () => {
        if (newPlaylistName.trim()) {
            onCreatePlaylist(newPlaylistName.trim());
            setNewPlaylistName('');
            setShowCreateModal(false);
        }
    };

    const getPlaylistVideos = (playlist: Playlist) => {
        return library.filter(v => playlist.videoIds.includes(v.id));
    };

    const playlistForSelection = useMemo(
        () => playlists.find((playlist) => playlist.id === selectedPlaylist) ?? null,
        [playlists, selectedPlaylist]
    );

    const availableVideos = useMemo(() => {
        if (!playlistForSelection) {
            return [] as VideoFile[];
        }

        const existingIds = new Set(playlistForSelection.videoIds);
        return library.filter((video) => !existingIds.has(video.id));
    }, [library, playlistForSelection]);

    const toggleVideoSelection = (videoId: string) => {
        setSelectedVideoIds((prev) => {
            const next = new Set(prev);
            if (next.has(videoId)) {
                next.delete(videoId);
            } else {
                next.add(videoId);
            }
            return next;
        });
    };

    const openAddVideosModal = (playlistId: string) => {
        setSelectedPlaylist(playlistId);
        setSelectedVideoIds(new Set());
    };

    const closeAddVideosModal = () => {
        setSelectedPlaylist(null);
        setSelectedVideoIds(new Set());
    };

    const handleAddVideosToPlaylist = () => {
        if (!selectedPlaylist || selectedVideoIds.size === 0) {
            return;
        }

        onAddVideos(selectedPlaylist, Array.from(selectedVideoIds));
        closeAddVideosModal();
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-medium text-foreground dark:text-text-main tracking-tight">Playlists</h2>
                <button 
                    className="text-xs font-medium text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground transition-colors uppercase tracking-wide px-3 py-1.5 rounded-full hover:bg-muted dark:hover:bg-muted"
                    onClick={() => setShowCreateModal(true)}
                >
                    + New Playlist
                </button>
            </div>

            {playlists.length === 0 ? (
                <div className="text-center py-20">
                    <span className="material-icons-round text-6xl text-muted-foreground dark:text-muted-foreground mb-4">playlist_play</span>
                    <p className="text-muted-foreground dark:text-text-muted mb-4">No playlists yet</p>
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="text-sm text-blue-500 hover:text-blue-600"
                    >
                        Create your first playlist
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {playlists.map(playlist => {
                        const videos = getPlaylistVideos(playlist);
                        return (
                            <div 
                                key={playlist.id}
                                className="group relative flex flex-col bg-card dark:bg-card rounded-xl border border overflow-hidden hover:shadow-lg transition-all duration-300"
                            >
                                <div 
                                    className="aspect-video bg-muted dark:bg-muted cursor-pointer relative"
                                    onClick={() => videos.length > 0 && onPlayVideo(videos[0])}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="material-icons-round text-5xl text-muted-foreground dark:text-muted-foreground group-hover:text-foreground transition-colors">play_circle</span>
                                    </div>
                                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs text-foreground">
                                        {videos.length} videos
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-medium text-foreground dark:text-foreground truncate">{playlist.name}</h3>
                                    <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
                                        Created {new Date(playlist.createdAt).toLocaleDateString()}
                                    </p>
                                    <div className="flex items-center justify-end mt-3 space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openAddVideosModal(playlist.id)}
                                            className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-500"
                                            title="Add videos"
                                        >
                                            <span className="material-icons-round text-sm">playlist_add</span>
                                        </button>
                                        <button
                                            onClick={() => onDeletePlaylist(playlist.id)}
                                            className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500"
                                            title="Delete playlist"
                                        >
                                            <span className="material-icons-round text-sm">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-card dark:bg-card border border rounded-2xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-medium text-foreground dark:text-foreground mb-4">Create Playlist</h3>
                        <input
                            type="text"
                            placeholder="Playlist name"
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            autoFocus
                            className="w-full px-4 py-2.5 bg-muted dark:bg-muted border border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground dark:text-foreground"
                        />
                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground dark:hover:text-foreground"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!newPlaylistName.trim()}
                                className="px-4 py-2 text-sm bg-blue-500 text-foreground rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedPlaylist && (
                <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-card dark:bg-card border border rounded-2xl p-6 w-full max-w-xl mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-foreground dark:text-foreground">
                                Add Videos to {playlistForSelection?.name ?? 'Playlist'}
                            </h3>
                            <button
                                onClick={closeAddVideosModal}
                                className="p-1.5 rounded-full hover:bg-muted dark:hover:bg-muted text-muted-foreground"
                                title="Close"
                            >
                                <span className="material-icons-round text-lg">close</span>
                            </button>
                        </div>

                        {library.length === 0 ? (
                            <p className="text-sm text-muted-foreground dark:text-muted-foreground py-8 text-center">
                                Add videos to your library first.
                            </p>
                        ) : availableVideos.length === 0 ? (
                            <p className="text-sm text-muted-foreground dark:text-muted-foreground py-8 text-center">
                                All library videos are already in this playlist.
                            </p>
                        ) : (
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                                {availableVideos.map((video) => {
                                    const isSelected = selectedVideoIds.has(video.id);

                                    return (
                                        <button
                                            key={video.id}
                                            onClick={() => toggleVideoSelection(video.id)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors text-left ${
                                                isSelected
                                                    ? 'border-blue-500 bg-blue-500/10'
                                                    : 'border hover:bg-muted dark:hover:bg-muted'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-foreground dark:text-foreground truncate">{video.name}</p>
                                                <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
                                                    {video.metadata.resolution} • {video.metadata.duration}
                                                </p>
                                            </div>
                                            <span className={`material-icons-round text-base ${isSelected ? 'text-blue-500' : 'text-muted-foreground'}`}>
                                                {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                onClick={closeAddVideosModal}
                                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground dark:hover:text-foreground"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddVideosToPlaylist}
                                disabled={selectedVideoIds.size === 0}
                                className="px-4 py-2 text-sm bg-blue-500 text-foreground rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add Selected
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
