import { Component, signal, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { LoadedFile } from '../../core/models/file.models';
import { PdfWorkerService } from '../../core/services/worker/pdf-worker.service';
import { DownloadService } from '../../core/services/download/download.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [RouterLink, FormsModule, FileDropzoneComponent],
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss',
})
export class SecurityComponent {
  private readonly router = inject(Router);
  private readonly worker = inject(PdfWorkerService);
  private readonly downloads = inject(DownloadService);
  private readonly toasts = inject(ToastService);

  readonly mode = signal<'protect' | 'unlock'>('protect');
  readonly password = signal('');
  readonly confirm = signal('');
  readonly permissions = signal({
    print: true,
    copy: true,
    modify: false,
  });

  readonly loadedFile = signal<LoadedFile | null>(null);
  readonly processing = signal<boolean>(false);

  constructor() {
    const isUnlock = this.router.url.includes('unlock');
    this.mode.set(isUnlock ? 'unlock' : 'protect');
  }

  togglePerm(key: 'print' | 'copy' | 'modify'): void {
    this.permissions.update((p) => ({ ...p, [key]: !p[key] }));
  }

  onFileLoaded(files: LoadedFile[]): void {
    if (files.length > 0) {
      this.loadedFile.set(files[0]);
      this.toasts.info(`Loaded ${files[0].name}`);
    }
  }

  async runAction(): Promise<void> {
    const file = this.loadedFile();
    if (!file) {
      this.toasts.warning('Please select a PDF document first.');
      return;
    }

    const pw = this.password().trim();
    if (!pw) {
      this.toasts.warning('Please enter a password.');
      return;
    }

    if (this.mode() === 'protect') {
      if (pw !== this.confirm().trim()) {
        this.toasts.warning('Passwords do not match.');
        return;
      }

      this.processing.set(true);
      try {
        const sourceBytes = new Uint8Array(file.data);
        const protectedBytes = await this.worker.protectPdf(
          sourceBytes,
          pw,
          pw,
          this.permissions(),
        );

        const blob = new Blob([protectedBytes as BlobPart], { type: 'application/pdf' });
        const outName = file.name.replace(/\.pdf$/i, '') + '-protected.pdf';
        this.downloads.download(blob, outName);
        this.toasts.success('PDF protected successfully!');
      } catch (err) {
        console.error('[SecurityComponent] Protect failed:', err);
        this.toasts.error(
          err instanceof Error ? err.message : 'Failed to protect PDF.',
        );
      } finally {
        this.processing.set(false);
      }
    } else {
      this.processing.set(true);
      try {
        const sourceBytes = new Uint8Array(file.data);
        const unlockedBytes = await this.worker.unlockPdf(sourceBytes, pw);

        const blob = new Blob([unlockedBytes as BlobPart], { type: 'application/pdf' });
        const outName = file.name.replace(/\.pdf$/i, '') + '-unlocked.pdf';
        this.downloads.download(blob, outName);
        this.toasts.success('PDF unlocked successfully!');
      } catch (err) {
        console.error('[SecurityComponent] Unlock failed:', err);
        this.toasts.error(
          err instanceof Error ? err.message : 'Failed to unlock PDF. Please verify password.',
        );
      } finally {
        this.processing.set(false);
      }
    }
  }
}
