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
    const pipe = new TranslatePipe(i18n as any);

    expect(pipe.transform('app.title')).toBe('en:app.title');
  });

  it('updates when locale changes', () => {
    const i18n = new MockI18nService();
    const pipe = new TranslatePipe(i18n as any);

    expect(pipe.transform('app.title')).toBe('en:app.title');

    i18n.locale = 'es';

    expect(pipe.transform('app.title')).toBe('es:app.title');
  });
});
