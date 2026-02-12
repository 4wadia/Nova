import React, { useRef, useState, useEffect } from 'react';
import { flushSync } from 'react-dom';

// Extend the Document interface to support the View Transitions API
declare global {
  interface Document {
    startViewTransition?: (callback: () => Promise<void> | void) => {
      ready: Promise<void>;
      finished: Promise<void>;
      updateCallbackDone: Promise<void>;
    };
  }
}

export const ThemeToggler: React.FC = () => {
  const [isDark, setIsDark] = useState(true);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Sync initial state with the document class
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = async () => {
    // Fallback for browsers without View Transition API
    if (!document.startViewTransition) {
      const isDarkNow = document.documentElement.classList.toggle('dark');
      setIsDark(isDarkNow);
      return;
    }

    if (!buttonRef.current) return;

    // We know startViewTransition exists here due to the check above
    await document.startViewTransition(() => {
      flushSync(() => {
        const isDarkNow = document.documentElement.classList.toggle('dark');
        setIsDark(isDarkNow);
      });
    }).ready;

    const { top, left, width, height } = buttonRef.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    
    // Calculate distance to the furthest corner to ensure full coverage
    const right = window.innerWidth - left;
    const bottom = window.innerHeight - top;
    const maxRadius = Math.hypot(
      Math.max(left, right),
      Math.max(top, bottom)
    );

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 500,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    );
  };

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      className="relative z-10 p-2.5 rounded-full text-zinc-500 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 focus:outline-none"
      aria-label="Toggle theme"
    >
      <span className="material-icons-round text-lg">
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  );
};