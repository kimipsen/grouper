import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../services/i18n.service';
import { TranslatePipe } from './translate.pipe';

class MockI18nService {
  private readonly localeSignal = signal('en');
  readonly currentLocale = this.localeSignal.asReadonly();

  t(key: string): string {
    return `${this.localeSignal()}:${key}`;
  }

  setLocale(locale: string): void {
    this.localeSignal.set(locale);
  }
}

describe('TranslatePipe', () => {
  it('resolves a translation key', () => {
    const i18n = new MockI18nService();
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: i18n }],
    });

    const pipe = TestBed.runInInjectionContext(() => new TranslatePipe());

    expect(pipe.transform('app.title')).toBe('en:app.title');
  });

  it('updates when locale changes', () => {
    const i18n = new MockI18nService();
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: i18n }],
    });

    const pipe = TestBed.runInInjectionContext(() => new TranslatePipe());

    expect(pipe.transform('app.title')).toBe('en:app.title');

    i18n.setLocale('es');

    expect(pipe.transform('app.title')).toBe('es:app.title');
  });
});
