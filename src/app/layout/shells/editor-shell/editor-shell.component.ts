import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgClass } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { FileService } from '../../../core/services/file/file.service';

interface EditorNavItem {
  readonly label: string;
  readonly path: string;
}

@Component({
    selector: 'app-editor-shell',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, NgClass],
    templateUrl: './editor-shell.component.html',
    styleUrl: './editor-shell.component.scss'
})
export class EditorShellComponent {
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly files = inject(FileService);

  readonly documentName = computed(
    () => this.files.currentFiles()[0]?.name ?? 'Untitled document',
  );

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

  back(): void {
    void this.router.navigate(['/']);
  }

  cycleTheme(): void {
    const order = ['system', 'light', 'dark'] as const;
    const idx = order.indexOf(this.theme.theme());
    this.theme.setTheme(order[(idx + 1) % order.length]);
  }
}
