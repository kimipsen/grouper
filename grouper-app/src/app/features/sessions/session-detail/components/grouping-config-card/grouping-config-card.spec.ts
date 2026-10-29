import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { I18nService } from '../../../../../core/services/i18n.service';
import { GroupingStrategy } from '../../../../../models/group.model';
import { getAxeViolations } from '../../../../../../testing/axe';
import { GroupingConfigCard } from './grouping-config-card';

class MockI18nService {
  t(key: string, params?: Record<string, string | number>): string {
    if (key === 'grouping.warnings.groupSizeLargerThanPeople') {
      return `Group size ${params?.['groupSize']} is larger than ${params?.['peopleCount']} people`;
    }
    const labels: Record<string, string> = {
      'notifications.error': 'Error:',
      'sessionDetail.errorSummaryTitle': 'There is a problem',
      'sessionDetail.resetSessionHelp': 'Removes everything',
      'grouping.errors.groupSizeMin': 'Group size must be at least 1',
      'grouping.errors.noWeightsSelected': 'Select at least one weight',
      'sessionDetail.snackbar.addPeopleFirst': 'Please add people first',
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
    fixture.componentRef.setInput('customWeights', [{ id: 'w1', name: 'Karakter', mode: 'balance' }]);
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

  it('shows the grouping error as a DKFDS error alert below the heading', async () => {
    await TestBed.configureTestingModule({
      imports: [GroupingConfigCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(GroupingConfigCard);
    fixture.componentRef.setInput('groupingStrategyControl', new FormControl(GroupingStrategy.RANDOM, { nonNullable: true }));
    fixture.componentRef.setInput('groupSizeControl', new FormControl(3, { nonNullable: true }));
    fixture.componentRef.setInput('allowPartialGroupsControl', new FormControl(true, { nonNullable: true }));
    fixture.componentRef.setInput('genderModeControl', new FormControl('mixed', { nonNullable: true }));
    fixture.componentRef.setInput('preferenceWantWithControl', new FormControl(2, { nonNullable: true }));
    fixture.componentRef.setInput('preferenceAvoidControl', new FormControl(-2, { nonNullable: true }));
    fixture.componentRef.setInput('customWeights', []);
    fixture.componentRef.setInput('selectedWeightIds', []);
    fixture.componentRef.setInput('genderWeightId', '__gender__');
    fixture.componentRef.setInput('peopleCount', 2);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.alert')).toBeNull();

    fixture.componentRef.setInput('error', {
      key: 'grouping.warnings.groupSizeLargerThanPeople',
      params: { groupSize: 3, peopleCount: 2 },
    });
    fixture.detectChanges();

    const alert = root.querySelector('.alert.alert-error');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.previousElementSibling?.classList).toContain('card-heading');
    expect(alert?.querySelector('.alert-heading')?.textContent?.trim()).toBe(
      'Error: Group size 3 is larger than 2 people',
    );
  });

  describe('error summary and field errors', () => {
    async function setup(strategy: GroupingStrategy, peopleCount = 2) {
      await TestBed.configureTestingModule({
        imports: [GroupingConfigCard],
        providers: [{ provide: I18nService, useClass: MockI18nService }],
      }).compileComponents();

      const fixture = TestBed.createComponent(GroupingConfigCard);
      fixture.componentRef.setInput('groupingStrategyControl', new FormControl(strategy, { nonNullable: true }));
      fixture.componentRef.setInput('groupSizeControl', new FormControl(0, { nonNullable: true }));
      fixture.componentRef.setInput('allowPartialGroupsControl', new FormControl(true, { nonNullable: true }));
      fixture.componentRef.setInput('genderModeControl', new FormControl('mixed', { nonNullable: true }));
      fixture.componentRef.setInput('preferenceWantWithControl', new FormControl(2, { nonNullable: true }));
      fixture.componentRef.setInput('preferenceAvoidControl', new FormControl(-2, { nonNullable: true }));
      fixture.componentRef.setInput('customWeights', []);
      fixture.componentRef.setInput('selectedWeightIds', []);
      fixture.componentRef.setInput('genderWeightId', '__gender__');
      fixture.componentRef.setInput('peopleCount', peopleCount);
      const root: HTMLElement = fixture.nativeElement;
      document.body.appendChild(root);
      await fixture.whenStable();
      return { fixture, root };
    }

    afterEach(() => document.querySelectorAll('[ng-version]').forEach((element) => element.remove()));

    it('keeps Generate groups enabled with no people and renders reset as a separate warning action', async () => {
      const { root } = await setup(GroupingStrategy.RANDOM, 0);
      const generate = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === 'Generate Groups',
      );

      expect(generate?.disabled).toBe(false);
      expect(root.querySelector('.reset-section .button-warning')?.textContent?.trim()).toBe('Reset Session');
    });

    it('shows an error summary linking to each field, focuses it, and marks the group size field', async () => {
      const { fixture, root } = await setup(GroupingStrategy.WEIGHTED);

      fixture.componentRef.setInput('fieldErrors', [
        { key: 'grouping.errors.groupSizeMin', fieldId: 'group-size' },
        { key: 'grouping.errors.noWeightsSelected', fieldId: 'weight-gender' },
      ]);
      await fixture.whenStable();

      const summary = root.querySelector<HTMLElement>('nav .alert-error');
      const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('nav a.function-link'));
      expect(summary?.querySelector('h3')?.textContent?.trim()).toBe('There is a problem');
      expect(links.map((link) => [link.getAttribute('href'), link.textContent?.trim()])).toEqual([
        ['#group-size', 'Group size must be at least 1'],
        ['#weight-gender', 'Select at least one weight'],
      ]);
      expect(document.activeElement).toBe(summary);

      const groupSize = root.querySelector<HTMLInputElement>('#group-size');
      expect(groupSize?.closest('.form-group')?.classList).toContain('form-error');
      expect(groupSize?.getAttribute('aria-invalid')).toBe('true');
      expect(groupSize?.getAttribute('aria-describedby')).toBe('group-size-error');
      expect(root.querySelector('#group-size-error')?.textContent?.trim()).toBe('Error: Group size must be at least 1');

      const weights = root.querySelector('fieldset.weight-selection');
      expect(weights?.classList).toContain('form-error');
      expect(weights?.getAttribute('aria-describedby')).toBe('weights-error');
      expect(weights?.querySelector('legend')?.textContent?.trim()).toBe('Select weights');
      expect(await getAxeViolations(root)).toEqual([]);
    });

    it('moves focus to the field when a summary link is followed, without navigating', async () => {
      const { fixture, root } = await setup(GroupingStrategy.RANDOM);
      fixture.componentRef.setInput('fieldErrors', [{ key: 'grouping.errors.groupSizeMin', fieldId: 'group-size' }]);
      await fixture.whenStable();

      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      root.querySelector('nav a.function-link')?.dispatchEvent(click);

      expect(click.defaultPrevented).toBe(true);
      expect(document.activeElement?.id).toBe('group-size');
    });

    it('shows no summary or field error state without field errors', async () => {
      const { root } = await setup(GroupingStrategy.RANDOM);

      expect(root.querySelector('nav')).toBeNull();
      expect(root.querySelector('.form-error')).toBeNull();
      expect(root.querySelector('#group-size')?.hasAttribute('aria-invalid')).toBe(false);
    });

    it('uses DKFDS radio groups bound to the gender mode and strategy controls', async () => {
      const { fixture, root } = await setup(GroupingStrategy.RANDOM);
      const strategy = fixture.componentInstance.groupingStrategyControl();
      const genderMode = fixture.componentInstance.genderModeControl();

      expect(root.querySelector('select')).toBeNull();
      expect(Array.from(root.querySelectorAll('fieldset > legend')).map((legend) => legend.textContent?.trim())).toEqual([
        'Gender Mode',
        'Strategy',
      ]);
      expect(root.querySelector<HTMLInputElement>('#grouping-strategy-RANDOM')?.checked).toBe(true);
      expect(root.querySelector<HTMLInputElement>('#gender-mode-mixed')?.checked).toBe(true);

      root.querySelector<HTMLInputElement>('#grouping-strategy-PREFERENCE_BASED')?.click();
      root.querySelector<HTMLInputElement>('#gender-mode-ignore')?.click();
      await fixture.whenStable();

      expect(strategy.value).toBe(GroupingStrategy.PREFERENCE_BASED);
      expect(genderMode.value).toBe('ignore');
      expect(root.querySelector('#pref-want')).not.toBeNull();
      expect(await getAxeViolations(root)).toEqual([]);
    });
  });
});
