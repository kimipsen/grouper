import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService } from './i18n.service';

/**
 * Sets the document title to "<page> – <app>".
 * Static route titles are translation keys; resolved titles (e.g. a session name) are used as-is.
 * The title is re-applied when the locale changes.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private readonly snapshot = signal<RouterStateSnapshot | null>(null);

  constructor() {
    super();
    effect(() => {
      this.i18n.currentLocale();
      const snapshot = this.snapshot();
      if (snapshot) {
        this.applyTitle(snapshot);
      }
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.snapshot.set(snapshot);
    this.applyTitle(snapshot);
  }

  private applyTitle(snapshot: RouterStateSnapshot): void {
    const appTitle = this.i18n.t('app.title');
    const pageTitle = this.buildTitle(snapshot);

    if (!pageTitle) {
      this.title.setTitle(appTitle);
      return;
    }

    const label = this.isTranslationKey(snapshot.root) ? this.i18n.t(pageTitle) : pageTitle;
    this.title.setTitle(`${label} – ${appTitle}`);
  }

  private isTranslationKey(root: ActivatedRouteSnapshot): boolean {
    let route = root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return typeof route.routeConfig?.title === 'string';
  }
}
