import type { Mock } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../../core/services/i18n.service';
import { getAxeViolations } from '../../../../../../testing/axe';
import { SessionCreateForm } from './session-create-form';

class MockI18nService {
  t(key: string): string {
    const labels: Record<string, string> = {
      'sessionList.createForm.title': 'New session',
      'sessionList.createForm.nameLabel': 'Session name',
      'sessionList.createForm.nameRequired': 'Enter a name for the session',
      'sessionList.createForm.submit': 'Create session',
      'common.cancel': 'Cancel',
      'notifications.error': 'Error:',
    };
    return labels[key] ?? key;
  }
}

describe('SessionCreateForm', () => {
  let fixture: ComponentFixture<SessionCreateForm>;
  let root: HTMLElement;
  let created: Mock<(name: string) => void>;
  let cancelled: Mock<() => void>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionCreateForm],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionCreateForm);
    root = fixture.nativeElement;
    document.body.appendChild(root);
    created = vi.fn<(name: string) => void>();
    cancelled = vi.fn<() => void>();
    fixture.componentInstance.created.subscribe(created);
    fixture.componentInstance.cancelled.subscribe(cancelled);
    await fixture.whenStable();
  });

  afterEach(() => root.remove());

  const input = () => root.querySelector<HTMLInputElement>('#new-session-name') as HTMLInputElement;

  async function submitWith(value: string): Promise<void> {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    root.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await fixture.whenStable();
  }

  it('focuses the name field when shown and has no axe violations', async () => {
    expect(document.activeElement).toBe(input());
    expect(root.querySelector('label[for="new-session-name"]')?.textContent?.trim()).toBe('Session name');
    expect(await getAxeViolations(root)).toEqual([]);
  });

  it.each(['', '   '])('shows a DKFDS field error and keeps focus for name %j', async (value) => {
    await submitWith(value);

    const message = root.querySelector('#new-session-name-error');
    expect(created).not.toHaveBeenCalled();
    expect(root.querySelector('.form-group')?.classList).toContain('form-error');
    expect(message?.textContent?.trim()).toBe('Error: Enter a name for the session');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().getAttribute('aria-describedby')).toBe('new-session-name-error');
    expect(document.activeElement).toBe(input());
    expect(await getAxeViolations(root)).toEqual([]);
  });

  it('emits the trimmed name and clears the error on a valid submit', async () => {
    await submitWith('');
    await submitWith('  Team workshop  ');

    expect(created).toHaveBeenCalledWith('Team workshop');
    expect(root.querySelector('#new-session-name-error')).toBeNull();
    expect(input().hasAttribute('aria-invalid')).toBe(false);
  });

  it('emits cancelled from the cancel button', () => {
    root.querySelector<HTMLButtonElement>('button[type="button"]')?.click();

    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(created).not.toHaveBeenCalled();
  });
});
