import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../services/i18n.service';
import { NotificationService } from '../../services/notification.service';
import { getAxeViolations } from '../../../../testing/axe';
import { ToastContainer } from './toast-container';

class MockI18nService {
  t(key: string, params?: Record<string, string | number>): string {
    const labels: Record<string, string> = {
      'common.close': 'Close',
      'notifications.success': 'Success:',
      'notifications.error': 'Error:',
      saved: 'Session saved',
    };
    if (key === 'imported') {
      return `Imported ${params?.['count']} people`;
    }
    return labels[key] ?? key;
  }
}

describe('ToastContainer', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [ToastContainer],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ToastContainer);
    const notifications = TestBed.inject(NotificationService);
    fixture.detectChanges();
    return { fixture, notifications, root: fixture.nativeElement as HTMLElement };
  }

  it('renders an assertive DKFDS live region even when empty', async () => {
    const { root } = await setup();
    const container = root.querySelector('.toast-container');

    expect(container?.getAttribute('aria-live')).toBe('assertive');
    expect(container?.getAttribute('aria-atomic')).toBe('false');
    expect(container?.getAttribute('aria-relevant')).toBe('additions');
    expect(root.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('renders toasts with DKFDS markup, a screen reader prefix and translated params', async () => {
    const { fixture, notifications, root } = await setup();

    notifications.success('saved');
    notifications.show('error', 'imported', { count: 3 });
    fixture.detectChanges();

    const toasts = Array.from(root.querySelectorAll<HTMLElement>('.toast'));
    expect(toasts.map((toast) => [...toast.classList].sort())).toEqual([
      ['show', 'toast', 'toast-error'],
      ['show', 'toast', 'toast-success'],
    ]);

    const heading = toasts[0].querySelector('strong');
    expect(toasts[0].querySelector('.sr-only')?.textContent?.trim()).toBe('Error:');
    expect(heading?.textContent?.trim()).toBe('Imported 3 people');
    expect(toasts[0].querySelector('.toast-close')?.getAttribute('aria-describedby')).toBe(heading?.id);
    expect(await getAxeViolations(root)).toEqual([]);
  });

  it('dismisses a toast with its close button', async () => {
    const { fixture, notifications, root } = await setup();
    notifications.success('saved');
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('.toast-close')?.click();
    fixture.detectChanges();

    expect(notifications.toasts()).toEqual([]);
    expect(root.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('pauses auto-dismiss while hovered or focused and resumes afterwards', async () => {
    const { fixture, notifications, root } = await setup();
    const pause = vi.spyOn(notifications, 'pause');
    const resume = vi.spyOn(notifications, 'resume');
    notifications.success('saved');
    fixture.detectChanges();
    const toast = root.querySelector('.toast') as HTMLElement;
    const id = notifications.toasts()[0].id;

    toast.dispatchEvent(new Event('mouseenter'));
    toast.dispatchEvent(new Event('mouseleave'));
    toast.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    toast.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

    expect(pause.mock.calls).toEqual([[id], [id]]);
    expect(resume.mock.calls).toEqual([[id], [id]]);
  });
});
