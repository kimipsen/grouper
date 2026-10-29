import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, effect, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { I18nService, LocaleCode } from './core/services/i18n.service';
import { TranslatePipe } from './core/pipes/translate.pipe';
import { ToastContainer } from './core/components/toast-container/toast-container';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterOutlet, TranslatePipe, ToastContainer]
})
export class App {
  readonly i18nService = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly localeControl = new FormControl<LocaleCode>('en', { nonNullable: true });
  readonly availableLocales = this.i18nService.getAvailableLocales();
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

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

  // Handled in code because a plain "#main-content" href resolves against <base href> and would navigate.
  skipToMain(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  onRouteActivate(): void {
    queueMicrotask(() => this.cdr.detectChanges());
  }
}
