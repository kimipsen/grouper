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
      'sessionDetail.customWeights.empty': 'No weights',
    };
    return labels[key] ?? key;
  }
}

const weights: CustomWeightDefinition[] = [
  { id: 'w1', name: 'Karakter' },
  { id: 'w2', name: 'Opførsel' },
];

describe('CustomWeightsCard', () => {
  it('emits add, rename, and remove actions', async () => {
    await TestBed.configureTestingModule({
      imports: [CustomWeightsCard],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomWeightsCard);
    fixture.componentRef.setInput('customWeights', weights);
    fixture.componentRef.setInput('newWeightNameControl', new FormControl<string>('New', { nonNullable: true }));

    const addSpy = vi.fn();
    const renameSpy = vi.fn();
    const removeSpy = vi.fn();
    fixture.componentInstance.addWeight.subscribe(addSpy);
    fixture.componentInstance.renameWeight.subscribe(renameSpy);
    fixture.componentInstance.removeWeight.subscribe(removeSpy);

    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('.weight-editor button');
    const renameInput = fixture.nativeElement.querySelector('.weight-row input');
    const removeButton = fixture.nativeElement.querySelector('.weight-row button[color="warn"]');

    addButton.click();
    renameInput.value = 'Renamed';
    renameInput.dispatchEvent(new Event('input'));
    removeButton.click();

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(renameSpy).toHaveBeenCalledWith({ weight: weights[0], name: 'Renamed' });
    expect(removeSpy).toHaveBeenCalledWith(weights[0]);
  });
});
