import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { I18nService } from './core/services/i18n.service';
import { TranslatePipe } from './core/pipes/translate.pipe';
import { ToastContainer } from './core/components/toast-container/toast-container';
import { ConfirmModal } from './core/components/confirm-modal/confirm-modal';
import { APP_VERSION } from './core/version';

const REPOSITORY_URL = 'https://github.com/kimipsen/grouper';
const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterOutlet, TranslatePipe, ToastContainer, ConfirmModal]
})
export class App {
  readonly i18nService = inject(I18nService);
  readonly appVersion = inject(APP_VERSION);
  readonly repositoryUrl = REPOSITORY_URL;
  /** Release builds (exact vX.Y.Z tag) link the version to its GitHub release. */
  readonly releaseUrl = RELEASE_TAG.test(this.appVersion) ? `${REPOSITORY_URL}/releases/tag/${this.appVersion}` : null;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  /** Current path without query/fragment; language links stay on the current page. */
  readonly currentPath = signal('/');

  /** DKFDS language switcher: the current language is always listed first. */
  readonly orderedLocales = computed(() => {
    const current = this.i18nService.currentLocale();
    return [current, ...this.i18nService.getAvailableLocales().filter((locale) => locale !== current)];
  });

  constructor() {
    // The language switcher links set ?lang=…, so a language is also selectable by URL.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const tree = this.router.parseUrl(this.router.url);
        tree.queryParams = {};
        tree.fragment = null;
        this.currentPath.set(this.router.serializeUrl(tree));
        this.applyLocaleFromUrl();
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

  private applyLocaleFromUrl(): void {
    const requested = this.router.routerState.snapshot.root.queryParamMap.get('lang');
    const supported = this.i18nService.getAvailableLocales().find((locale) => locale === requested);
    if (supported && supported !== this.i18nService.currentLocale()) {
      void this.i18nService.setLocale(supported);
    }
  }
}
