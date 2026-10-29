import { TestBed } from '@angular/core/testing';
import { ConfirmDialogService, ConfirmOptions } from './confirm-dialog.service';

const options: ConfirmOptions = { titleKey: 'title', messageKey: 'message', confirmKey: 'confirm', params: { name: 'A' } };

describe('ConfirmDialogService', () => {
  let service: ConfirmDialogService;

  beforeEach(() => {
    service = TestBed.inject(ConfirmDialogService);
  });

  it('exposes the open request with its options', () => {
    void service.confirm(options);

    expect(service.request()).toEqual(expect.objectContaining(options));
  });

  it.each([true, false])('resolves with %s and clears the request when settled', async (confirmed) => {
    const result = service.confirm(options);

    service.settle(confirmed);

    await expect(result).resolves.toBe(confirmed);
    expect(service.request()).toBeNull();
  });

  it('cancels a pending request when a new one is opened', async () => {
    const first = service.confirm(options);
    const second = service.confirm({ ...options, titleKey: 'second' });

    await expect(first).resolves.toBe(false);
    expect(service.request()?.titleKey).toBe('second');

    service.settle(true);
    await expect(second).resolves.toBe(true);
  });

  it('ignores settle when nothing is open', () => {
    expect(() => service.settle(true)).not.toThrow();
    expect(service.request()).toBeNull();
  });
});
