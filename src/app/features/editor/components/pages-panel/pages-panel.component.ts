import {
  Component,
  inject,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { PanelSectionComponent } from '../../../../shared/components/panel/panel-section.component';
import { PageThumbnailComponent } from '../page-thumbnail/page-thumbnail.component';
import { EditorPagesService } from '../../state/editor-pages.service';
import { EditorStateService } from '../../state/editor-state.service';

/**
 * Self-contained left side panel for page management. Injects the shared editor
 * page/state services directly, so the editor shell only needs to drop in
 * `<app-pages-panel />` — future side modules follow the same pattern.
 */
@Component({
  selector: 'app-pages-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelSectionComponent, PageThumbnailComponent],
  templateUrl: './pages-panel.component.html',
  styleUrl: './pages-panel.component.scss',
})
export class PagesPanelComponent {
  readonly pages = inject(EditorPagesService);
  readonly collapse = output<void>();
  private readonly state = inject(EditorStateService);

  private dragId: string | null = null;

  rotateLeft(): void {
    this.pages.rotateSelected(-90);
  }

  rotateRight(): void {
    this.pages.rotateSelected(90);
  }

  duplicate(): void {
    this.pages.duplicateSelected();
  }

  deleteSelected(): void {
    const removed = this.pages.deleteSelected();
    if (removed.length) {
      this.state.pruneAnnotations(
        new Set(this.pages.pages().map((p) => p.id)),
      );
    }
  }

  extract(): void {
    void this.pages.extractSelected();
  }

  selectAll(): void {
    this.pages.selectAll();
  }

  clearSelection(): void {
    this.pages.clearSelection();
  }

  selectPage(id: string, event?: MouseEvent): void {
    this.pages.select(id, event);
  }

  /* Drag-and-drop reordering */
  onDragStart(id: string): void {
    this.dragId = id;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(id: string): void {
    if (this.dragId && this.dragId !== id) {
      const targetIndex = this.pages
        .pages()
        .findIndex((p) => p.id === id);
      if (targetIndex >= 0) {
        this.pages.move(this.dragId, targetIndex);
      }
    }
    this.dragId = null;
  }
}
