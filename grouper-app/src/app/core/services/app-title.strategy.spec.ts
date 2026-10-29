import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AppTitleStrategy } from './app-title.strategy';
import { I18nService, LocaleCode } from './i18n.service';

@Component({ template: '' })
class BlankPage {}

const translations: Record<LocaleCode, Record<string, string>> = {
  en: { 'app.title': 'Grouper', 'sessionList.title': 'Sessions' },
  da: { 'app.title': 'Grouper', 'sessionList.title': 'Sessioner' },
};

class MockI18nService {
  readonly currentLocale = signal<LocaleCode>('en');

  t(key: string): string {
    return translations[this.currentLocale()][key] ?? key;
  }
}

describe('AppTitleStrategy', () => {
  let i18n: MockI18nService;
  let title: Title;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useClass: MockI18nService },
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
        provideRouter([
          { path: 'sessions', title: 'sessionList.title', component: BlankPage },
          { path: 'session/:id', title: () => 'sessionList.title', component: BlankPage },
          { path: 'untitled', component: BlankPage },
        ]),
      ],
    });
    i18n = TestBed.inject(I18nService) as unknown as MockI18nService;
    title = TestBed.inject(Title);
  });

  it.each([
    { scenario: 'translates static route titles and appends the app title', url: '/sessions', expected: 'Sessions – Grouper' },
    { scenario: 'uses resolved titles as-is without translating them', url: '/session/s1', expected: 'sessionList.title – Grouper' },
    { scenario: 'falls back to the app title when the route has no title', url: '/untitled', expected: 'Grouper' },
  ])('$scenario', async ({ url, expected }) => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);

    expect(title.getTitle()).toBe(expected);
  });

  it('re-translates the current title when the locale changes', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/sessions');

    i18n.currentLocale.set('da');
    TestBed.tick();

    expect(title.getTitle()).toBe('Sessioner – Grouper');
  });
});
