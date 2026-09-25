"use client";
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [override, setOverride] = useState<boolean | null>(null);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const dark = override ?? systemDark;
  useEffect(() => {
    const resolved = override ?? matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', resolved);
    document.documentElement.style.colorScheme = resolved ? 'dark' : 'light';
  }, [override, systemDark]);
  const label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return <button type="button" aria-label={label} title={label} onClick={() => setOverride(!dark)} className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
    {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
  </button>;
}
