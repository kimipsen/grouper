import { TestBed } from '@angular/core/testing';
import { I18nService } from '../services/i18n.service';
import { TranslatePipe } from './translate.pipe';

class MockI18nService {
  locale = 'en';

  t(key: string): string {
    return `${this.locale}:${key}`;
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

    i18n.locale = 'es';

    expect(pipe.transform('app.title')).toBe('es:app.title');
  });
});
