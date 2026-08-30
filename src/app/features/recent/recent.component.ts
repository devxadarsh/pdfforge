import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RecentFilesService, RecentFileEntry } from '../../core/services/storage/recent-files.service';
import { FileService } from '../../core/services/file/file.service';
import { DocumentStorageService } from '../../core/services/storage/document-storage.service';
import { ToastService } from '../../core/services/toast.service';
import { DialogService } from '../../core/services/dialog.service';
import { EditorStateService } from '../editor/state/editor-state.service';
import { formatRelativeTime } from '../../core/utilities/time.util';
import { formatBytes } from '../../core/utilities/file.util';
import { LoadedFile } from '../../core/models/file.models';

@Component({
  selector: 'app-recent',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './recent.component.html',
  styleUrl: './recent.component.scss'
})
export class RecentComponent implements OnInit {
  private readonly recentFiles = inject(RecentFilesService);
  private readonly files = inject(FileService);
  private readonly storage = inject(DocumentStorageService);
  private readonly toasts = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly state = inject(EditorStateService);
  private readonly router = inject(Router);

  readonly entries = signal<RecentFileEntry[]>([]);
  readonly loading = signal(true);
  readonly searchQuery = signal<string>('');
  readonly sortBy = signal<'recent' | 'name' | 'pinned'>('recent');

  readonly currentDocName = computed(
    () => this.files.currentFiles()[0]?.name ?? '',
  );
  readonly isModified = this.state.modified;

  readonly filteredEntries = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const currentName = this.currentDocName().trim().toLowerCase();
    let list = this.entries();

    if (currentName) {
      list = list.filter((e) => e.name.toLowerCase() !== currentName);
    }

    if (q) {
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }

    const sort = this.sortBy();
    return [...list].sort((a, b) => {
      if (sort === 'pinned') {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.lastOpenedAt - a.lastOpenedAt;
      }
      if (sort === 'name') {
        return a.name.localeCompare(b.name);
      }
      // 'recent'
      return b.lastOpenedAt - a.lastOpenedAt;
    });
  });

  async ngOnInit(): Promise<void> {
    await this.loadEntries();
  }

  async loadEntries(): Promise<void> {
    this.loading.set(true);
    const list = await this.recentFiles.getAll();
    this.entries.set(list);
    this.loading.set(false);
  }

  getRelativeTime(timestamp: number): string {
    return formatRelativeTime(timestamp);
  }

  formatSize(bytes: number): string {
    return formatBytes(bytes);
  }

  onSearchChange(val: string): void {
    this.searchQuery.set(val);
  }

  setSortBy(sort: 'recent' | 'name' | 'pinned'): void {
    this.sortBy.set(sort);
  }

  async togglePin(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.recentFiles.togglePin(id);
    await this.loadEntries();
  }

  async removeEntry(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.recentFiles.remove(id);
    await this.loadEntries();
    this.toasts.info('Removed file from recent list.');
  }

  async clearAll(): Promise<void> {
    const result = await this.dialog.confirm({
      title: 'Clear Recent Documents',
      message:
        'Are you sure you want to clear all recent files? Pinned and unpinned files will be removed from recent history.',
      confirmLabel: 'Clear All',
      cancelLabel: 'Cancel',
      destructive: true,
    });

    if (result.confirmed) {
      await this.recentFiles.clearAll();
      await this.loadEntries();
      this.toasts.info('Cleared recent document history.');
    }
  }

  async openEntry(entry: RecentFileEntry): Promise<void> {
    if (this.state.modified()) {
      const result = await this.dialog.confirm({
        title: 'Unsaved Changes',
        message:
          'You have unsaved edits in this document. What would you like to do?',
        confirmLabel: 'Save & Open',
        secondaryLabel: "Don't Save",
        cancelLabel: 'Cancel',
        destructive: false,
      });

      if (!result.confirmed && !result.secondary) {
        return;
      }

      if (result.confirmed) {
        const saved = await this.state.saveLocally();
        if (!saved) {
          return;
        }
      }
    }

    // 1. Load document data directly from RecentFilesService
    const recentDoc = await this.recentFiles.getFileData(entry.id) ?? await this.recentFiles.getFileDataByName(entry.name);
    if (recentDoc && recentDoc.data) {
      const blob = new Blob([recentDoc.data], { type: 'application/pdf' });
      const file = new File([blob], recentDoc.name, { type: 'application/pdf' });
      const loaded: LoadedFile = {
        file,
        name: recentDoc.name,
        sizeBytes: recentDoc.data.byteLength,
        data: recentDoc.data,
        loadedAt: Date.now(),
        editorState: recentDoc.editorState,
      };
      this.files.setCurrent([loaded]);
      void this.router.navigate(['/editor']);
      return;
    }

    // 2. Fallback: Check last-document in storage
    const lastDoc = await this.storage.loadDocument();
    if (lastDoc && lastDoc.name.toLowerCase() === entry.name.toLowerCase()) {
      const blob = new Blob([lastDoc.data], { type: 'application/pdf' });
      const file = new File([blob], lastDoc.name, { type: 'application/pdf' });
      const loaded: LoadedFile = {
        file,
        name: lastDoc.name,
        sizeBytes: lastDoc.data.byteLength,
        data: lastDoc.data,
        loadedAt: Date.now(),
        editorState: lastDoc.editorState,
      };
      this.files.setCurrent([loaded]);
      void this.router.navigate(['/editor']);
      return;
    }

    // 3. Fallback: Prompt user if file data is not available
    this.toasts.info(`Please select "${entry.name}" from your device.`);
    const picked = await this.files.pickFile(false);
    if (picked.length > 0) {
      await this.files.openInEditor(picked);
    }
  }
}
