import { registerLocaleData } from '@angular/common';
import localeDa from '@angular/common/locales/da';

/**
 * Registers Angular locale data for every supported non-default locale.
 * `en-US` ships with Angular; Danish (`da`, used for `da-DK`) must be registered
 * explicitly or locale-aware pipes like `date` throw at render time.
 */
export function registerAppLocaleData(): void {
  registerLocaleData(localeDa);
}
