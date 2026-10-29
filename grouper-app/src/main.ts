import { APP_INITIALIZER, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import * as DKFDS from 'dkfds';
import { App } from './app/app';
import { I18nService } from './app/core/services/i18n.service';
import { routes } from './app/app.routes';
import { registerAppLocaleData } from './app/core/register-locale-data';

registerAppLocaleData();

bootstrapApplication(App, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideHttpClient(withXhr()),
    provideRouter(routes),
    importProvidersFrom(MatSnackBarModule),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [I18nService],
      useFactory: (i18nService: I18nService) => () => i18nService.init(),
    },
  ],
})
  .then(() => {
    DKFDS.init();
  })
  .catch((error: unknown) => {
    console.error(error);
  });
