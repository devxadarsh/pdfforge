import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { RecentFilesService } from '../../core/services/storage/recent-files.service';
import { DocumentStorageService } from '../../core/services/storage/document-storage.service';
import { ToastService } from '../../core/services/toast.service';
import { DialogService } from '../../core/services/dialog.service';
import { DownloadService } from '../../core/services/download/download.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { EditorTheme } from '../../core/models/pdf.models';
import { formatBytes } from '../../core/utilities/file.util';

const DEFAULT_ZOOM_KEY = 'ipdfeditor.default-zoom';
const AUTO_SAVE_KEY = 'ipdfeditor.auto-save';
const THUMBNAILS_KEY = 'ipdfeditor.show-thumbnails';
const DEFAULT_COLOR_KEY = 'ipdfeditor.default-color';
const DEFAULT_FONT_SIZE_KEY = 'ipdfeditor.default-font-size';
const DEFAULT_SUFFIX_KEY = 'ipdfeditor.default-export-suffix';

export interface ExportedSettingsConfig {
  readonly version: number;
  readonly exportedAt: string;
  readonly app: string;
  readonly settings: {
    readonly theme: EditorTheme;
    readonly reduceMotion: boolean;
    readonly highContrast: boolean;
    readonly defaultZoom: string;
    readonly autoSave: boolean;
    readonly showThumbnails: boolean;
    readonly defaultColor: string;
    readonly defaultFontSize: string;
    readonly defaultExportSuffix: string;
  };
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, NgClass],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly themeSvc = inject(ThemeService);
  private readonly recentFilesSvc = inject(RecentFilesService);
  private readonly docStorageSvc = inject(DocumentStorageService);
  private readonly toasts = inject(ToastService);
  private readonly dialogSvc = inject(DialogService);
  private readonly downloadSvc = inject(DownloadService);
  private readonly seo = inject(SeoService);

  readonly theme = this.themeSvc.theme;
  readonly reduceMotion = this.themeSvc.reduceMotion;
  readonly highContrast = this.themeSvc.highContrast;

  readonly defaultZoom = signal<string>(
    localStorage.getItem(DEFAULT_ZOOM_KEY) || 'fit-width',
  );
  readonly autoSave = signal<boolean>(
    localStorage.getItem(AUTO_SAVE_KEY) !== 'false',
  );
  readonly showThumbnails = signal<boolean>(
    localStorage.getItem(THUMBNAILS_KEY) !== 'false',
  );

  readonly defaultColor = signal<string>(
    localStorage.getItem(DEFAULT_COLOR_KEY) || '#2563eb',
  );
  readonly defaultFontSize = signal<string>(
    localStorage.getItem(DEFAULT_FONT_SIZE_KEY) || '16',
  );
  readonly defaultExportSuffix = signal<string>(
    localStorage.getItem(DEFAULT_SUFFIX_KEY) || '-edited',
  );

  readonly storageUsage = signal<{ used: string; quota: string }>({
    used: 'Calculating…',
    quota: 'Unlimited',
  });
  readonly storagePercent = signal<number>(0);
  readonly recentFilesCount = signal<number>(0);
  readonly hasActiveDraft = signal<boolean>(false);

  readonly clearingRecent = signal<boolean>(false);
  readonly clearingDoc = signal<boolean>(false);

  readonly themeOptions: {
    value: EditorTheme;
    label: string;
    description: string;
    icon: string;
  }[] = [
    {
      value: 'light',
      label: 'Light',
      description: 'Clean paper-white surface with high contrast readability',
      icon: 'fa-solid fa-sun',
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Deep navy-slate canvas gentle on eyes in dim environments',
      icon: 'fa-solid fa-moon',
    },
    {
      value: 'system',
      label: 'System Sync',
      description: 'Automatically matches your operating system appearance',
      icon: 'fa-solid fa-circle-half-stroke',
    },
  ];

  readonly zoomOptions = [
    { value: 'fit-width', label: 'Fit to Width' },
    { value: 'fit-page', label: 'Fit to Page' },
    { value: '100%', label: 'Actual Size (100%)' },
    { value: '125%', label: 'Enlarged (125%)' },
    { value: '150%', label: 'High Zoom (150%)' },
  ];

  readonly colorOptions = [
    { value: '#2563eb', label: 'Classic Blue' },
    { value: '#111827', label: 'Dark Charcoal' },
    { value: '#dc2626', label: 'Crimson Red' },
    { value: '#16a34a', label: 'Forest Green' },
    { value: '#d97706', label: 'Warm Amber' },
    { value: '#9333ea', label: 'Vibrant Purple' },
  ];

  readonly fontSizeOptions = [
    { value: '12', label: '12px (Small)' },
    { value: '14', label: '14px (Normal)' },
    { value: '16', label: '16px (Medium)' },
    { value: '20', label: '20px (Large)' },
  ];

  readonly suffixOptions = [
    { value: '-edited', label: '-edited' },
    { value: '-signed', label: '-signed' },
    { value: '-processed', label: '-processed' },
    { value: '-final', label: '-final' },
  ];

  readonly shortcutGroups = [
    {
      category: 'Tools & Selection',
      icon: 'fa-solid fa-pen-ruler',
      items: [
        { key: 'V', desc: 'Select Tool (Move & Resize annotations)' },
        { key: 'H', desc: 'Hand Tool (Pan & navigate page canvas)' },
        { key: 'T', desc: 'Text Tool (Add editable overlay text)' },
        { key: 'P', desc: 'Freehand Pen Drawing Tool' },
        { key: 'S', desc: 'Shapes Tool (Rectangle, Circle, Line)' },
        { key: 'I', desc: 'Icons & Stamp Badges Tool' },
        { key: 'E', desc: 'Eraser Tool' },
        { key: 'Shift + H', desc: 'Highlight Text Tool' },
      ],
    },
    {
      category: 'Document Actions',
      icon: 'fa-solid fa-file-pdf',
      items: [
        { key: 'Ctrl / ⌘ + O', desc: 'Open PDF file from device' },
        { key: 'Ctrl / ⌘ + S', desc: 'Export & Download edited PDF' },
        { key: 'Ctrl / ⌘ + Z', desc: 'Undo last action' },
        { key: 'Ctrl / ⌘ + ⇧ + Z', desc: 'Redo previously undone action' },
        { key: 'Ctrl / ⌘ + F', desc: 'Search text inside document' },
        { key: 'Delete / ⌫', desc: 'Delete selected element' },
        { key: 'Esc', desc: 'Deselect / Cancel active placement' },
      ],
    },
    {
      category: 'View & Navigation',
      icon: 'fa-solid fa-magnifying-glass-plus',
      items: [
        { key: 'Ctrl / ⌘ + Scroll', desc: 'Smoothly zoom in / out' },
        { key: 'Space + Drag', desc: 'Hold spacebar to pan document canvas' },
        { key: '← / →', desc: 'Navigate to Previous / Next page' },
        { key: 'Home / End', desc: 'Jump to First / Last page' },
      ],
    },
  ];

  ngOnInit(): void {
    this.seo.setNoIndex('Settings');
    void this.calculateStorage();
  }

  setTheme(value: EditorTheme): void {
    this.themeSvc.setTheme(value);
    this.toasts.info(`Appearance theme set to ${value}.`);
  }

  toggleMotion(): void {
    this.themeSvc.toggleReduceMotion();
    const active = this.reduceMotion();
    this.toasts.info(
      active ? 'Reduced motion enabled.' : 'Standard animations restored.',
    );
  }

  toggleHighContrast(): void {
    this.themeSvc.toggleHighContrast();
    const active = this.highContrast();
    this.toasts.info(
      active
        ? 'High contrast mode enabled for improved visual distinction.'
        : 'Standard contrast restored.',
    );
  }

  setDefaultZoom(zoom: string): void {
    this.defaultZoom.set(zoom);
    localStorage.setItem(DEFAULT_ZOOM_KEY, zoom);
    this.toasts.success('Default zoom preference saved.');
  }

  toggleAutoSave(): void {
    const next = !this.autoSave();
    this.autoSave.set(next);
    localStorage.setItem(AUTO_SAVE_KEY, String(next));
    this.toasts.info(
      next
        ? 'Auto-save enabled for editor workspaces.'
        : 'Auto-save disabled.',
    );
  }

  toggleThumbnails(): void {
    const next = !this.showThumbnails();
    this.showThumbnails.set(next);
    localStorage.setItem(THUMBNAILS_KEY, String(next));
    this.toasts.info(
      next
        ? 'Thumbnail panel will open automatically.'
        : 'Thumbnail panel will start collapsed.',
    );
  }

  setDefaultColor(color: string): void {
    this.defaultColor.set(color);
    localStorage.setItem(DEFAULT_COLOR_KEY, color);
    this.toasts.success('Default annotation color updated.');
  }

  setDefaultFontSize(size: string): void {
    this.defaultFontSize.set(size);
    localStorage.setItem(DEFAULT_FONT_SIZE_KEY, size);
    this.toasts.success('Default annotation font size updated.');
  }

  setDefaultExportSuffix(suffix: string): void {
    this.defaultExportSuffix.set(suffix);
    localStorage.setItem(DEFAULT_SUFFIX_KEY, suffix);
    this.toasts.success('Default export suffix updated.');
  }

  async calculateStorage(): Promise<void> {
    try {
      const recentEntries = await this.recentFilesSvc.getAll().catch(() => []);
      this.recentFilesCount.set(recentEntries.length);

      const hasDraft = await this.docStorageSvc.hasDocument().catch(() => false);
      this.hasActiveDraft.set(hasDraft);

      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percent = quota > 0 ? Math.min(100, Math.round((usage / quota) * 100)) : 0;
        this.storagePercent.set(percent);
        this.storageUsage.set({
          used: formatBytes(usage),
          quota: quota > 0 ? formatBytes(quota) : 'Device Limit',
        });
      } else {
        this.storagePercent.set(0);
        this.storageUsage.set({
          used: 'Browser Local Storage',
          quota: 'Device Limit',
        });
      }
    } catch {
      this.storagePercent.set(0);
      this.storageUsage.set({
        used: 'Available',
        quota: 'Device Limit',
      });
    }
  }

  async clearRecentFiles(): Promise<void> {
    const res = await this.dialogSvc.confirm({
      title: 'Clear Recent Documents History?',
      message: 'This will remove all recent PDF records and previews from this browser. Your actual downloaded files on your computer will not be touched.',
      destructive: true,
      confirmLabel: 'Clear History',
      cancelLabel: 'Keep History',
    });
    if (!res.confirmed) return;

    this.clearingRecent.set(true);
    try {
      await this.recentFilesSvc.clearAll();
      await this.calculateStorage();
      this.toasts.success('All recent documents cleared from browser history.');
    } catch (err) {
      console.error('[SettingsComponent] Failed to clear recent files:', err);
      this.toasts.error('Failed to clear recent files.');
    } finally {
      this.clearingRecent.set(false);
    }
  }

  async clearPersistedDocument(): Promise<void> {
    const res = await this.dialogSvc.confirm({
      title: 'Purge Cached Active Document?',
      message: 'This will delete the last auto-saved working draft and temporary session cache from IndexedDB.',
      destructive: true,
      confirmLabel: 'Purge Cache',
      cancelLabel: 'Cancel',
    });
    if (!res.confirmed) return;

    this.clearingDoc.set(true);
    try {
      await this.docStorageSvc.clearDocument();
      await this.calculateStorage();
      this.toasts.success('Active document cache removed from browser memory.');
    } catch (err) {
      console.error('[SettingsComponent] Failed to clear document cache:', err);
      this.toasts.error('Failed to clear document cache.');
    } finally {
      this.clearingDoc.set(false);
    }
  }

  async resetAllData(): Promise<void> {
    const res = await this.dialogSvc.confirm({
      title: 'Reset All Settings & Local Storage?',
      message: 'Are you sure you want to reset all local preferences and clear all stored document caches? This action cannot be undone.',
      destructive: true,
      confirmLabel: 'Reset Everything',
      cancelLabel: 'Cancel',
    });
    if (!res.confirmed) return;

    try {
      await this.recentFilesSvc.clearAll();
      await this.docStorageSvc.clearDocument();
      localStorage.removeItem(DEFAULT_ZOOM_KEY);
      localStorage.removeItem(AUTO_SAVE_KEY);
      localStorage.removeItem(THUMBNAILS_KEY);
      localStorage.removeItem(DEFAULT_COLOR_KEY);
      localStorage.removeItem(DEFAULT_FONT_SIZE_KEY);
      localStorage.removeItem(DEFAULT_SUFFIX_KEY);

      this.themeSvc.setTheme('system');
      this.themeSvc.setHighContrast(false);
      this.defaultZoom.set('fit-width');
      this.autoSave.set(true);
      this.showThumbnails.set(true);
      this.defaultColor.set('#2563eb');
      this.defaultFontSize.set('16');
      this.defaultExportSuffix.set('-edited');

      await this.calculateStorage();
      this.toasts.success('All local settings and document caches have been reset.');
    } catch (err) {
      console.error('[SettingsComponent] Failed to reset data:', err);
      this.toasts.error('Failed to complete reset.');
    }
  }

  exportSettings(): void {
    const config: ExportedSettingsConfig = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: 'iPDFEditor',
      settings: {
        theme: this.theme(),
        reduceMotion: this.reduceMotion(),
        highContrast: this.highContrast(),
        defaultZoom: this.defaultZoom(),
        autoSave: this.autoSave(),
        showThumbnails: this.showThumbnails(),
        defaultColor: this.defaultColor(),
        defaultFontSize: this.defaultFontSize(),
        defaultExportSuffix: this.defaultExportSuffix(),
      },
    };

    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    this.downloadSvc.download(blob, 'ipdfeditor-settings.json');
    this.toasts.success('Configuration exported to ipdfeditor-settings.json');
  }

  async importSettings(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<ExportedSettingsConfig>;

      if (!parsed.settings || typeof parsed.settings !== 'object') {
        throw new Error('Invalid configuration format');
      }

      const s = parsed.settings;
      if (s.theme) this.setTheme(s.theme);
      if (typeof s.reduceMotion === 'boolean') {
        if (s.reduceMotion !== this.reduceMotion()) this.toggleMotion();
      }
      if (typeof s.highContrast === 'boolean') {
        this.themeSvc.setHighContrast(s.highContrast);
      }
      if (s.defaultZoom) this.setDefaultZoom(s.defaultZoom);
      if (typeof s.autoSave === 'boolean') {
        this.autoSave.set(s.autoSave);
        localStorage.setItem(AUTO_SAVE_KEY, String(s.autoSave));
      }
      if (typeof s.showThumbnails === 'boolean') {
        this.showThumbnails.set(s.showThumbnails);
        localStorage.setItem(THUMBNAILS_KEY, String(s.showThumbnails));
      }
      if (s.defaultColor) this.setDefaultColor(s.defaultColor);
      if (s.defaultFontSize) this.setDefaultFontSize(s.defaultFontSize);
      if (s.defaultExportSuffix) this.setDefaultExportSuffix(s.defaultExportSuffix);

      this.toasts.success('Settings restored successfully from backup!');
    } catch {
      this.toasts.error('Failed to import settings. Please choose a valid JSON backup.');
    } finally {
      input.value = '';
    }
  }
}
