import { DOCUMENT } from '@angular/common';
import { Injectable, signal, inject } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

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
    const nextTheme: ThemeMode = this.themeSignal() === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  private applyTheme(theme: ThemeMode): void {
    const root = this.document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${theme}`);
    root.style.colorScheme = theme;
  }

  private readStoredTheme(): ThemeMode | null {
    const storedTheme = localStorage.getItem(ThemeService.STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
    return null;
  }

  private getSystemThemePreference(): ThemeMode {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
