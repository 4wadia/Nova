import React from 'react';

interface KeyboardShortcutsProps {
    onClose: () => void;
}

const shortcuts = [
    { category: 'Playback', items: [
        { keys: ['Space', 'K'], description: 'Play/Pause' },
        { keys: ['F'], description: 'Toggle Fullscreen' },
        { keys: ['M'], description: 'Mute/Unmute' },
        { keys: ['P'], description: 'Picture-in-Picture' },
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
        { keys: ['I'], description: 'Toggle Nerd Stats' },
        { keys: ['Esc'], description: 'Close/Back' },
        { keys: ['Ctrl', 'K'], description: 'Show Shortcuts' },
    ]},
];

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({ onClose }) => {
    return (
        <div 
            className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm flex items-center justify-center"
            onClick={onClose}
        >
            <div 
                className="bg-popover border border-border rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-foreground">Keyboard Shortcuts</h2>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-accent-foreground"
                    >
                        <span className="material-icons-round text-lg">close</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {shortcuts.map(section => (
                        <div key={section.category}>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                {section.category}
                            </h3>
                            <div className="space-y-2">
                                {section.items.map(shortcut => (
                                    <div key={shortcut.description} className="flex items-center justify-between">
                                        <span className="text-sm text-foreground/90">{shortcut.description}</span>
                                        <div className="flex items-center space-x-1">
                                            {shortcut.keys.map((key, i) => (
                                                <React.Fragment key={key}>
                                                    <kbd className="px-2 py-1 bg-muted border border-border rounded text-xs font-mono text-foreground/90">
                                                        {key}
                                                    </kbd>
                                                    {i < shortcut.keys.length - 1 && <span className="text-muted-foreground">+</span>}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-border text-center">
                    <p className="text-xs text-muted-foreground">
                        Press <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-xs font-mono text-foreground/90">Esc</kbd> to close
                    </p>
                </div>
            </div>
        </div>
    );
};
