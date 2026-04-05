import React, { useState, useEffect, useRef } from 'react';
import { NavItem } from '../types';
import { AnimatedThemeToggler } from './ui/animated-theme-toggler';

interface NavbarProps {
    activeTab: string;
    onTabChange: (id: string) => void;
    searchQuery?: string;
    onSearch?: (query: string) => void;
    showSearch?: boolean;
    setShowSearch?: (show: boolean) => void;
}

const navItems: NavItem[] = [
    { id: 'media', label: 'Media' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'history', label: 'History' },
];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange, searchQuery = '', onSearch, showSearch = false, setShowSearch }) => {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const tabsRef = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const currentTab = tabsRef.current[activeTab];
    if (currentTab) {
      setIndicatorStyle({
        left: currentTab.offsetLeft,
        width: currentTab.offsetWidth,
        opacity: 1
      });
    }
  }, [activeTab]);

  return (
    <nav className="absolute top-8 z-40 w-full flex justify-center animate-[slideDown_0.6s_ease-out_forwards]">
      <style>
        {`
          @keyframes slideDown {
            from { transform: translateY(-100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}
      </style>
      <div className="relative bg-card/80 dark:bg-card/80 backdrop-blur-md border border dark:border p-1 rounded-full flex items-center shadow-2xl transition-colors duration-300">
        
        {/* Sliding Active Indicator */}
        <div
            className="absolute top-1 bottom-1 rounded-full bg-primary/10 dark:bg-primary/10 border border-transparent dark:border-transparent transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ 
                left: indicatorStyle.left, 
                width: indicatorStyle.width,
                opacity: indicatorStyle.opacity,
            }}
        />

        {navItems.map((item) => (
          <button
            key={item.id}
            ref={(el) => { tabsRef.current[item.id] = el; }}
            onClick={() => onTabChange(item.id)}
            className={`
              relative z-10 px-6 py-2 rounded-full text-sm font-medium transition-colors duration-300
              ${activeTab === item.id 
                ? 'text-foreground dark:text-foreground' 
                : 'text-muted-foreground hover:text-foreground dark:hover:text-foreground'}
            `}
          >
            {item.label}
          </button>
        ))}

        <div className="w-px h-4 bg-muted dark:bg-muted mx-2 relative z-10 transition-colors"></div>

        {onSearch && setShowSearch && (
            <div id="search-container" className="relative z-10 flex items-center">
                <div 
                    className="flex items-center overflow-hidden transition-all duration-300 ease-out"
                    style={{ 
                        width: showSearch ? '200px' : '0px',
                        opacity: showSearch ? 1 : 0,
                    }}
                >
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search library..."
                        value={searchQuery}
                        onChange={(e) => onSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                onSearch('');
                                setShowSearch(false);
                            }
                        }}
                        autoFocus={showSearch}
                        className="w-full px-3 py-1.5 text-sm bg-muted dark:bg-muted border border rounded-full focus:outline-none text-foreground dark:text-foreground placeholder-muted-foreground"
                    />
                </div>
                <button 
                    className="p-2.5 rounded-full text-muted-foreground hover:text-foreground dark:hover:text-foreground transition-colors duration-200"
                    onClick={() => {
                        if (showSearch && searchQuery) {
                            onSearch('');
                        }
                        setShowSearch(!showSearch);
                    }}
                    aria-label={showSearch ? "Close search" : "Search library"}
                >
                    <span className="material-icons-round text-lg">
                        {showSearch ? 'close' : 'search'}
                    </span>
                </button>
            </div>
        )}
        
        <AnimatedThemeToggler />
      </div>
    </nav>
  );
};