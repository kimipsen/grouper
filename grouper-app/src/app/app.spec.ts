import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { App } from './app';
import { I18nService } from './core/services/i18n.service';
import { ThemeMode, ThemeService } from './core/services/theme.service';

class MockThemeService {
  private readonly themeSignal = signal<ThemeMode>('light');
  readonly currentTheme = this.themeSignal.asReadonly();

  toggleTheme(): void {
    this.themeSignal.set(this.themeSignal() === 'dark' ? 'light' : 'dark');
  }
}

class MockI18nService {
  private readonly localeSignal = signal<'en' | 'da'>('en');
  readonly currentLocale = this.localeSignal.asReadonly();

  t(key: string): string {
    const labels: Record<string, string> = {
      'app.title': 'Grouper',
      'app.sessionsNav': 'Sessions',
      'app.themeToggleAria': 'Toggle dark mode',
      'app.themeToggle.light': 'Light',
      'app.themeToggle.dark': 'Dark',
      'app.languageLabel': 'Language',
    };
    return labels[key] ?? key;
  }

  getAvailableLocales(): ('en' | 'da')[] {
    return ['en', 'da'];
  }

  getLocaleDisplayName(locale: string): string {
    if (locale === 'en') {
      return 'English';
    }
    if (locale === 'da') {
      return 'Danish';
    }
    return locale;
  }

  setLocale(locale: 'en' | 'da'): Promise<void> {
    this.localeSignal.set(locale);
    return Promise.resolve();
  }
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, RouterTestingModule],
      providers: [
        { provide: ThemeService, useClass: MockThemeService },
        { provide: I18nService, useClass: MockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render localized toolbar title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('mat-toolbar span')?.textContent).toContain('Grouper');
  });

  it('should toggle theme from toolbar action', () => {
    const fixture = TestBed.createComponent(App);
    const themeService = TestBed.inject(ThemeService) as unknown as MockThemeService;

    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[1].click();

    expect(themeService.currentTheme()).toBe('dark');
  });

  it('should list both supported locales in selector', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const options = Array.from(fixture.nativeElement.querySelectorAll('select option')) as HTMLOptionElement[];
    const values = options.map((option) => option.value);

    expect(values).toEqual(['en', 'da']);
  });
});
