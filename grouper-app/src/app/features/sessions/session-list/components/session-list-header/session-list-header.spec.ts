import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../../core/services/i18n.service';
import { SessionListHeader } from './session-list-header';

class MockI18nService {
  t(key: string): string {
    const labels: Record<string, string> = {
      'sessionList.title': 'Sessions',
      'sessionList.newSession': 'New Session',
      'common.import': 'Import',
    };
    return labels[key] ?? key;
  }
}

describe('SessionListHeader', () => {
  it('renders actions and emits create/import events', async () => {
    await TestBed.configureTestingModule({
      imports: [SessionListHeader],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionListHeader);
    const component = fixture.componentInstance;
    const createSpy = vi.fn();
    const importSpy = vi.fn();
    component.create.subscribe(createSpy);
    component.import.subscribe(importSpy);

    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    buttons[1].click();

    expect(fixture.nativeElement.textContent).toContain('Sessions');
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(importSpy).toHaveBeenCalledTimes(1);
  });
});
