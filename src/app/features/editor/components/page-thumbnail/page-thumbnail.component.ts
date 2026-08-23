import {
  Component,
  ElementRef,
  viewChild,
  effect,
  input,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { PdfViewerService } from '../../../../core/services/pdf/pdf-viewer.service';

@Component({
  selector: 'app-page-thumbnail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="thumb"
      [class.thumb--active]="active()"
      [class.thumb--current]="current()"
      [attr.aria-label]="'Go to page ' + (pageIndex() + 1)"
    >
      <canvas #canvas></canvas>
      <span class="thumb__page">{{ pageIndex() + 1 }}</span>
    </button>
  `,
  styles: [
    `
      .thumb {
        position: relative;
        display: block;
        width: 100%;
        padding: 0;
        border: 2px solid var(--pf-outline-variant);
        border-radius: var(--pf-radius);
        background: #ffffff;
        cursor: pointer;
        overflow: hidden;
        transition: border-color 0.15s ease;
      }
      .thumb--active {
        border-color: var(--pf-primary);
      }
      .thumb--current {
        box-shadow: 0 0 0 2px var(--pf-on-surface);
      }
      .thumb canvas {
        display: block;
        width: 100%;
        height: auto;
      }
      .thumb__page {
        position: absolute;
        bottom: 4px;
        right: 4px;
        font-size: 11px;
        line-height: 1;
        padding: 2px 6px;
        border-radius: 9999px;
        background: rgba(0, 0, 0, 0.6);
        color: #ffffff;
      }
    `,
  ],
})
export class PageThumbnailComponent {
  private readonly viewer = inject(PdfViewerService);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  readonly pageIndex = input.required<number>();
  readonly active = input(false);
  readonly current = input(false);
  readonly width = input(180);
  readonly rotation = input(0);

  constructor() {
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      this.pageIndex();
      this.width();
      this.rotation();
      if (!canvas) {
        return;
      }
      void this.render(canvas);
    });
  }

  private async render(canvas: HTMLCanvasElement): Promise<void> {
    const idx = this.pageIndex();
    const rotation = this.rotation();
    const size = await this.viewer.getPageSize(idx, rotation);
    const scale = this.width() / size.width;
    await this.viewer.renderThumbnail(canvas, idx, scale, rotation);
  }
}
