import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../../core/services/i18n.service';
import { SessionListEmptyState } from './session-list-empty-state';

class MockI18nService {
  t(key: string): string {
    const labels: Record<string, string> = {
      'sessionList.emptyTitle': 'No sessions',
      'sessionList.emptyDescription': 'Create one to get started',
      'sessionList.createFirstSession': 'Create First Session',
    };
    return labels[key] ?? key;
  }
}

describe('SessionListEmptyState', () => {
  it('renders empty state and emits create', async () => {
    await TestBed.configureTestingModule({
      imports: [SessionListEmptyState],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionListEmptyState);
    const createSpy = vi.fn();
    fixture.componentInstance.create.subscribe(createSpy);

    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();

    expect(fixture.nativeElement.textContent).toContain('No sessions');
    expect(createSpy).toHaveBeenCalledTimes(1);
  });
});
