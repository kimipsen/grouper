import { HttpClient } from '@angular/common/http';
import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type LocaleCode = 'en';

export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private readonly http = inject(HttpClient);

  private static readonly STORAGE_KEY = 'grouper.locale';

  private readonly supportedLocales: LocaleCode[] = ['en'];
  private readonly dateLocaleMap: Record<LocaleCode, string> = {
    en: 'en-US',
  };

  private readonly localeSignal = signal<LocaleCode>('en');
  private translations: TranslationDictionary = {};

  readonly currentLocale = this.localeSignal.asReadonly();

  async init(): Promise<void> {
    const savedLocale = this.readStoredLocale();
    const browserLocale = this.normalizeLocale(window.navigator.language);
    const initialLocale = savedLocale ?? browserLocale;

    await this.setLocale(initialLocale, false);
  }

  getAvailableLocales(): LocaleCode[] {
    return [...this.supportedLocales];
  }

  getLocaleDisplayName(locale: LocaleCode): string {
    const key = `app.languages.${locale}`;
    const translated = this.t(key);
    return translated === key ? locale.toUpperCase() : translated;
  }

  getCurrentDateLocale(): string {
    return this.dateLocaleMap[this.localeSignal()];
  }

  async setLocale(locale: LocaleCode, persist = true): Promise<void> {
    const normalizedLocale = this.normalizeLocale(locale);
    const dictionary = await this.loadTranslations(normalizedLocale);

    this.translations = dictionary;
    this.localeSignal.set(normalizedLocale);

    if (persist) {
      localStorage.setItem(I18nService.STORAGE_KEY, normalizedLocale);
    }
  }

  t(key: string, params?: Record<string, string | number>): string {
    const template = this.resolveKey(key);

    if (!template) {
      return key;
    }

    if (!params) {
      return template;
    }

    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, paramName: string) => {
      const value = params[paramName];
      return value !== undefined ? String(value) : '';
    });
  }

  private async loadTranslations(locale: LocaleCode): Promise<TranslationDictionary> {
    return firstValueFrom(this.http.get<TranslationDictionary>(`assets/i18n/${locale}.json`));
  }

  private readStoredLocale(): LocaleCode | null {
    const locale = localStorage.getItem(I18nService.STORAGE_KEY);
    if (locale && this.isSupportedLocale(locale)) {
      return locale;
    }
    return null;
  }

  private normalizeLocale(locale: string): LocaleCode {
    const normalized = locale.toLowerCase().split('-')[0];
    if (this.isSupportedLocale(normalized)) {
      return normalized;
    }
    return 'en';
  }

  private isSupportedLocale(locale: string): locale is LocaleCode {
    return this.supportedLocales.includes(locale as LocaleCode);
  }

  private resolveKey(key: string): string | null {
    const segments = key.split('.');
    let node: string | TranslationDictionary | undefined = this.translations;

    for (const segment of segments) {
      if (!node || typeof node === 'string') {
        return null;
      }
      node = node[segment];
    }

    return typeof node === 'string' ? node : null;
  }
}
