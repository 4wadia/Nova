import { useCallback, useRef, type ComponentPropsWithoutRef } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "../ThemeContext";
import { cn } from "@/lib/utils";

interface AnimatedThemeTogglerProps extends ComponentPropsWithoutRef<"button"> {
  duration?: number;
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  ...props
}: AnimatedThemeTogglerProps) => {
  const { isDark, toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleToggle = useCallback(() => {
    const button = buttonRef.current;
    if (!button) {
      toggleTheme();
      return;
    }

    const { top, left, width, height } = button.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const maxRadius = Math.hypot(
      Math.max(x, viewportWidth - x),
      Math.max(y, viewportHeight - y)
    );

    if (typeof document.startViewTransition !== "function") {
      toggleTheme();
      return;
    }

    const transition = document.startViewTransition(() => {
      flushSync(toggleTheme);
    });

    const ready = transition?.ready;
    if (ready && typeof ready.then === "function") {
      ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      });
    }
  }, [toggleTheme, duration]);

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={handleToggle}
      className={cn(
        "relative z-10 p-2.5 rounded-full text-zinc-500 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 focus:outline-none",
        className
      )}
      aria-label="Toggle theme"
      {...props}
    >
      <span className="material-icons-round text-lg">
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
};
