import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { EditorTheme } from '../../core/models/pdf.models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, NgClass],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly themeSvc = inject(ThemeService);
  readonly theme = this.themeSvc.theme;
  readonly reduceMotion = this.themeSvc.reduceMotion;
  readonly themeOptions: { value: EditorTheme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  setTheme(value: EditorTheme): void {
    this.themeSvc.setTheme(value);
  }

  toggleMotion(): void {
    this.themeSvc.toggleReduceMotion();
  }
}
