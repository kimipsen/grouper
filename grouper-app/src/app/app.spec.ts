import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { I18nService, LocaleCode } from './core/services/i18n.service';
import { APP_VERSION } from './core/version';

@Component({ template: '' })
class BlankPage {}

class MockI18nService {
  private readonly localeSignal = signal<LocaleCode>('en');
  readonly currentLocale = this.localeSignal.asReadonly();
  readonly setLocale = vi.fn((locale: LocaleCode) => {
    this.localeSignal.set(locale);
    return Promise.resolve();
  });

  t(key: string, params?: Record<string, string | number>): string {
    if (key === 'app.version') {
      return `Version ${params?.['version']}`;
    }
    const labels: Record<string, string> = {
      'app.title': 'Grouper',
      'app.homeLinkLabel': 'Grouper, front page',
      'app.languageLabel': 'Choose language',
    };
    return labels[key] ?? key;
  }

  getAvailableLocales(): LocaleCode[] {
    return ['en', 'da'];
  }

  // DKFDS: language names are written in their own language.
  getLocaleDisplayName(locale: LocaleCode): string {
    return locale === 'en' ? 'English' : 'Dansk';
  }
}

describe('App', () => {
  let i18n: MockI18nService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: I18nService, useClass: MockI18nService },
        { provide: APP_VERSION, useValue: 'v1.2.3-4-gabc1234' },
        provideRouter([
          { path: 'sessions', component: BlankPage },
          { path: 'session/:id', component: BlankPage },
        ]),
      ],
    }).compileComponents();
    i18n = TestBed.inject(I18nService) as unknown as MockI18nService;
  });

  async function render(url: string) {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  const languageLinks = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLAnchorElement>('footer .language-switcher li a'));

  it('renders a DKFDS header whose solution title links to the sessions page', async () => {
    const { root } = await render('/sessions');
    const homeLink = root.querySelector('header.header .solution-info .solution-heading a');

    expect(homeLink?.textContent?.trim()).toBe('Grouper');
    expect(homeLink?.getAttribute('href')).toBe('/sessions');
    expect(root.querySelectorAll('header button')).toHaveLength(0);
  });

  it('lists languages in their own language, current first and marked as current', async () => {
    const { root } = await render('/sessions');
    const links = languageLinks(root);

    expect(links.map((link) => [link.textContent?.trim(), link.getAttribute('lang'), link.getAttribute('aria-current')])).toEqual([
      ['English', 'en', 'true'],
      ['Dansk', 'da', null],
    ]);
    expect(links[0].querySelector('svg use')?.getAttribute('href')).toContain('#check');
    expect(links[1].querySelector('svg')).toBeNull();
  });

  it('keeps the current page in the language links', async () => {
    const { root } = await render('/session/s1');

    expect(languageLinks(root).map((link) => link.getAttribute('href'))).toEqual([
      '/session/s1?lang=en',
      '/session/s1?lang=da',
    ]);
  });

  it('switches language from the ?lang= query parameter and reorders the list', async () => {
    const { fixture, root } = await render('/sessions?lang=da');

    expect(i18n.setLocale).toHaveBeenCalledWith('da');
    await fixture.whenStable();
    expect(languageLinks(root).map((link) => link.textContent?.trim())).toEqual(['Dansk', 'English']);
  });

  it.each(['/sessions?lang=fr', '/sessions?lang=en', '/sessions'])('does not change language for %s', async (url) => {
    await render(url);

    expect(i18n.setLocale).not.toHaveBeenCalled();
  });

  it('shows the build version in the DKFDS footer', async () => {
    const { root } = await render('/sessions');

    expect(root.querySelector('footer .footer .app-version')?.textContent?.trim()).toBe('Version v1.2.3-4-gabc1234');
  });
});
