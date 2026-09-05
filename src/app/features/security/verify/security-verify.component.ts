import { Component, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FileDropzoneComponent } from '../../../shared/components/dropzone/file-dropzone.component';
import { LoadedFile } from '../../../core/models/file.models';
import {
  PdfSignatureVerifierService,
  SignatureVerificationResult,
} from '../../../core/services/pdf/pdf-signature-verifier.service';
import {
  PdfForensicsService,
  ForensicsReport,
} from '../../../core/services/pdf/pdf-forensics.service';
import { DownloadService } from '../../../core/services/download/download.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatBytes } from '../../../core/utilities/file.util';

@Component({
  selector: 'app-security-verify',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, DatePipe, FileDropzoneComponent],
  templateUrl: './security-verify.component.html',
  styleUrl: './security-verify.component.scss',
})
export class SecurityVerifyComponent {
  private readonly verifier = inject(PdfSignatureVerifierService);
  private readonly forensics = inject(PdfForensicsService);
  private readonly downloads = inject(DownloadService);
  private readonly toasts = inject(ToastService);

  readonly loadedFile = signal<LoadedFile | null>(null);
  readonly analyzing = signal<boolean>(false);
  readonly activeTab = signal<'signature' | 'forensics'>('signature');

  readonly signatureResult = signal<SignatureVerificationResult | null>(null);
  readonly forensicsReport = signal<ForensicsReport | null>(null);

  protected readonly formatBytes = formatBytes;

  async onFileLoaded(files: LoadedFile[]): Promise<void> {
    if (!files || files.length === 0) return;
    const file = files[0];
    this.loadedFile.set(file);
    this.analyzing.set(true);

    try {
      const bytes = new Uint8Array(file.data);

      const [sigResult, forensicReport] = await Promise.all([
        this.verifier.verifySignatures(bytes),
        Promise.resolve(this.forensics.analyzeDocument(bytes)),
      ]);

      this.signatureResult.set(sigResult);
      this.forensicsReport.set(forensicReport);

      // Auto-switch tab to signature if signed, else forensics
      if (sigResult.hasSignature) {
        this.activeTab.set('signature');
        if (sigResult.overallStatus === 'valid') {
          this.toasts.success('Digital signature verified: Document is authentic!');
        } else {
          this.toasts.warning('Warning: Document signature is invalid or altered.');
        }
      } else {
        this.activeTab.set('forensics');
        this.toasts.info('No digital signature detected. Displaying forensic revision history.');
      }
    } catch (err) {
      console.error('[SecurityVerifyComponent] Verification failed:', err);
      this.toasts.error('Failed to analyze document integrity.');
    } finally {
      this.analyzing.set(false);
    }
  }

  clearFile(): void {
    this.loadedFile.set(null);
    this.signatureResult.set(null);
    this.forensicsReport.set(null);
    this.activeTab.set('signature');
  }

  downloadRevision(revNumber: number): void {
    const file = this.loadedFile();
    if (!file) return;

    try {
      const bytes = new Uint8Array(file.data);
      const revBytes = this.forensics.extractRevision(bytes, revNumber);

      if (!revBytes) {
        this.toasts.warning(`Could not isolate revision ${revNumber}.`);
        return;
      }

      const blob = new Blob([revBytes as BlobPart], { type: 'application/pdf' });
      const baseName = file.name.replace(/\.pdf$/i, '');
      this.downloads.download(blob, `${baseName}-rev${revNumber}.pdf`);
      this.toasts.success(`Downloaded Revision ${revNumber} document!`);
    } catch (err) {
      console.error(`[SecurityVerifyComponent] Download rev ${revNumber} error:`, err);
      this.toasts.error(`Failed to extract revision ${revNumber}.`);
    }
  }

  downloadOriginalRevision(): void {
    this.downloadRevision(1);
  }
}
