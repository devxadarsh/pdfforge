import { Injectable, signal, effect, inject } from '@angular/core';
import { EditorTheme } from '../models/pdf.models';

const THEME_KEY = 'ipdfeditor.theme';
const MOTION_KEY = 'ipdfeditor.reduce-motion';
const CONTRAST_KEY = 'ipdfeditor.high-contrast';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<EditorTheme>(this.readTheme());
  readonly reduceMotion = signal<boolean>(this.readMotion());
  readonly highContrast = signal<boolean>(this.readContrast());

  constructor() {
    effect(() => this.applyTheme(this.theme()));
    effect(() => this.applyMotion(this.reduceMotion()));
    effect(() => this.applyContrast(this.highContrast()));
  }

  setTheme(theme: EditorTheme): void {
    this.theme.set(theme);
  }

  toggleReduceMotion(): void {
    this.reduceMotion.update((v) => !v);
  }

  toggleHighContrast(): void {
    this.highContrast.update((v) => !v);
  }

  setHighContrast(contrast: boolean): void {
    this.highContrast.set(contrast);
  }

  private applyTheme(theme: EditorTheme): void {
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem(THEME_KEY, theme);
  }

  private applyMotion(reduce: boolean): void {
    document.documentElement.setAttribute('data-reduce-motion', String(reduce));
    localStorage.setItem(MOTION_KEY, String(reduce));
  }

  private applyContrast(contrast: boolean): void {
    document.documentElement.setAttribute('data-high-contrast', String(contrast));
    localStorage.setItem(CONTRAST_KEY, String(contrast));
  }

  private readTheme(): EditorTheme {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system';
  }

  private readMotion(): boolean {
    return localStorage.getItem(MOTION_KEY) === 'true';
  }

  private readContrast(): boolean {
    return localStorage.getItem(CONTRAST_KEY) === 'true';
  }
}
