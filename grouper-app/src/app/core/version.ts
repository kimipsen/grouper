import { InjectionToken } from '@angular/core';
import { BUILD_VERSION } from './version.generated';

/** Version the app was built from, derived from git by scripts/write-version.mjs. */
export const APP_VERSION = new InjectionToken<string>('APP_VERSION', {
  providedIn: 'root',
  factory: () => BUILD_VERSION,
});
