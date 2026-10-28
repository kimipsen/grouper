import { DOCUMENT } from '@angular/common';
import { Injectable, signal, inject } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'solarized-light' | 'solarized-dark';

const THEME_CYCLE: ThemeMode[] = ['light', 'dark', 'solarized-light', 'solarized-dark'];

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject<Document>(DOCUMENT);

  private static readonly STORAGE_KEY = 'grouper.theme';

  private readonly themeSignal = signal<ThemeMode>('light');
  readonly currentTheme = this.themeSignal.asReadonly();

  init(): void {
    const savedTheme = this.readStoredTheme();
    const initialTheme = savedTheme ?? this.getSystemThemePreference();
    this.setTheme(initialTheme, false);
  }

  setTheme(theme: ThemeMode, persist = true): void {
    this.themeSignal.set(theme);
    this.applyTheme(theme);

    if (persist) {
      localStorage.setItem(ThemeService.STORAGE_KEY, theme);
    }
  }

  toggleTheme(): void {
    const currentIndex = THEME_CYCLE.indexOf(this.themeSignal());
    const nextIndex = (currentIndex + 1) % THEME_CYCLE.length;
    this.setTheme(THEME_CYCLE[nextIndex]);
  }

  private applyTheme(theme: ThemeMode): void {
    const root = this.document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-solarized-light', 'theme-solarized-dark');
    root.classList.add(`theme-${theme}`);
    root.style.colorScheme = theme.includes('dark') ? 'dark' : 'light';
  }

  private readStoredTheme(): ThemeMode | null {
    const storedTheme = localStorage.getItem(ThemeService.STORAGE_KEY);
    if ((THEME_CYCLE as string[]).includes(storedTheme ?? '')) {
      return storedTheme as ThemeMode;
    }
    return null;
  }

  private getSystemThemePreference(): ThemeMode {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
