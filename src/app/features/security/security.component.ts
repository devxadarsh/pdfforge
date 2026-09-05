import { Component, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { LoadedFile } from '../../core/models/file.models';
import { PdfWorkerService } from '../../core/services/worker/pdf-worker.service';
import { DownloadService } from '../../core/services/download/download.service';
import { ToastService } from '../../core/services/toast.service';
import { formatBytes } from '../../core/utilities/file.util';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule, FileDropzoneComponent],
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
  readonly showPassword = signal(false);
  readonly permissions = signal({
    print: true,
    copy: true,
    modify: false,
  });

  readonly loadedFile = signal<LoadedFile | null>(null);
  readonly processing = signal<boolean>(false);
  protected readonly formatBytes = formatBytes;

  constructor() {
    const syncMode = (url: string) => {
      const isUnlock = url.includes('unlock');
      this.mode.set(isUnlock ? 'unlock' : 'protect');
    };

    syncMode(this.router.url);

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        syncMode(e.urlAfterRedirects);
        this.password.set('');
        this.confirm.set('');
      });
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

  clearFile(): void {
    this.loadedFile.set(null);
    this.password.set('');
    this.confirm.set('');
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
