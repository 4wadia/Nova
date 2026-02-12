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
    <nav className="absolute top-10 z-40 w-full flex justify-center animate-fade-in">
      <div className="relative bg-card/60 backdrop-blur-2xl border border-border p-1.5 rounded-full flex items-center shadow-lg transition-all duration-500">

        {/* Sliding Active Indicator */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-full bg-primary/10 dark:bg-primary/15 shadow-sm border border-primary/20 transition-all duration-600 ease-expressive"
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
              relative z-10 px-7 py-2.5 rounded-full text-[13px] font-semibold tracking-tight transition-all duration-400
              ${activeTab === item.id
                ? 'text-primary dark:text-primary'
                : 'text-muted-foreground hover:text-foreground'}
            `}
          >
            {item.label}
          </button>
        ))}

        <div className="w-px h-5 bg-border mx-2 relative z-10"></div>

        <button className="relative z-10 p-2.5 rounded-full text-muted-foreground hover:text-primary transition-all duration-300 hover:bg-primary/10">
          <span className="material-icons-round text-xl">search</span>
        </button>

        <div className="relative z-10">
          <ThemeToggler />
        </div>

        <button className="relative z-10 p-2.5 rounded-full text-muted-foreground hover:text-primary transition-all duration-300 hover:bg-primary/10">
          <span className="material-icons-round text-xl">settings</span>
        </button>
      </div>
    </nav>
  );
};
