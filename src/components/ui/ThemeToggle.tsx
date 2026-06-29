'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-16 h-8 bg-white/70 dark:bg-stone-900/70 backdrop-blur-md rounded-full border border-stone-250/20 animate-pulse" />
    );
  }

  // Next-themes might have "system" as default, resolve actual value
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="flex items-center p-1 bg-white/85 dark:bg-[#12100f]/85 backdrop-blur-xl border border-stone-200/50 dark:border-stone-850/80 rounded-full shadow-lg relative shrink-0">
      {/* Sliding Active Indicator Pill */}
      <motion.div
        className="absolute top-1 bottom-1 w-[26px] bg-gradient-to-tr from-[#8c6d58] to-[#bfa08a] rounded-full shadow-[0_2px_8px_rgba(140,109,88,0.35)] z-0"
        animate={{
          left: isDark ? '33px' : '4px'
        }}
        transition={{ type: "spring", stiffness: 380, damping: 25 }}
      />
      
      <button
        onClick={() => setTheme('light')}
        className={`relative z-10 w-[26px] h-[26px] flex items-center justify-center rounded-full transition-colors duration-300 ${
          !isDark ? 'text-white' : 'text-stone-400 hover:text-stone-200'
        }`}
        title="Modo Claro"
      >
        <Sun size={13} className="stroke-[2.5]" />
      </button>

      <button
        onClick={() => setTheme('dark')}
        className={`relative z-10 w-[26px] h-[26px] flex items-center justify-center rounded-full transition-colors duration-300 ${
          isDark ? 'text-white' : 'text-stone-500 hover:text-stone-700'
        }`}
        title="Modo Oscuro"
      >
        <Moon size={13} className="stroke-[2.5]" />
      </button>
    </div>
  );
}
