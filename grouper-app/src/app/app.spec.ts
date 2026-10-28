import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { App } from './app';
import { I18nService } from './core/services/i18n.service';

class MockI18nService {
  private readonly localeSignal = signal<'en' | 'da'>('en');
  readonly currentLocale = this.localeSignal.asReadonly();

  t(key: string): string {
    const labels: Record<string, string> = {
      'app.title': 'Grouper',
      'app.sessionsNav': 'Sessions',
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
        { provide: I18nService, useClass: MockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render localized app title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-title')?.textContent).toContain('Grouper');
  });

  it('should not render a theme toggle in the header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.app-header button')).toHaveLength(0);
  });

  it('should list both supported locales in selector', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const options = Array.from(fixture.nativeElement.querySelectorAll('select option')) as HTMLOptionElement[];
    const values = options.map((option) => option.value);

    expect(values).toEqual(['en', 'da']);
  });
});
