import React, { useState, useEffect, useRef } from 'react';
import { NavItem } from '../types';
import { ThemeToggler } from './ThemeToggler';

interface NavbarProps {
    activeTab: string;
    onTabChange: (id: string) => void;
}

const navItems: NavItem[] = [
    { id: 'media', label: 'Media' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'history', label: 'History' },
];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const tabsRef = useRef<{ [key: string]: HTMLButtonElement | null }>({});

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
      <div className="relative bg-white/70 dark:bg-black/40 backdrop-blur-md border border-zinc-200 dark:border-white/5 p-1 rounded-full flex items-center shadow-2xl transition-colors duration-300">
        
        {/* Sliding Active Indicator */}
        <div
            className="absolute top-1 bottom-1 rounded-full bg-zinc-900/5 dark:bg-white/10 border border-black/5 dark:border-white/5 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
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
                ? 'text-black dark:text-white' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}
            `}
          >
            {item.label}
          </button>
        ))}

        <div className="w-px h-4 bg-zinc-300 dark:bg-white/5 mx-2 relative z-10 transition-colors"></div>

        <button className="relative z-10 p-2.5 rounded-full text-zinc-500 hover:text-gray-900 dark:hover:text-white transition-colors duration-200">
          <span className="material-icons-round text-lg">search</span>
        </button>
        
        <ThemeToggler />

        <button className="relative z-10 p-2.5 rounded-full text-zinc-500 hover:text-gray-900 dark:hover:text-white transition-colors duration-200">
          <span className="material-icons-round text-lg">settings</span>
        </button>
      </div>
    </nav>
  );
};