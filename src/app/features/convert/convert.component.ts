import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';

interface ConvertMode {
  id: string;
  label: string;
  icon: string;
  accept: string;
  hint: string;
  available: boolean;
}

@Component({
    selector: 'app-convert',
    imports: [RouterLink, FormsModule, NgClass, FileDropzoneComponent],
    templateUrl: './convert.component.html',
    styleUrl: './convert.component.scss'
})
export class ConvertComponent {
  readonly modes: ConvertMode[] = [
    { id: 'pdf-png', label: 'PDF → PNG', icon: 'fa-solid fa-image', accept: 'application/pdf', hint: 'Render pages as images', available: true },
    { id: 'pdf-jpg', label: 'PDF → JPG', icon: 'fa-solid fa-image', accept: 'application/pdf', hint: 'Compact page images', available: true },
    { id: 'pdf-text', label: 'PDF → Text', icon: 'fa-solid fa-file-lines', accept: 'application/pdf', hint: 'Extract readable text', available: true },
    { id: 'img-pdf', label: 'Images → PDF', icon: 'fa-solid fa-file-pdf', accept: 'image/*', hint: 'Combine images into a PDF', available: true },
  ];
  readonly active = signal<string>('pdf-png');

  setMode(id: string): void {
    this.active.set(id);
  }

  get current(): ConvertMode {
    return this.modes.find((m) => m.id === this.active()) ?? this.modes[0];
  }
}
