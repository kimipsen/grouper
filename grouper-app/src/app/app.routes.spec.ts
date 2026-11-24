import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { SessionService } from './core/services/session.service';

// Components are stubbed: only routing (paths, redirects, titles) is exercised.
// SessionDetail itself is not rendered here.
@Component({ template: '' })
class BlankPage {}

// Keep path, redirectTo, pathMatch and title; replace the lazy loadComponent with a stub.
const stubbedRoutes: Route[] = routes.map((route) => {
  const { loadComponent, ...rest } = route;
  return loadComponent ? { ...rest, component: BlankPage } : rest;
});

describe('app routes', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(stubbedRoutes),
        { provide: SessionService, useValue: { sessions: () => [{ id: 's1', name: 'Session one' }] } },
      ],
    });
    router = TestBed.inject(Router);
  });

  it.each([
    ['/', '/sessions'],
    ['/sessions', '/sessions'],
    ['/session/s1', '/session/s1'],
  ])('navigates %s to %s', async (from, expected) => {
    await router.navigateByUrl(from);

    expect(router.url).toBe(expected);
  });

  it.each(['/unknown', '/a/deep/unknown/path', '/sessions/extra', '/session'])(
    'redirects unmatched url %s to /sessions',
    async (url) => {
      await router.navigateByUrl(url);

      expect(router.url).toBe('/sessions');
    },
  );
});
