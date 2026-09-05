import {
  Component,
  inject,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { PanelSectionComponent } from '../../../../shared/components/panel/panel-section.component';
import { PageThumbnailComponent } from '../page-thumbnail/page-thumbnail.component';
import { EditorPagesService } from '../../state/editor-pages.service';
import { EditorStateService } from '../../state/editor-state.service';
import { EditorPage } from '../../models/editor-page.model';

/**
 * Self-contained left side panel for page management. Injects the shared editor
 * page/state services directly, enhanced with Angular CDK Drag-Drop and Virtual Scrolling.
 */
@Component({
  selector: 'app-pages-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DragDropModule,
    PanelSectionComponent,
    PageThumbnailComponent,
  ],
  templateUrl: './pages-panel.component.html',
  styleUrl: './pages-panel.component.scss',
})
export class PagesPanelComponent {
  readonly pages = inject(EditorPagesService);
  readonly collapse = output<void>();
  readonly pageSelect = output<string>();
  private readonly state = inject(EditorStateService);

  rotateLeft(): void {
    this.state.pushHistorySnapshot('Rotate Page Left');
    this.pages.rotateSelected(-90);
  }

  rotateRight(): void {
    this.state.pushHistorySnapshot('Rotate Page Right');
    this.pages.rotateSelected(90);
  }

  duplicate(): void {
    this.state.pushHistorySnapshot('Duplicate Page');
    this.pages.duplicateSelected();
  }

  deleteSelected(): void {
    this.state.pushHistorySnapshot('Delete Page');
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
    this.pageSelect.emit(id);
  }

  /* CDK Drag-and-drop reordering */
  onCdkDrop(event: CdkDragDrop<EditorPage[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    this.state.pushHistorySnapshot('Reorder Pages');
    const list = [...this.pages.pages()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.pages.restoreState(list, this.pages.selected(), this.pages.currentId());
  }

  trackByPageId(index: number, page: EditorPage): string {
    return page.id;
  }
}
