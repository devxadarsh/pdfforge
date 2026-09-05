import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FileDropzoneComponent } from '../../shared/components/dropzone/file-dropzone.component';
import { LoadedFile } from '../../core/models/file.models';
import { formatBytes } from '../../core/utilities/file.util';
import { PdfWorkerService } from '../../core/services/worker/pdf-worker.service';
import { DownloadService } from '../../core/services/download/download.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-compress',
  standalone: true,
  imports: [RouterLink, FormsModule, FileDropzoneComponent],
  templateUrl: './compress.component.html',
  styleUrl: './compress.component.scss',
})
export class CompressComponent {
  private readonly worker = inject(PdfWorkerService);
  private readonly downloads = inject(DownloadService);
  private readonly toasts = inject(ToastService);

  readonly level = signal<'recommended' | 'strong' | 'extreme'>('recommended');
  readonly levels = [
    { value: 'recommended', label: 'Recommended', hint: 'Best balance of size and quality' },
    { value: 'strong', label: 'Strong', hint: 'Smaller file, slightly lower quality' },
    { value: 'extreme', label: 'Extreme', hint: 'Maximum reduction, visible quality loss' },
  ] as const;

  readonly loadedFile = signal<LoadedFile | null>(null);
  readonly compressing = signal<boolean>(false);
  readonly result = signal<{
    originalBytes: number;
    compressedBytes: number;
    ratio: number;
  } | null>(null);

  protected readonly formatBytes = formatBytes;

  setLevel(l: 'recommended' | 'strong' | 'extreme'): void {
    this.level.set(l);
  }

  onFileLoaded(files: LoadedFile[]): void {
    if (files.length > 0) {
      this.loadedFile.set(files[0]);
      this.result.set(null);
      this.toasts.info(`Loaded ${files[0].name} (${formatBytes(files[0].sizeBytes)})`);
    }
  }

  async compress(): Promise<void> {
    const file = this.loadedFile();
    if (!file) return;

    this.compressing.set(true);
    try {
      const sourceBytes = new Uint8Array(file.data);
      const compressedBytes = await this.worker.compressPdf(sourceBytes, this.level());

      const origSize = sourceBytes.byteLength;
      const newSize = compressedBytes.byteLength;
      const reduction = Math.max(0, Math.round(((origSize - newSize) / origSize) * 100));

      this.result.set({
        originalBytes: origSize,
        compressedBytes: newSize,
        ratio: reduction,
      });

      const blob = new Blob([compressedBytes as BlobPart], { type: 'application/pdf' });
      const outName = file.name.replace(/\.pdf$/i, '') + '-compressed.pdf';
      this.downloads.download(blob, outName);
      this.toasts.success(`Compressed! Reduced by ${reduction}%.`);
    } catch (err) {
      console.error('[CompressComponent] Compression error:', err);
      this.toasts.error(
        err instanceof Error ? err.message : 'Compression failed.',
      );
    } finally {
      this.compressing.set(false);
    }
  }
}
