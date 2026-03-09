import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { I18nService, LocaleCode } from './core/services/i18n.service';
import { TranslatePipe } from './core/pipes/translate.pipe';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterOutlet, TranslatePipe]
})
export class App {
  readonly themeService = inject(ThemeService);
  readonly i18nService = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly localeControl = new FormControl<LocaleCode>('en', { nonNullable: true });
  readonly availableLocales = this.i18nService.getAvailableLocales();

  constructor() {
    this.localeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((locale) => {
      void this.i18nService.setLocale(locale);
    });

    effect(() => {
      const currentLocale = this.i18nService.currentLocale();
      if (this.localeControl.value !== currentLocale) {
        this.localeControl.setValue(currentLocale, { emitEvent: false });
      }
    });
  }

  onRouteActivate(): void {
    queueMicrotask(() => this.cdr.detectChanges());
  }
}
