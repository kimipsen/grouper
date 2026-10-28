import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../../core/services/i18n.service';
import { Session } from '../../../../../models/session.model';
import { registerAppLocaleData } from '../../../../../core/register-locale-data';
import { SessionListCard } from './session-list-card';

class MockI18nService {
  t(key: string, params?: Record<string, string | number>): string {
    if (key === 'sessionList.peopleCount') {
      return `People ${params?.['count']}`;
    }
    if (key === 'sessionList.groupingsCount') {
      return `Groupings ${params?.['count']}`;
    }

    const labels: Record<string, string> = {
      'common.open': 'Open',
      'common.export': 'Export',
      'common.delete': 'Delete',
    };
    return labels[key] ?? key;
  }
}

const session: Session = {
  id: 's1',
  name: 'Session 1',
  description: 'Desc',
  people: [],
  preferences: {},
  groupingHistory: [],
  customWeights: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('SessionListCard', () => {
  it('emits open/export/remove actions', async () => {
    await TestBed.configureTestingModule({
      imports: [SessionListCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionListCard);
    fixture.componentRef.setInput('session', session);
    fixture.componentRef.setInput('currentDateLocale', 'en-US');

    const openSpy = vi.fn();
    const exportSpy = vi.fn();
    const removeSpy = vi.fn();
    fixture.componentInstance.open.subscribe(openSpy);
    fixture.componentInstance.export.subscribe(exportSpy);
    fixture.componentInstance.remove.subscribe(removeSpy);

    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.session-card');
    const buttons = fixture.nativeElement.querySelectorAll('button');

    card.click();
    buttons[1].click();
    buttons[2].click();

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('renders date and action labels with the Danish date locale', async () => {
    registerAppLocaleData();
    await TestBed.configureTestingModule({
      imports: [SessionListCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(SessionListCard);
    fixture.componentRef.setInput('session', session);
    fixture.componentRef.setInput('currentDateLocale', 'da-DK');
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const infoItems: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.info-item dt'));

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Open', 'Export', 'Delete']);
    expect(infoItems[2].textContent?.trim()).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });
});
