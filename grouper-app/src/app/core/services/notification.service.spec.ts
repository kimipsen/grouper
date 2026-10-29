import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the newest toast first and keeps at most three', () => {
    service.success('one');
    service.success('two');
    service.info('three');
    service.show('error', 'four', { count: 4 });

    expect(service.toasts().map((toast) => toast.key)).toEqual(['four', 'three', 'two']);
    expect(service.toasts()[0]).toEqual(expect.objectContaining({ variant: 'error', params: { count: 4 } }));
  });

  it('replaces an identical visible message instead of stacking it, restarting its timer', () => {
    service.success('personAdded');
    service.success('other');
    vi.advanceTimersByTime(NotificationService.AUTO_DISMISS_MS - 1);

    service.success('personAdded');
    vi.advanceTimersByTime(1);

    expect(service.toasts().map((toast) => toast.key)).toEqual(['personAdded']);
  });

  it('keeps messages that differ in variant or params as separate toasts', () => {
    service.success('imported', { count: 1 });
    service.success('imported', { count: 2 });
    service.show('error', 'imported', { count: 2 });

    expect(service.toasts()).toHaveLength(3);
  });

  it.each(['success', 'info'] as const)('auto-dismisses %s toasts after 10 seconds', (variant) => {
    service.show(variant, 'saved');

    vi.advanceTimersByTime(NotificationService.AUTO_DISMISS_MS - 1);
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts()).toEqual([]);
  });

  it.each(['warning', 'error'] as const)('keeps %s toasts until they are dismissed', (variant) => {
    service.show(variant, 'problem');
    vi.advanceTimersByTime(NotificationService.AUTO_DISMISS_MS * 10);

    expect(service.toasts()).toHaveLength(1);

    service.dismiss(service.toasts()[0].id);
    expect(service.toasts()).toEqual([]);
  });

  it('pauses auto-dismiss and restarts the full delay on resume', () => {
    service.success('saved');
    const id = service.toasts()[0].id;

    vi.advanceTimersByTime(NotificationService.AUTO_DISMISS_MS - 1);
    service.pause(id);
    vi.advanceTimersByTime(NotificationService.AUTO_DISMISS_MS * 2);
    expect(service.toasts()).toHaveLength(1);

    service.resume(id);
    vi.advanceTimersByTime(NotificationService.AUTO_DISMISS_MS - 1);
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts()).toEqual([]);
  });

  it('times each toast independently of the others', () => {
    service.success('one');
    service.success('two');
    service.success('three');
    vi.advanceTimersByTime(NotificationService.AUTO_DISMISS_MS / 2);
    service.success('four');

    vi.advanceTimersByTime(NotificationService.AUTO_DISMISS_MS / 2);
    expect(service.toasts().map((toast) => toast.key)).toEqual(['four']);
  });

  it('ignores resume for a toast that no longer exists', () => {
    service.resume(999);

    expect(service.toasts()).toEqual([]);
  });
});
