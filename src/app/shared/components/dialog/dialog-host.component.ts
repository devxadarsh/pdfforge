import {
  Component,
  inject,
  signal,
  ElementRef,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../core/services/dialog.service';

@Component({
    selector: 'app-dialog-host',
    standalone: true,
    imports: [NgClass, FormsModule],
    templateUrl: './dialog-host.component.html',
    styleUrl: './dialog-host.component.scss'
})
export class DialogHostComponent {
  private readonly dialogs = inject(DialogService);
  readonly active = this.dialogs.active;
  readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  readonly inputType = signal<'text' | 'password'>('text');

  constructor() {
    afterNextRender(() => {
      const el = this.inputEl()?.nativeElement;
      if (el) {
        el.focus();
      }
    });
  }

  get hasDialog(): boolean {
    return this.active() !== null;
  }

  onInput(value: string): void {
    this.dialogs.setValue(value);
  }

  confirm(): void {
    this.dialogs.close(true);
  }

  cancel(): void {
    this.dialogs.close(false);
  }

  secondary(): void {
    this.dialogs.closeSecondary();
  }
}
