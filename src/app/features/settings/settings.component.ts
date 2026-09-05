import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { RecentFilesService } from '../../core/services/storage/recent-files.service';
import { DocumentStorageService } from '../../core/services/storage/document-storage.service';
import { ToastService } from '../../core/services/toast.service';
import { EditorTheme } from '../../core/models/pdf.models';
import { formatBytes } from '../../core/utilities/file.util';

const DEFAULT_ZOOM_KEY = 'pdfforge.default-zoom';
const AUTO_SAVE_KEY = 'pdfforge.auto-save';
const THUMBNAILS_KEY = 'pdfforge.show-thumbnails';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink, FormsModule, NgClass],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly themeSvc = inject(ThemeService);
  private readonly recentFilesSvc = inject(RecentFilesService);
  private readonly docStorageSvc = inject(DocumentStorageService);
  private readonly toasts = inject(ToastService);

  readonly theme = this.themeSvc.theme;
  readonly reduceMotion = this.themeSvc.reduceMotion;

  readonly defaultZoom = signal<string>(
    localStorage.getItem(DEFAULT_ZOOM_KEY) || 'fit-width',
  );
  readonly autoSave = signal<boolean>(
    localStorage.getItem(AUTO_SAVE_KEY) !== 'false',
  );
  readonly showThumbnails = signal<boolean>(
    localStorage.getItem(THUMBNAILS_KEY) !== 'false',
  );

  readonly storageUsage = signal<{ used: string; quota: string }>({
    used: 'Calculating…',
    quota: 'Unlimited',
  });
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

  ngOnInit(): void {
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

  async calculateStorage(): Promise<void> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        this.storageUsage.set({
          used: formatBytes(usage),
          quota: quota > 0 ? formatBytes(quota) : 'Device Limit',
        });
      } else {
        this.storageUsage.set({
          used: 'Browser Local Storage',
          quota: 'Device Limit',
        });
      }
    } catch {
      this.storageUsage.set({
        used: 'Available',
        quota: 'Device Limit',
      });
    }
  }

  async clearRecentFiles(): Promise<void> {
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
    const confirmed = window.confirm(
      'Are you sure you want to reset all local preferences and clear all stored documents? This cannot be undone.',
    );
    if (!confirmed) return;

    try {
      await this.recentFilesSvc.clearAll();
      await this.docStorageSvc.clearDocument();
      localStorage.removeItem(DEFAULT_ZOOM_KEY);
      localStorage.removeItem(AUTO_SAVE_KEY);
      localStorage.removeItem(THUMBNAILS_KEY);

      this.defaultZoom.set('fit-width');
      this.autoSave.set(true);
      this.showThumbnails.set(true);
      await this.calculateStorage();
      this.toasts.success('All local settings and document caches have been reset.');
    } catch (err) {
      console.error('[SettingsComponent] Failed to reset data:', err);
      this.toasts.error('Failed to complete reset.');
    }
  }
}
