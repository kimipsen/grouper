import { APP_INITIALIZER, provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { TitleStrategy, provideRouter } from '@angular/router';
import * as DKFDS from 'dkfds';
import { App } from './app/app';
import { I18nService } from './app/core/services/i18n.service';
import { AppTitleStrategy } from './app/core/services/app-title.strategy';
import { routes } from './app/app.routes';
import { registerAppLocaleData } from './app/core/register-locale-data';

registerAppLocaleData();

bootstrapApplication(App, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideHttpClient(withXhr()),
    provideRouter(routes),
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
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
