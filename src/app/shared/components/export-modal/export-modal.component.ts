import {
  Component,
  signal,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
  HostListener,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DetailedExportOptions,
  ExportPageRangeType,
  ExportProgressUpdate,
  parsePageRange,
  sanitizePdfFilename,
} from '../../../core/models/export.models';

@Component({
  selector: 'app-export-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export-modal.component.html',
  styleUrl: './export-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportModalComponent implements OnInit {
  // Inputs
  readonly defaultFilename = input<string>('document-edited.pdf');
  readonly totalPages = input<number>(1);
  readonly currentPage = input<number>(1);
  readonly hasSelectedPages = input<boolean>(false);
  readonly selectedPagesCount = input<number>(0);
  readonly isExporting = input<boolean>(false);
  readonly exportProgress = input<ExportProgressUpdate | null>(null);

  // Outputs
  readonly confirmExport = output<DetailedExportOptions>();
  readonly cancel = output<void>();

  // Form State Signals
  readonly filename = signal<string>('document-edited.pdf');
  readonly pageRange = signal<ExportPageRangeType>('all');
  readonly customRangeStr = signal<string>('');
  readonly includeAnnotations = signal<boolean>(true);
  readonly includeImagesAndSignatures = signal<boolean>(true);
  readonly includeStamps = signal<boolean>(true);

  // Metadata
  readonly showMetadata = signal<boolean>(false);
  readonly docTitle = signal<string>('');
  readonly docAuthor = signal<string>('');
  readonly docSubject = signal<string>('');

  ngOnInit(): void {
    const rawName = this.defaultFilename() || 'document-edited.pdf';
    this.filename.set(sanitizePdfFilename(rawName));
    this.customRangeStr.set(`1-${this.totalPages()}`);
    this.docTitle.set(rawName.replace(/\.pdf$/i, ''));
  }

  // Computed page counts
  readonly parsedCustomPages = computed<number[]>(() => {
    return parsePageRange(this.customRangeStr(), this.totalPages());
  });

  readonly parsedCustomPagesDisplay = computed<string>(() => {
    return this.parsedCustomPages()
      .map((p) => p + 1)
      .join(', ');
  });

  readonly effectivePageCount = computed<number>(() => {
    const mode = this.pageRange();
    if (mode === 'all') {
      return this.totalPages();
    }
    if (mode === 'current') {
      return 1;
    }
    if (mode === 'selected') {
      return this.selectedPagesCount();
    }
    if (mode === 'custom') {
      return this.parsedCustomPages().length;
    }
    return this.totalPages();
  });

  readonly isCustomRangeValid = computed<boolean>(() => {
    if (this.pageRange() !== 'custom') return true;
    return this.parsedCustomPages().length > 0;
  });

  readonly canSubmit = computed<boolean>(() => {
    if (this.isExporting()) return false;
    if (!this.filename().trim()) return false;
    if (this.effectivePageCount() <= 0) return false;
    return true;
  });

  setPageRange(range: ExportPageRangeType): void {
    this.pageRange.set(range);
  }

  toggleMetadata(): void {
    this.showMetadata.update((v) => !v);
  }

  submit(): void {
    if (!this.canSubmit()) return;

    const safeName = sanitizePdfFilename(this.filename());
    const options: DetailedExportOptions = {
      filename: safeName,
      pageRange: this.pageRange(),
      customPageRange: this.pageRange() === 'custom' ? this.customRangeStr().trim() : undefined,
      includeAnnotations: this.includeAnnotations(),
      includeImagesAndSignatures: this.includeImagesAndSignatures(),
      includeStamps: this.includeStamps(),
      title: this.docTitle().trim() || undefined,
      author: this.docAuthor().trim() || undefined,
      subject: this.docSubject().trim() || undefined,
    };

    this.confirmExport.emit(options);
  }

  close(): void {
    if (this.isExporting()) return;
    this.cancel.emit();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && !this.isExporting()) {
      e.preventDefault();
      this.close();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.submit();
    }
  }
}
