import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { App } from './app';
import { I18nService } from './core/services/i18n.service';
import { getAxeViolations } from '../testing/axe';

class MockI18nService {
  currentLocale = () => 'en' as const;

  t(key: string): string {
    const labels: Record<string, string> = {
      'app.title': 'Grouper',
      'app.sessionsNav': 'Sessions',
      'app.languageLabel': 'Language',
      'app.skipToContent': 'Skip to main content',
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
        { provide: I18nService, useClass: MockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const h1OrTitle = root.querySelector('.app-title');
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

  it('has a skip link that moves focus to the main landmark without navigating', async () => {
    await TestBed.configureTestingModule({
      imports: [App, RouterTestingModule],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);

    const root = fixture.nativeElement as HTMLElement;
    const skipLink = root.querySelector<HTMLAnchorElement>('a.skipnav');
    const main = root.querySelector<HTMLElement>('main#main-content');

    expect(skipLink?.textContent?.trim()).toBe('Skip to main content');
    expect(skipLink?.getAttribute('href')).toBe('#main-content');
    expect(root.firstElementChild).toBe(skipLink);
    expect(main?.getAttribute('tabindex')).toBe('-1');

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    skipLink?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(main);
    fixture.nativeElement.remove();
  });

  it('has no axe violations in the app shell', async () => {
    await TestBed.configureTestingModule({
      imports: [App, RouterTestingModule],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(await getAxeViolations(fixture.nativeElement)).toEqual([]);
  });
});
