import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

const ALL_THEME_CLASSES = ['theme-light', 'theme-dark', 'theme-solarized-light', 'theme-solarized-dark'];

describe('ThemeService', () => {
  let service: ThemeService;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(...ALL_THEME_CLASSES);

    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    localStorage.clear();
    document.documentElement.classList.remove(...ALL_THEME_CLASSES);
    document.documentElement.style.colorScheme = '';
  });

  it('defaults to system preference when storage is empty', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;

    service.init();

    expect(service.currentTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('persists selected theme', () => {
    service.setTheme('dark');

    expect(localStorage.getItem('grouper.theme')).toBe('dark');
  });

  it('persists solarized-light theme', () => {
    service.setTheme('solarized-light');

    expect(localStorage.getItem('grouper.theme')).toBe('solarized-light');
    expect(document.documentElement.classList.contains('theme-solarized-light')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('persists solarized-dark theme', () => {
    service.setTheme('solarized-dark');

    expect(localStorage.getItem('grouper.theme')).toBe('solarized-dark');
    expect(document.documentElement.classList.contains('theme-solarized-dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('reapplies persisted theme on init', () => {
    localStorage.setItem('grouper.theme', 'light');

    service.init();

    expect(service.currentTheme()).toBe('light');
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
  });

  it('reapplies persisted solarized-light theme on init', () => {
    localStorage.setItem('grouper.theme', 'solarized-light');

    service.init();

    expect(service.currentTheme()).toBe('solarized-light');
    expect(document.documentElement.classList.contains('theme-solarized-light')).toBe(true);
  });

  it('reapplies persisted solarized-dark theme on init', () => {
    localStorage.setItem('grouper.theme', 'solarized-dark');

    service.init();

    expect(service.currentTheme()).toBe('solarized-dark');
    expect(document.documentElement.classList.contains('theme-solarized-dark')).toBe(true);
  });

  it('cycles through all themes when toggled', () => {
    service.setTheme('light', false);
    service.toggleTheme();
    expect(service.currentTheme()).toBe('dark');

    service.toggleTheme();
    expect(service.currentTheme()).toBe('solarized-light');

    service.toggleTheme();
    expect(service.currentTheme()).toBe('solarized-dark');

    service.toggleTheme();
    expect(service.currentTheme()).toBe('light');
  });

  it('only applies one theme class at a time', () => {
    service.setTheme('solarized-dark');

    const themeClasses = ALL_THEME_CLASSES.filter((cls) =>
      document.documentElement.classList.contains(cls)
    );
    expect(themeClasses).toHaveLength(1);
    expect(themeClasses[0]).toBe('theme-solarized-dark');
  });
});
