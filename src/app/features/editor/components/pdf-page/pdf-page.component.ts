import {
  Component,
  ElementRef,
  viewChild,
  effect,
  input,
  inject,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  PdfViewerService,
  Cancellable,
} from '../../../../core/services/pdf/pdf-viewer.service';

@Component({
  selector: 'app-pdf-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="pdf-page" #host><canvas #canvas></canvas></div>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .pdf-page {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        width: 100%;
        height: 100%;
        overflow: auto;
        padding: 16px;
        box-sizing: border-box;
      }
      canvas {
        box-shadow: var(--pf-shadow-3);
        background: #ffffff;
        display: block;
      }
    `,
  ],
})
export class PdfPageComponent implements AfterViewInit, OnDestroy {
  private readonly viewer = inject(PdfViewerService);
  private readonly host = viewChild<ElementRef<HTMLDivElement>>('host');
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  readonly pageIndex = input.required<number>();
  readonly zoom = input(1);
  readonly fitMode = input<'none' | 'width' | 'page'>('width');
  readonly rotation = input(0);
  private readonly renderTask: { task: Cancellable | null } = { task: null };
  private ro?: ResizeObserver;

  constructor() {
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const hostEl = this.host()?.nativeElement;
      this.pageIndex();
      this.zoom();
      this.fitMode();
      this.rotation();
      if (!canvas || !hostEl) {
        return;
      }
      void this.render(canvas, hostEl);
    });
  }

  ngAfterViewInit(): void {
    const hostEl = this.host()?.nativeElement;
    if (hostEl) {
      this.ro = new ResizeObserver(() => {
        const canvas = this.canvasRef()?.nativeElement;
        if (canvas) {
          void this.render(canvas, hostEl);
        }
      });
      this.ro.observe(hostEl);
    }
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    this.renderTask.task?.cancel();
  }

  private async render(
    canvas: HTMLCanvasElement,
    hostEl: HTMLDivElement,
  ): Promise<void> {
    const idx = this.pageIndex();
    const rotation = this.rotation();
    const size = await this.viewer.getPageSize(idx, rotation);
    let scale = this.zoom();
    if (this.fitMode() === 'width') {
      scale = (hostEl.clientWidth - 32) / size.width;
    } else if (this.fitMode() === 'page') {
      scale = Math.min(
        (hostEl.clientWidth - 32) / size.width,
        (hostEl.clientHeight - 32) / size.height,
      );
    }
    scale = Math.max(0.1, scale);
    await this.viewer.renderPage(canvas, idx, scale, this.renderTask, rotation);
  }
}
