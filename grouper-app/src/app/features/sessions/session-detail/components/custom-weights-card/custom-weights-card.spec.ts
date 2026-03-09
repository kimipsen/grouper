import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { I18nService } from '../../../../../core/services/i18n.service';
import { CustomWeightDefinition } from '../../../../../models/session.model';
import { CustomWeightsCard } from './custom-weights-card';

class MockI18nService {
  t(key: string): string {
    const labels: Record<string, string> = {
      'sessionDetail.customWeights.title': 'Custom Weights',
      'sessionDetail.customWeights.nameLabel': 'Name',
      'sessionDetail.customWeights.add': 'Add',
      'sessionDetail.customWeights.weightLabel': 'Weight',
      'sessionDetail.customWeights.modeLabel': 'Mode',
      'sessionDetail.customWeights.modeBalance': 'Balance across groups',
      'sessionDetail.customWeights.modeMatchSimilar': 'Match similar in groups',
      'sessionDetail.customWeights.empty': 'No weights',
    };
    return labels[key] ?? key;
  }
}

const weights: CustomWeightDefinition[] = [
  { id: 'w1', name: 'Karakter', mode: 'balance' },
  { id: 'w2', name: 'Opførsel', mode: 'match-similar' },
];

describe('CustomWeightsCard', () => {
  it('emits add, rename, mode update, and remove actions', async () => {
    await TestBed.configureTestingModule({
      imports: [CustomWeightsCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomWeightsCard);
    fixture.componentRef.setInput('customWeights', weights);
    fixture.componentRef.setInput('newWeightNameControl', new FormControl<string>('New', { nonNullable: true }));
    fixture.componentRef.setInput('newWeightModeControl', new FormControl<'balance' | 'match-similar'>('match-similar', { nonNullable: true }));

    const addSpy = vi.fn();
    const renameSpy = vi.fn();
    const modeSpy = vi.fn();
    const removeSpy = vi.fn();
    fixture.componentInstance.addWeight.subscribe(addSpy);
    fixture.componentInstance.renameWeight.subscribe(renameSpy);
    fixture.componentInstance.updateWeightMode.subscribe(modeSpy);
    fixture.componentInstance.removeWeight.subscribe(removeSpy);

    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('.weight-editor button');
    const renameInput = fixture.nativeElement.querySelector('.weight-row input');
    const modeSelect = fixture.nativeElement.querySelector('.weight-row select');
    const removeButton = fixture.nativeElement.querySelector('.weight-row button[color="warn"]');

    addButton.click();
    renameInput.value = 'Renamed';
    renameInput.dispatchEvent(new Event('input'));
    modeSelect.value = 'match-similar';
    modeSelect.dispatchEvent(new Event('change'));
    removeButton.click();

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(renameSpy).toHaveBeenCalledWith({ weight: weights[0], name: 'Renamed' });
    expect(modeSpy).toHaveBeenCalledWith({ weight: weights[0], mode: 'match-similar' });
    expect(removeSpy).toHaveBeenCalledWith(weights[0]);
  });
});
