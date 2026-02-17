import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatToolbarModule } from '@angular/material/toolbar';
import { I18nService, LocaleCode } from './core/services/i18n.service';
import { TranslatePipe } from './core/pipes/translate.pipe';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: true,
  styleUrl: './app.scss',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterOutlet,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe
  ]
})
export class App {
  readonly themeService = inject(ThemeService);
  readonly i18nService = inject(I18nService);


  get availableLocales(): LocaleCode[] {
    return this.i18nService.getAvailableLocales();
  }

  async onLocaleChange(locale: string): Promise<void> {
    await this.i18nService.setLocale(locale as LocaleCode);
  }
}
