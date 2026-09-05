import { Component, signal, computed, inject, HostListener, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { FileDropzoneComponent } from '../../../shared/components/dropzone/file-dropzone.component';
import { LoadedFile } from '../../../core/models/file.models';
import {
  PdfMetadataService,
  PdfMetadata,
} from '../../../core/services/pdf/pdf-metadata.service';
import { DownloadService } from '../../../core/services/download/download.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatBytes } from '../../../core/utilities/file.util';

export interface MetadataFormState {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
}

@Component({
  selector: 'app-security-metadata',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FormsModule, DatePipe, FileDropzoneComponent],
  templateUrl: './security-metadata.component.html',
  styleUrl: './security-metadata.component.scss',
})
export class SecurityMetadataComponent implements OnDestroy {
  private readonly metaService = inject(PdfMetadataService);
  private readonly downloads = inject(DownloadService);
  private readonly toasts = inject(ToastService);

  readonly loadedFile = signal<LoadedFile | null>(null);
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);

  // Form State
  readonly title = signal('');
  readonly author = signal('');
  readonly subject = signal('');
  readonly keywords = signal('');
  readonly creator = signal('');
  readonly producer = signal('');
  readonly creationDate = signal('');
  readonly modificationDate = signal('');

  // Original Baseline Metadata (Immutable snapshot when file was loaded)
  readonly initialMetadata = signal<MetadataFormState | null>(null);

  // Undo / Redo History Stack
  readonly history = signal<MetadataFormState[]>([]);
  readonly historyIndex = signal<number>(-1);

  // Computed state
  readonly canUndo = computed(() => this.historyIndex() > 0);
  readonly canRedo = computed(
    () => this.historyIndex() >= 0 && this.historyIndex() < this.history().length - 1,
  );

  readonly isModifiedFromInitial = computed(() => {
    const init = this.initialMetadata();
    if (!init) return false;
    return (
      this.title() !== init.title ||
      this.author() !== init.author ||
      this.subject() !== init.subject ||
      this.keywords() !== init.keywords ||
      this.creator() !== init.creator ||
      this.producer() !== init.producer ||
      this.creationDate() !== init.creationDate ||
      this.modificationDate() !== init.modificationDate
    );
  });

  // Original Metadata Read-Only Details for Specs Panel
  readonly rawMetadata = signal<PdfMetadata | null>(null);

  readonly isUnmodifiedDate = computed(() => {
    const meta = this.rawMetadata();
    if (!meta || !meta.creationDate || !meta.modificationDate) return false;
    if (meta.hasSeparateModDate === false) return true;
    return Math.abs(meta.modificationDate.getTime() - meta.creationDate.getTime()) < 2000;
  });

  protected readonly formatBytes = formatBytes;
  private historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  toDateTimeLocalString(date: Date | null): string {
    if (!date || isNaN(date.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private parseDateTimeLocal(val: string): Date | null {
    if (!val || !val.trim()) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  async onFileLoaded(files: LoadedFile[]): Promise<void> {
    if (!files || files.length === 0) return;
    const file = files[0];
    this.loadedFile.set(file);
    this.loading.set(true);

    try {
      const bytes = new Uint8Array(file.data);
      const meta = await this.metaService.readMetadata(bytes);
      this.rawMetadata.set(meta);

      const cDateStr = this.toDateTimeLocalString(meta.creationDate);
      const mDateStr = this.toDateTimeLocalString(meta.modificationDate || meta.creationDate);

      const initialForm: MetadataFormState = {
        title: meta.title,
        author: meta.author,
        subject: meta.subject,
        keywords: meta.keywords,
        creator: meta.creator,
        producer: meta.producer,
        creationDate: cDateStr,
        modificationDate: mDateStr,
      };

      this.initialMetadata.set(initialForm);
      this.setFormValues(initialForm);

      // Initialize history stack with baseline
      this.history.set([initialForm]);
      this.historyIndex.set(0);

      this.toasts.info(`Loaded metadata for "${file.name}"`);
    } catch (err) {
      console.error('[SecurityMetadataComponent] Failed to read metadata:', err);
      this.toasts.error('Failed to read PDF metadata.');
    } finally {
      this.loading.set(false);
    }
  }

  clearFile(): void {
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
      this.historyDebounceTimer = null;
    }
    this.loadedFile.set(null);
    this.rawMetadata.set(null);
    this.initialMetadata.set(null);
    this.history.set([]);
    this.historyIndex.set(-1);

    this.setFormValues({
      title: '',
      author: '',
      subject: '',
      keywords: '',
      creator: '',
      producer: '',
      creationDate: '',
      modificationDate: '',
    });
  }

  onFieldInput(field: keyof MetadataFormState, value: string): void {
    switch (field) {
      case 'title':
        this.title.set(value);
        break;
      case 'author':
        this.author.set(value);
        break;
      case 'subject':
        this.subject.set(value);
        break;
      case 'keywords':
        this.keywords.set(value);
        break;
      case 'creator':
        this.creator.set(value);
        break;
      case 'producer':
        this.producer.set(value);
        break;
      case 'creationDate':
        this.creationDate.set(value);
        break;
      case 'modificationDate':
        this.modificationDate.set(value);
        break;
    }
    this.scheduleHistoryPush();
  }

  onFieldBlur(): void {
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
      this.historyDebounceTimer = null;
    }
    this.commitCurrentStateToHistory();
  }

  private scheduleHistoryPush(): void {
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
    }
    this.historyDebounceTimer = setTimeout(() => {
      this.commitCurrentStateToHistory();
    }, 350);
  }

  private commitCurrentStateToHistory(): void {
    const current: MetadataFormState = {
      title: this.title(),
      author: this.author(),
      subject: this.subject(),
      keywords: this.keywords(),
      creator: this.creator(),
      producer: this.producer(),
      creationDate: this.creationDate(),
      modificationDate: this.modificationDate(),
    };

    const stack = this.history();
    const index = this.historyIndex();
    const last = stack[index];

    // Don't push identical duplicates
    if (
      last &&
      last.title === current.title &&
      last.author === current.author &&
      last.subject === current.subject &&
      last.keywords === current.keywords &&
      last.creator === current.creator &&
      last.producer === current.producer &&
      last.creationDate === current.creationDate &&
      last.modificationDate === current.modificationDate
    ) {
      return;
    }

    // Truncate future branch if user pushed after an undo
    const newStack = stack.slice(0, index + 1);
    newStack.push(current);
    this.history.set(newStack);
    this.historyIndex.set(newStack.length - 1);
  }

  undo(): void {
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
      this.historyDebounceTimer = null;
    }

    if (!this.canUndo()) return;
    const newIndex = this.historyIndex() - 1;
    this.historyIndex.set(newIndex);
    const targetState = this.history()[newIndex];
    this.setFormValues(targetState);
    this.toasts.info('Undid metadata change');
  }

  redo(): void {
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
      this.historyDebounceTimer = null;
    }

    if (!this.canRedo()) return;
    const newIndex = this.historyIndex() + 1;
    this.historyIndex.set(newIndex);
    const targetState = this.history()[newIndex];
    this.setFormValues(targetState);
    this.toasts.info('Redid metadata change');
  }

  revertToInitial(): void {
    const initial = this.initialMetadata();
    if (!initial) return;

    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
      this.historyDebounceTimer = null;
    }

    this.setFormValues(initial);
    this.commitCurrentStateToHistory();
    this.toasts.info('Reverted to original file metadata.');
  }

  stripMetadata(): void {
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
      this.historyDebounceTimer = null;
    }

    // Clear all metadata fields (without downloading)
    const stripped: MetadataFormState = {
      title: '',
      author: '',
      subject: '',
      keywords: '',
      creator: '',
      producer: '',
      creationDate: '',
      modificationDate: '',
    };

    this.setFormValues(stripped);
    this.commitCurrentStateToHistory();
    this.toasts.warning('All metadata cleared. Click "Save & Download PDF" to export.');
  }

  async saveMetadata(): Promise<void> {
    const file = this.loadedFile();
    if (!file) return;

    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
      this.historyDebounceTimer = null;
      this.commitCurrentStateToHistory();
    }

    this.saving.set(true);
    try {
      const bytes = new Uint8Array(file.data);

      const isAllEmpty =
        !this.title().trim() &&
        !this.author().trim() &&
        !this.subject().trim() &&
        !this.keywords().trim() &&
        !this.creator().trim() &&
        !this.producer().trim() &&
        !this.creationDate().trim() &&
        !this.modificationDate().trim();

      let updatedBytes: Uint8Array;
      if (isAllEmpty) {
        // Use thorough metadata stripping (removes all info entries and XMP)
        updatedBytes = await this.metaService.stripMetadata(bytes);
      } else {
        const initial = this.initialMetadata();

        // Creation date: preserve original unless user edited or cleared it
        const parsedCreationDate = this.creationDate().trim()
          ? this.parseDateTimeLocal(this.creationDate())
          : null;

        // Modification date:
        // 1. If user edited modificationDate field, use their explicit date (or null if cleared)
        // 2. If user didn't edit modificationDate field, but changed other fields, auto-set to new Date()
        // 3. Otherwise preserve initial modification date
        let parsedModDate: Date | null | undefined;
        if (this.modificationDate() !== (initial?.modificationDate ?? '')) {
          parsedModDate = this.modificationDate().trim()
            ? this.parseDateTimeLocal(this.modificationDate())
            : null;
        } else if (this.isModifiedFromInitial()) {
          parsedModDate = new Date();
        } else {
          parsedModDate = this.modificationDate().trim()
            ? this.parseDateTimeLocal(this.modificationDate())
            : null;
        }

        updatedBytes = await this.metaService.updateMetadata(bytes, {
          title: this.title(),
          author: this.author(),
          subject: this.subject(),
          keywords: this.keywords(),
          creator: this.creator(),
          producer: this.producer(),
          creationDate: parsedCreationDate,
          modificationDate: parsedModDate,
        });
      }

      const blob = new Blob([updatedBytes as BlobPart], { type: 'application/pdf' });
      const baseName = file.name.replace(/\.pdf$/i, '');
      const outSuffix = isAllEmpty ? '-sanitized.pdf' : '-updated-metadata.pdf';
      this.downloads.download(blob, `${baseName}${outSuffix}`);

      // Update in-memory file data and refresh technical specs
      this.loadedFile.update((f) =>
        f ? { ...f, data: updatedBytes.buffer as ArrayBuffer, sizeBytes: updatedBytes.byteLength } : null,
      );
      const newMeta = await this.metaService.readMetadata(updatedBytes);
      this.rawMetadata.set(newMeta);

      const newCDateStr = this.toDateTimeLocalString(newMeta.creationDate);
      const newMDateStr = this.toDateTimeLocalString(newMeta.modificationDate || newMeta.creationDate);

      // Refresh baseline to newly saved state
      const savedState: MetadataFormState = {
        title: newMeta.title,
        author: newMeta.author,
        subject: newMeta.subject,
        keywords: newMeta.keywords,
        creator: newMeta.creator,
        producer: newMeta.producer,
        creationDate: newCDateStr,
        modificationDate: newMDateStr,
      };
      this.setFormValues(savedState);
      this.initialMetadata.set(savedState);
      this.history.set([savedState]);
      this.historyIndex.set(0);

      this.toasts.success('Metadata saved and PDF downloaded successfully!');
    } catch (err) {
      console.error('[SecurityMetadataComponent] Failed to save metadata:', err);
      this.toasts.error('Failed to save metadata.');
    } finally {
      this.saving.set(false);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if (!this.loadedFile() || this.loading() || this.saving()) return;

    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    if (!isCtrlOrCmd) return;

    if (event.key.toLowerCase() === 'z') {
      if (event.shiftKey) {
        if (this.canRedo()) {
          event.preventDefault();
          this.redo();
        }
      } else {
        if (this.canUndo()) {
          event.preventDefault();
          this.undo();
        }
      }
    } else if (event.key.toLowerCase() === 'y') {
      if (this.canRedo()) {
        event.preventDefault();
        this.redo();
      }
    }
  }

  private setFormValues(state: MetadataFormState): void {
    this.title.set(state.title);
    this.author.set(state.author);
    this.subject.set(state.subject);
    this.keywords.set(state.keywords);
    this.creator.set(state.creator);
    this.producer.set(state.producer);
    this.creationDate.set(state.creationDate || '');
    this.modificationDate.set(state.modificationDate || '');
  }

  ngOnDestroy(): void {
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
      this.historyDebounceTimer = null;
    }
  }
}
