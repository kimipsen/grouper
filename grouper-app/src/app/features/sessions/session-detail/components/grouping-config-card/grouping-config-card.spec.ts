import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { I18nService } from '../../../../../core/services/i18n.service';
import { GroupingStrategy } from '../../../../../models/group.model';
import { GroupingConfigCard } from './grouping-config-card';

class MockI18nService {
  t(key: string): string {
    const labels: Record<string, string> = {
      'sessionDetail.createGroupsTitle': 'Create Groups',
      'sessionDetail.genderMode.label': 'Gender Mode',
      'sessionDetail.genderMode.mixed': 'Mixed',
      'sessionDetail.genderMode.single': 'Single',
      'sessionDetail.genderMode.ignore': 'Ignore',
      'sessionDetail.strategy': 'Strategy',
      'sessionDetail.strategyRandom': 'Random',
      'sessionDetail.strategyPreferenceBased': 'Preference-Based',
      'sessionDetail.strategyWeighted': 'Weighted',
      'sessionDetail.preferenceScoring.title': 'Preference scoring',
      'sessionDetail.preferenceScoring.wantWith': 'Want with',
      'sessionDetail.preferenceScoring.avoid': 'Avoid',
      'sessionDetail.groupSize': 'Group Size',
      'sessionDetail.allowPartialGroups': 'Allow partial groups',
      'sessionDetail.generateGroups': 'Generate Groups',
      'sessionDetail.customWeights.selectHelp': 'Select weights',
      'sessionDetail.customWeights.genderWeight': 'Gender',
      'sessionDetail.resetSession': 'Reset Session',
    };
    return labels[key] ?? key;
  }
}

describe('GroupingConfigCard', () => {
  it('emits generate/reset/toggle weight actions', async () => {
    await TestBed.configureTestingModule({
      imports: [GroupingConfigCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(GroupingConfigCard);
    fixture.componentRef.setInput('groupingStrategyControl', new FormControl(GroupingStrategy.WEIGHTED, { nonNullable: true }));
    fixture.componentRef.setInput('groupSizeControl', new FormControl(3, { nonNullable: true }));
    fixture.componentRef.setInput('allowPartialGroupsControl', new FormControl(true, { nonNullable: true }));
    fixture.componentRef.setInput('genderModeControl', new FormControl('mixed', { nonNullable: true }));
    fixture.componentRef.setInput('preferenceWantWithControl', new FormControl(2, { nonNullable: true }));
    fixture.componentRef.setInput('preferenceAvoidControl', new FormControl(-2, { nonNullable: true }));
    fixture.componentRef.setInput('customWeights', [{ id: 'w1', name: 'Karakter' }]);
    fixture.componentRef.setInput('selectedWeightIds', []);
    fixture.componentRef.setInput('genderWeightId', '__gender__');
    fixture.componentRef.setInput('peopleCount', 10);

    const generateSpy = vi.fn();
    const resetSpy = vi.fn();
    const toggleSpy = vi.fn();
    fixture.componentInstance.generateGroups.subscribe(generateSpy);
    fixture.componentInstance.resetSession.subscribe(resetSpy);
    fixture.componentInstance.toggleWeightSelection.subscribe(toggleSpy);

    fixture.detectChanges();

    const checkboxes = fixture.nativeElement.querySelectorAll('.weight-select-list input[type="checkbox"]');
    checkboxes[0].dispatchEvent(new Event('change'));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    buttons[1].click();

    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(toggleSpy).toHaveBeenCalledWith('__gender__');
  });
});
