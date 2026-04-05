import React from 'react';

interface KeyboardShortcutsProps {
    onClose: () => void;
}

const shortcuts = [
    { category: 'Playback', items: [
        { keys: ['Space', 'K'], description: 'Play/Pause' },
        { keys: ['F'], description: 'Toggle Fullscreen' },
        { keys: ['M'], description: 'Mute/Unmute' },
    ]},
    { category: 'Navigation', items: [
        { keys: ['←', 'J'], description: 'Rewind 10s' },
        { keys: ['→', 'L'], description: 'Forward 10s' },
        { keys: ['↑'], description: 'Volume Up' },
        { keys: ['↓'], description: 'Volume Down' },
    ]},
    { category: 'Chapters', items: [
        { keys: ['Shift', 'N'], description: 'Next Chapter' },
        { keys: ['Shift', 'P'], description: 'Previous Chapter' },
        { keys: ['S'], description: 'Skip Intro' },
    ]},
    { category: 'Subtitles', items: [
        { keys: ['C'], description: 'Toggle Subtitles' },
    ]},
    { category: 'General', items: [
        { keys: ['Esc'], description: 'Close/Back' },
        { keys: ['Ctrl', 'K'], description: 'Show Shortcuts' },
    ]},
];

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ onClose }) => {
    return (
        <div 
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-surface-dark border border-zinc-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Keyboard Shortcuts</h2>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-500"
                    >
                        <span className="material-icons-round text-lg">close</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {shortcuts.map(section => (
                        <div key={section.category}>
                            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider mb-3">
                                {section.category}
                            </h3>
                            <div className="space-y-2">
                                {section.items.map(shortcut => (
                                    <div key={shortcut.description} className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-600 dark:text-zinc-400">{shortcut.description}</span>
                                        <div className="flex items-center space-x-1">
                                            {shortcut.keys.map((key, i) => (
                                                <React.Fragment key={key}>
                                                    <kbd className="px-2 py-1 bg-zinc-100 dark:bg-white/10 border border-zinc-200 dark:border-white/10 rounded text-xs font-mono text-zinc-700 dark:text-zinc-300">
                                                        {key}
                                                    </kbd>
                                                    {i < shortcut.keys.length - 1 && <span className="text-zinc-400">+</span>}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-white/10 text-center">
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        Press <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-white/10 rounded text-xs font-mono">Esc</kbd> to close
                    </p>
                </div>
            </div>
        </div>
    );
};
