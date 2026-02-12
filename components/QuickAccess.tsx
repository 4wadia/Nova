import React from 'react';
import { QuickAccessItem } from '../types';

const quickAccessItems: QuickAccessItem[] = [
  {
    id: 'movies',
    label: 'Movies',
    icon: 'movie',
    colorClass: 'group-hover:bg-primary',
    iconColorClass: 'text-primary group-hover:text-white',
    isActive: true,
  },
  {
    id: 'downloads',
    label: 'Downloads',
    icon: 'download',
    colorClass: 'group-hover:bg-green-500',
    iconColorClass: 'text-green-400 group-hover:text-white',
  },
  {
    id: 'camera',
    label: 'Camera Roll',
    icon: 'photo_library',
    colorClass: 'group-hover:bg-purple-500',
    iconColorClass: 'text-purple-400 group-hover:text-white',
  },
  {
    id: 'external',
    label: 'External_SSD',
    icon: 'usb',
    colorClass: 'group-hover:bg-orange-500',
    iconColorClass: 'text-orange-400 group-hover:text-white',
  },
];

export const QuickAccess: React.FC = () => {
  return (
    <div className="w-full flex flex-col items-center space-y-5">
      <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-semibold select-none">
        Quick Access
      </span>
      <div className="flex flex-wrap justify-center gap-3 px-4">
        {quickAccessItems.map((item) => (
          <button
            key={item.id}
            className={`
              group relative flex items-center space-x-3 
              bg-surface-dark hover:bg-surface-dark/80 
              border border-white/5 hover:border-primary/30 
              px-5 py-3 rounded-full 
              transition-all duration-300 
              hover:shadow-lg hover:shadow-primary/5
              ${item.id === 'external' ? 'opacity-60 hover:opacity-100' : ''}
            `}
            onClick={() => console.log(`Clicked ${item.label}`)}
          >
            <div className={`
              w-8 h-8 rounded-full bg-white/5 flex items-center justify-center 
              transition-colors duration-300
              ${item.colorClass}
            `}>
              <span className={`material-icons-round text-lg transition-colors duration-300 ${item.iconColorClass}`}>
                {item.icon}
              </span>
            </div>
            <span className="text-sm font-medium text-gray-300 group-hover:text-white">
              {item.label}
            </span>
            {item.isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors"></span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};