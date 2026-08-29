import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgClass } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { FileService } from '../../../core/services/file/file.service';
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
    styleUrl: './editor-shell.component.scss'
})
export class EditorShellComponent {
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly files = inject(FileService);
  private readonly state = inject(EditorStateService);

  readonly hasDocument = computed(
    () => this.files.currentFiles().length > 0,
  );
  readonly isExporting = this.state.isExporting;

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

  readonly canUndo = this.state.canUndo;
  readonly canRedo = this.state.canRedo;

  back(): void {
    void this.router.navigate(['/']);
  }

  undo(): void {
    this.state.undo();
  }

  redo(): void {
    this.state.redo();
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
