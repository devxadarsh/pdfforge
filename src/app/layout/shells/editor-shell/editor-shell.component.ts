import {
  Component,
  computed,
  inject,
  signal,
  HostListener,
  OnInit,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgClass } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { FileService } from '../../../core/services/file/file.service';
import { ToastService } from '../../../core/services/toast.service';
import { DialogService } from '../../../core/services/dialog.service';
import {
  RecentFilesService,
  RecentFileEntry,
} from '../../../core/services/storage/recent-files.service';
import { DocumentStorageService } from '../../../core/services/storage/document-storage.service';
import { formatRelativeTime } from '../../../core/utilities/time.util';
import { LoadedFile } from '../../../core/models/file.models';
import { EditorStateService } from '../../../features/editor/state/editor-state.service';

interface EditorNavItem {
  readonly label: string;
  readonly path: string;
}

@Component({
  selector: 'app-editor-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgClass],
  templateUrl: './editor-shell.component.html',
  styleUrl: './editor-shell.component.scss',
})
export class EditorShellComponent implements OnInit {
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly files = inject(FileService);
  private readonly toasts = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly state = inject(EditorStateService);
  private readonly recentFiles = inject(RecentFilesService);
  private readonly storage = inject(DocumentStorageService);

  readonly hasDocument = computed(
    () => this.files.currentFiles().length > 0,
  );
  readonly isExporting = this.state.isExporting;
  readonly modified = this.state.modified;

  readonly documentName = computed(
    () => this.files.currentFiles()[0]?.name ?? 'Untitled document',
  );

  readonly recentEntries = signal<RecentFileEntry[]>([]);
  readonly showRecentDropdown = signal<boolean>(false);
  readonly recentSearch = signal<string>('');

  readonly currentDocName = computed(
    () => this.files.currentFiles()[0]?.name ?? '',
  );

  readonly filteredRecentEntries = computed(() => {
    const q = this.recentSearch().trim().toLowerCase();
    const currentName = this.currentDocName().trim().toLowerCase();
    let list = this.recentEntries();

    // Filter out the currently opened file
    if (currentName) {
      list = list.filter((e) => e.name.toLowerCase() !== currentName);
    }

    if (!q) {
      return list;
    }
    return list.filter((e) => e.name.toLowerCase().includes(q));
  });

  readonly editorNav: EditorNavItem[] = [
    { label: 'Edit', path: '/editor' },
    { label: 'Merge', path: '/merge' },
    { label: 'Split', path: '/split' },
    { label: 'Convert', path: '/convert' },
    { label: 'Compress', path: '/compress' },
  ];

  readonly themeIcon = () => {
    switch (this.theme.theme()) {
      case 'light':
        return 'fa-solid fa-sun';
      case 'dark':
        return 'fa-solid fa-moon';
      default:
        return 'fa-solid fa-circle-half-stroke';
    }
  };

  readonly canUndo = this.state.canUndo;
  readonly canRedo = this.state.canRedo;
  readonly undoLabel = this.state.undoLabel;
  readonly redoLabel = this.state.redoLabel;

  async ngOnInit(): Promise<void> {
    await this.loadRecentEntries();
  }

  async loadRecentEntries(): Promise<void> {
    const list = await this.recentFiles.getAll();
    this.recentEntries.set(list);
  }

  getRelativeTime(timestamp: number): string {
    return formatRelativeTime(timestamp);
  }

  toggleRecentDropdown(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.showRecentDropdown()) {
      void this.loadRecentEntries();
    }
    this.showRecentDropdown.update((v) => !v);
  }

  closeRecentDropdown(): void {
    this.showRecentDropdown.set(false);
    this.recentSearch.set('');
  }

  onSearchInput(value: string): void {
    this.recentSearch.set(value);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showRecentDropdown()) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.editor-shell__open-group')) {
        this.closeRecentDropdown();
      }
    }
  }

  async togglePin(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.recentFiles.togglePin(id);
    await this.loadRecentEntries();
  }

  async removeRecentEntry(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.recentFiles.remove(id);
    await this.loadRecentEntries();
  }

  async openFile(): Promise<void> {
    this.closeRecentDropdown();
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

    const picked = await this.files.pickFile(false);
    if (picked.length > 0) {
      await this.files.loadFiles(picked);
    }
  }

  async openRecentEntry(entry: RecentFileEntry): Promise<void> {
    this.closeRecentDropdown();
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
      return;
    }

    // 3. Fallback: Prompt user if file data is not available
    this.toasts.info(`Please select "${entry.name}" from your device.`);
    const picked = await this.files.pickFile(false);
    if (picked.length > 0) {
      await this.files.loadFiles(picked);
    }
  }

  async back(): Promise<void> {
    if (this.state.modified()) {
      const result = await this.dialog.confirm({
        title: 'Unsaved Changes',
        message:
          'You have unsaved edits in this document. What would you like to do before leaving?',
        confirmLabel: 'Save & Exit',
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
    void this.router.navigate(['/']);
  }

  async onNavClick(event: MouseEvent, path: string): Promise<void> {
    if (path === '/editor') {
      return;
    }
    if (this.state.modified()) {
      event.preventDefault();
      const result = await this.dialog.confirm({
        title: 'Unsaved Changes',
        message:
          'You have unsaved edits in this document. What would you like to do before leaving?',
        confirmLabel: 'Save & Leave',
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
      void this.router.navigateByUrl(path);
    }
  }

  undo(): void {
    const res = this.state.undo();
    if (res.success && res.description) {
      this.toasts.info(`Undone: ${res.description}`);
    }
  }

  redo(): void {
    const res = this.state.redo();
    if (res.success && res.description) {
      this.toasts.info(`Redone: ${res.description}`);
    }
  }

  cycleTheme(): void {
    const order = ['system', 'light', 'dark'] as const;
    const idx = order.indexOf(this.theme.theme());
    this.theme.setTheme(order[(idx + 1) % order.length]);
  }

  download(): void {
    this.state.requestExport();
  }
}
