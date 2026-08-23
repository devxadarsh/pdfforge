import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';

@Component({
  selector: 'app-compress',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass, FileDropzoneComponent],
  templateUrl: './compress.component.html',
  styleUrl: './compress.component.scss',
})
export class CompressComponent {
  readonly level = signal<'recommended' | 'strong' | 'extreme'>('recommended');
  readonly levels = [
    { value: 'recommended', label: 'Recommended', hint: 'Best balance of size and quality' },
    { value: 'strong', label: 'Strong', hint: 'Smaller file, slightly lower quality' },
    { value: 'extreme', label: 'Extreme', hint: 'Maximum reduction, visible quality loss' },
  ] as const;

  setLevel(l: 'recommended' | 'strong' | 'extreme'): void {
    this.level.set(l);
  }
}
