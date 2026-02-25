import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { App } from './app';
import { I18nService } from './core/services/i18n.service';
import { ThemeMode, ThemeService } from './core/services/theme.service';

class MockThemeService {
  currentTheme = () => 'light' as ThemeMode;
  toggleTheme(): void {
    return;
  }
}

class MockI18nService {
  currentLocale = () => 'en' as const;

  t(key: string): string {
    const labels: Record<string, string> = {
      'app.title': 'Grouper',
      'app.sessionsNav': 'Sessions',
      'app.themeToggleAria': 'Toggle dark mode',
      'app.themeToggle.light': 'Light',
      'app.themeToggle.dark': 'Dark',
      'app.languageLabel': 'Language',
      'app.languages.en': 'English',
      'app.languages.da': 'Danish',
    };
    return labels[key] ?? key;
  }

  getAvailableLocales(): ('en' | 'da')[] {
    return ['en', 'da'];
  }

  getLocaleDisplayName(locale: 'en' | 'da'): string {
    return locale === 'en' ? 'English' : 'Danish';
  }

  setLocale(): Promise<void> {
    return Promise.resolve();
  }
}

describe('App accessibility', () => {
  it('has accessible toolbar actions and landmarks', async () => {
    await TestBed.configureTestingModule({
      imports: [App, RouterTestingModule],
      providers: [
        { provide: ThemeService, useClass: MockThemeService },
        { provide: I18nService, useClass: MockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const h1OrTitle = root.querySelector('mat-toolbar span');
    expect(h1OrTitle?.textContent?.trim()).toBe('Grouper');

    const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];
    const hasUnnamedButton = buttons.some((button) => {
      const aria = button.getAttribute('aria-label')?.trim();
      const text = button.textContent?.trim();
      return !aria && !text;
    });
    expect(hasUnnamedButton).toBe(false);

    const languageSelect = root.querySelector('select');
    expect(languageSelect).toBeTruthy();
    expect(root.textContent).toContain('Language');
  });
});
