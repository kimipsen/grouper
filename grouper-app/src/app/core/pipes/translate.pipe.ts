import { ChangeDetectorRef, Injector, Pipe, PipeTransform, effect, inject } from '@angular/core';
import { I18nService } from '../services/i18n.service';

@Pipe({
  name: 't',
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef, { optional: true });
  private readonly injector = inject(Injector);

  constructor() {
    const currentLocale = (this.i18n as I18nService & { currentLocale?: () => unknown }).currentLocale;
    if (!currentLocale) {
      return;
    }

    effect(() => {
      currentLocale();
      this.cdr?.markForCheck();
    }, { injector: this.injector });
  }

  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
