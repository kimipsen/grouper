import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('theme-light', 'theme-dark');

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
    document.documentElement.classList.remove('theme-light', 'theme-dark');
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

  it('reapplies persisted theme on init', () => {
    localStorage.setItem('grouper.theme', 'light');

    service.init();

    expect(service.currentTheme()).toBe('light');
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
  });
});
