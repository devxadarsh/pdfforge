import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';

@Component({
    selector: 'app-split',
    imports: [RouterLink, FormsModule, FileDropzoneComponent],
    templateUrl: './split.component.html',
    styleUrl: './split.component.scss'
})
export class SplitComponent {
  readonly mode = signal<'every' | 'range'>('every');
  readonly range = signal('1-3, 5');

  setMode(m: 'every' | 'range'): void {
    this.mode.set(m);
  }
}
