import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { TOOL_CATEGORIES } from '../../core/constants/tools';
import { FileService } from '../../core/services/file/file.service';
import { LoadedFile } from '../../core/models/file.models';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, NgClass, FileDropzoneComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly files = inject(FileService);
  readonly categories = TOOL_CATEGORIES;

  readonly steps = [
    {
      icon: 'fa-solid fa-arrow-up-from-bracket',
      title: 'Open your PDF',
      text: 'Drag a file in or pick it from your device. Nothing is uploaded.',
    },
    {
      icon: 'fa-solid fa-wand-magic-sparkles',
      title: 'Edit or convert',
      text: 'Merge, split, compress, annotate and sign entirely in the browser.',
    },
    {
      icon: 'fa-solid fa-file-arrow-down',
      title: 'Download',
      text: 'Save the result straight to your device. Your data never leaves it.',
    },
  ];

  readonly privacyPoints = [
    { icon: 'fa-solid fa-shield-halved', text: 'No account required' },
    { icon: 'fa-solid fa-server', text: 'No servers, no uploads' },
    { icon: 'fa-solid fa-lock', text: '100% local processing' },
  ];

  async openPdf(): Promise<void> {
    const picked = await this.files.pickFile(false);
    if (picked.length) {
      await this.files.openInEditor(picked);
    }
  }

  onFilesLoaded(loaded: LoadedFile[]): void {
    if (loaded.length) {
      void this.router.navigate(['/editor']);
    }
  }
}
