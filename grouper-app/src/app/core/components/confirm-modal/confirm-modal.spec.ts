import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '../../services/i18n.service';
import { ConfirmDialogService, ConfirmOptions } from '../../services/confirm-dialog.service';
import { getAxeViolations } from '../../../../testing/axe';
import { ConfirmModal } from './confirm-modal';

class MockI18nService {
  t(key: string, params?: Record<string, string | number>): string {
    const labels: Record<string, string> = {
      'common.close': 'Close',
      'common.cancel': 'Cancel',
      'delete.title': 'Delete session?',
      'delete.action': 'Delete session',
    };
    if (key === 'delete.message') {
      return `"${params?.['name']}" will be deleted.`;
    }
    return labels[key] ?? key;
  }
}

@Component({
  imports: [ConfirmModal],
  template: `
    <main id="main-content" tabindex="-1">
      @if (showOpener) {
        <button id="opener" type="button">Delete</button>
      }
    </main>
    <app-confirm-modal />
  `,
})
class Host {
  showOpener = true;
}

const options: ConfirmOptions = {
  titleKey: 'delete.title',
  messageKey: 'delete.message',
  confirmKey: 'delete.action',
  params: { name: 'Demo' },
};

describe('ConfirmModal', () => {
  let fixture: ComponentFixture<Host>;
  let dialog: ConfirmDialogService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    dialog = TestBed.inject(ConfirmDialogService);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
    document.getElementById('modal-backdrop')?.remove();
  });

  const modal = () => document.getElementById('confirm-modal') as HTMLElement;

  // Wrapped in an object: an async function returning a promise would wait for the dialog to settle.
  async function open(): Promise<{ result: Promise<boolean> }> {
    document.getElementById('opener')?.focus();
    const result = dialog.confirm(options);
    await fixture.whenStable();
    return { result };
  }

  async function click(selector: string): Promise<void> {
    modal().querySelector<HTMLButtonElement>(selector)?.click();
    await fixture.whenStable();
  }

  it('moves the DKFDS modal container to be a direct child of body', () => {
    const container = modal().parentElement;

    expect(container?.classList).toContain('fds-modal-container');
    expect(container?.parentElement).toBe(document.body);
    expect(modal().getAttribute('aria-hidden')).toBe('true');
  });

  it('opens with the translated title, message and actions, and passes axe', async () => {
    await open();

    expect(modal().getAttribute('aria-hidden')).toBe('false');
    expect(modal().getAttribute('role')).toBe('dialog');
    expect(modal().querySelector('#confirm-modal-title')?.textContent?.trim()).toBe('Delete session?');
    expect(modal().querySelector('.modal-body')?.textContent?.trim()).toBe('"Demo" will be deleted.');
    const footerButtons = Array.from(modal().querySelectorAll<HTMLButtonElement>('.modal-footer button'));
    expect(footerButtons.map((button) => [button.textContent?.trim(), button.className])).toEqual([
      ['Delete session', 'button button-warning'],
      ['Cancel', 'button button-secondary'],
    ]);
    expect(document.activeElement).toBe(modal().querySelector('.modal-close'));
    expect(fixture.nativeElement.hasAttribute('inert')).toBe(true);
    expect(await getAxeViolations(modal())).toEqual([]);
  });

  it('resolves true on confirm, closes and returns focus to the opener', async () => {
    const { result } = await open();

    await click('.button-warning');

    await expect(result).resolves.toBe(true);
    expect(modal().getAttribute('aria-hidden')).toBe('true');
    expect(fixture.nativeElement.hasAttribute('inert')).toBe(false);
    expect(document.activeElement?.id).toBe('opener');
  });

  it.each([
    ['the cancel button', '.button-secondary'],
    ['the close button', '.modal-close'],
  ])('resolves false when closed with %s', async (_label, selector) => {
    const { result } = await open();

    await click(selector);

    await expect(result).resolves.toBe(false);
    expect(modal().getAttribute('aria-hidden')).toBe('true');
    expect(fixture.nativeElement.hasAttribute('inert')).toBe(false);
    expect(document.activeElement?.id).toBe('opener');
  });

  it('resolves false when DKFDS closes it with Escape', async () => {
    const { result } = await open();

    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }));
    await fixture.whenStable();

    await expect(result).resolves.toBe(false);
    expect(dialog.request()).toBeNull();
    expect(fixture.nativeElement.hasAttribute('inert')).toBe(false);
    expect(document.activeElement?.id).toBe('opener');
  });

  it('moves focus to main when the opener no longer exists after confirming', async () => {
    const { result } = await open();
    fixture.componentInstance.showOpener = false;
    fixture.changeDetectorRef.markForCheck();

    await click('.button-warning');

    await expect(result).resolves.toBe(true);
    expect(document.activeElement?.id).toBe('main-content');
  });

  it('removes the container from body when destroyed', () => {
    fixture.destroy();

    expect(document.getElementById('confirm-modal')).toBeNull();
  });
});
