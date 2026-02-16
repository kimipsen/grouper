import { Component } from '@angular/core';
import { I18nService, LocaleCode } from './core/services/i18n.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss'
})
export class App {
  constructor(
    readonly themeService: ThemeService,
    readonly i18nService: I18nService
  ) {}

  get availableLocales(): LocaleCode[] {
    return this.i18nService.getAvailableLocales();
  }

  async onLocaleChange(locale: string): Promise<void> {
    await this.i18nService.setLocale(locale as LocaleCode);
  }
}
