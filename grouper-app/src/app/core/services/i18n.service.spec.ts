import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { I18nService, LocaleCode } from './i18n.service';

describe('I18nService', () => {
  let service: I18nService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [I18nService],
    });

    service = TestBed.inject(I18nService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('loads default locale on init', async () => {
    const initPromise = service.init();

    httpMock.expectOne('assets/i18n/en.json').flush({
      app: { title: 'Grouper' },
    });

    await initPromise;

    expect(service.currentLocale()).toBe('en');
    expect(service.t('app.title')).toBe('Grouper');
  });

  it('falls back to en for unsupported stored locale', async () => {
    localStorage.setItem('grouper.locale', 'fr');

    const initPromise = service.init();

    httpMock.expectOne('assets/i18n/en.json').flush({
      common: { close: 'Close' },
    });

    await initPromise;

    expect(service.currentLocale()).toBe('en');
  });

  it('interpolates template params', async () => {
    const localePromise = service.setLocale('en');

    httpMock.expectOne('assets/i18n/en.json').flush({
      greeting: 'Hello {{name}}',
    });

    await localePromise;

    expect(service.t('greeting', { name: 'Alex' })).toBe('Hello Alex');
  });

  it('persists selected locale', async () => {
    const localePromise = service.setLocale('en');

    httpMock.expectOne('assets/i18n/en.json').flush({
      app: { title: 'Grouper' },
    });

    await localePromise;

    expect(localStorage.getItem('grouper.locale')).toBe('en');
  });

  it('loads da locale and persists selection', async () => {
    const localePromise = service.setLocale('da');

    httpMock.expectOne('assets/i18n/da.json').flush({
      app: { title: 'Grouper' },
    });

    await localePromise;

    expect(service.currentLocale()).toBe('da');
    expect(localStorage.getItem('grouper.locale')).toBe('da');
  });

  it('uses supported stored da locale on init', async () => {
    localStorage.setItem('grouper.locale', 'da');

    const initPromise = service.init();

    httpMock.expectOne('assets/i18n/da.json').flush({
      common: { close: 'Luk' },
    });

    await initPromise;

    expect(service.currentLocale()).toBe('da');
  });

  it('normalizes da-DK locale string to da', async () => {
    const localePromise = service.setLocale('da-DK' as LocaleCode);

    httpMock.expectOne('assets/i18n/da.json').flush({
      common: { close: 'Luk' },
    });

    await localePromise;

    expect(service.currentLocale()).toBe('da');
  });

  it('returns da-DK for current date locale when da is active', async () => {
    const localePromise = service.setLocale('da');

    httpMock.expectOne('assets/i18n/da.json').flush({
      app: { title: 'Grouper' },
    });

    await localePromise;

    expect(service.getCurrentDateLocale()).toBe('da-DK');
  });
});
