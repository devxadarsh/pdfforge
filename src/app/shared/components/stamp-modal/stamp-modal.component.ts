import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface StampResult {
  readonly text: string;
  readonly color: string;
}

export interface StampPreset {
  readonly text: string;
  readonly color: string;
  readonly category: 'approval' | 'status' | 'confidentiality' | 'review';
}

export const STAMP_PRESETS: ReadonlyArray<StampPreset> = [
  { text: 'APPROVED', color: '#16a34a', category: 'approval' },
  { text: 'REJECTED', color: '#dc2626', category: 'approval' },
  { text: 'CONFIDENTIAL', color: '#dc2626', category: 'confidentiality' },
  { text: 'DRAFT', color: '#ea580c', category: 'status' },
  { text: 'FINAL', color: '#2563eb', category: 'status' },
  { text: 'PAID', color: '#16a34a', category: 'status' },
  { text: 'VOID', color: '#991b1b', category: 'status' },
  { text: 'COMPLETED', color: '#0d9488', category: 'approval' },
  { text: 'FOR REVIEW', color: '#9333ea', category: 'review' },
  { text: 'URGENT', color: '#e11d48', category: 'status' },
  { text: 'OFFICIAL', color: '#1e40af', category: 'confidentiality' },
  { text: 'COPY', color: '#4b5563', category: 'status' },
];

@Component({
  selector: 'app-stamp-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stamp-modal.component.html',
  styleUrl: './stamp-modal.component.scss',
})
export class StampModalComponent {
  readonly stampSelected = output<StampResult>();
  readonly closed = output<void>();

  readonly activeTab = signal<'preset' | 'custom'>('preset');
  readonly presets = STAMP_PRESETS;
  readonly selectedPreset = signal<StampPreset>(STAMP_PRESETS[0]);

  // Custom Stamp State
  readonly customText = signal<string>('VERIFIED');
  readonly customColor = signal<string>('#dc2626');
  readonly includeDate = signal<boolean>(false);
  readonly stampColorPalette = [
    '#dc2626', // Red
    '#16a34a', // Green
    '#2563eb', // Blue
    '#ea580c', // Orange
    '#9333ea', // Purple
    '#0d9488', // Teal
    '#4b5563', // Dark Gray
    '#111827', // Black
  ];

  getFormattedCustomText(): string {
    const base = this.customText().trim().toUpperCase();
    if (!this.includeDate()) {
      return base || 'STAMP';
    }
    const today = new Date().toISOString().slice(0, 10);
    return `${base} • ${today}`;
  }

  selectPreset(preset: StampPreset): void {
    this.selectedPreset.set(preset);
  }

  applyAndClose(): void {
    if (this.activeTab() === 'preset') {
      const p = this.selectedPreset();
      this.stampSelected.emit({
        text: p.text,
        color: p.color,
      });
    } else {
      const text = this.getFormattedCustomText();
      this.stampSelected.emit({
        text,
        color: this.customColor(),
      });
    }
  }

  close(): void {
    this.closed.emit();
  }
}
