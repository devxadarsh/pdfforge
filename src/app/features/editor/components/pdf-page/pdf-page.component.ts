import {
  Component,
  ElementRef,
  viewChild,
  effect,
  input,
  inject,
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
        display: block;
        width: 100%;
        height: 100%;
      }
      canvas {
        display: block;
        background: #ffffff;
      }
    `,
  ],
})
export class PdfPageComponent {
  private readonly viewer = inject(PdfViewerService);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  readonly pageIndex = input.required<number>();
  readonly scale = input.required<number>();
  readonly rotation = input(0);
  private readonly renderTask: { task: Cancellable | null } = { task: null };

  constructor() {
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      this.pageIndex();
      this.scale();
      this.rotation();
      if (!canvas) {
        return;
      }
      void this.render(canvas);
    });
  }

  private async render(canvas: HTMLCanvasElement): Promise<void> {
    const idx = this.pageIndex();
    const scale = this.scale();
    const rotation = this.rotation();
    await this.viewer.renderPage(
      canvas,
      idx,
      scale,
      this.renderTask,
      rotation,
    );
  }
}
