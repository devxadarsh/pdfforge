import {
  Component,
  Output,
  EventEmitter,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';

export interface StampResult {
  readonly text: string;
  readonly color: string;
}

@Component({
  selector: 'app-stamp-dialog',
  standalone: true,
  imports: [FormsModule, NgClass],
  templateUrl: './stamp-dialog.component.html',
  styleUrl: './stamp-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StampDialogComponent {
  @Output() result = new EventEmitter<StampResult | null>();

  readonly presets = ['APPROVED', 'REJECTED', 'DRAFT', 'RECEIVED', 'CONFIDENTIAL', 'PAID'];
  readonly text = signal('APPROVED');
  readonly color = signal('#dc2626');

  pick(preset: string): void {
    this.text.set(preset);
  }

  cancel(): void {
    this.result.emit(null);
  }

  confirm(): void {
    this.result.emit({ text: this.text().trim() || 'APPROVED', color: this.color() });
  }
}
