import { Injectable, inject } from '@angular/core';
import {
  Canvas as FabricCanvas,
  Rect as FabricRect,
  Circle as FabricCircle,
  Line as FabricLine,
  Textbox as FabricTextbox,
  Path as FabricPath,
  FabricImage,
  PencilBrush,
  FabricObject,
} from 'fabric';
import {
  PdfAnnotation,
  ShapeAnnotation,
  TextAnnotation,
  DrawingAnnotation,
  ImageAnnotation,
  SignatureAnnotation,
  PdfToolId,
  Point,
} from '../../../core/models/pdf.models';
import { generateShapeSvgPath } from '../../../core/utilities/shape-paths.util';
import { EditorStateService } from '../state/editor-state.service';

export interface FabricObjectMeta {
  readonly id: string;
  readonly pageId: string;
  readonly annotationType: string;
}

/**
 * Adapter and lifecycle manager for Fabric.js v7 interactive canvas instances.
 * Bridges Fabric's canvas object model, selection bounds, and rotation handles
 * with PDFForge's domain models and reactive signals.
 */
@Injectable({ providedIn: 'root' })
export class FabricCanvasManagerService {
  private readonly state = inject(EditorStateService);
  private activeCanvases = new Map<string, FabricCanvas>();

  /**
   * Create or retrieve a Fabric canvas for a specific page canvas element.
   */
  createCanvas(pageId: string, canvasEl: HTMLCanvasElement, width: number, height: number): FabricCanvas {
    this.disposeCanvas(pageId);

    const canvas = new FabricCanvas(canvasEl, {
      width,
      height,
      selection: true,
      preserveObjectStacking: true,
      renderOnAddRemove: true,
    });

    this.setupCanvasListeners(pageId, canvas);
    this.activeCanvases.set(pageId, canvas);
    return canvas;
  }

  getCanvas(pageId: string): FabricCanvas | undefined {
    return this.activeCanvases.get(pageId);
  }

  disposeCanvas(pageId: string): void {
    const canvas = this.activeCanvases.get(pageId);
    if (canvas) {
      canvas.dispose();
      this.activeCanvases.delete(pageId);
    }
  }

  setCanvasDimensions(pageId: string, width: number, height: number): void {
    const canvas = this.activeCanvases.get(pageId);
    if (canvas) {
      canvas.setDimensions({ width, height });
      canvas.requestRenderAll();
    }
  }

  /**
   * Configure the canvas mode according to the active editor tool.
   */
  setTool(pageId: string, tool: PdfToolId): void {
    const canvas = this.activeCanvases.get(pageId);
    if (!canvas) return;

    if (tool === 'hand') {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
    } else if (tool === 'pen' || tool === 'freehand') {
      canvas.isDrawingMode = true;
      const brush = new PencilBrush(canvas);
      brush.color = tool === 'freehand' ? this.state.freehandColor() : this.state.penColor();
      brush.width = tool === 'freehand' ? this.state.freehandStrokeWidth() : this.state.penStrokeWidth();
      canvas.freeDrawingBrush = brush;
    } else if (tool === 'select') {
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.forEachObject((obj) => {
        obj.selectable = true;
        obj.evented = true;
      });
    } else {
      canvas.isDrawingMode = false;
      canvas.selection = false;
    }

    canvas.requestRenderAll();
  }

  /**
   * Synchronize PDFForge annotations into Fabric canvas objects.
   */
  async syncAnnotations(pageId: string, annotations: readonly PdfAnnotation[]): Promise<void> {
    const canvas = this.activeCanvases.get(pageId);
    if (!canvas) return;

    // Retain currently active selection ID if possible
    const currentActive = canvas.getActiveObject() as (FabricObject & { pfId?: string }) | null;
    const activeId = currentActive?.pfId;

    canvas.clear();

    for (const ann of annotations) {
      const obj = await this.createFabricObjectFromAnnotation(pageId, ann);
      if (obj) {
        canvas.add(obj);
        if (activeId && ann.id === activeId) {
          canvas.setActiveObject(obj);
        }
      }
    }

    canvas.requestRenderAll();
  }

  private async createFabricObjectFromAnnotation(
    pageId: string,
    ann: PdfAnnotation,
  ): Promise<FabricObject | null> {
    let obj: FabricObject | null = null;

    if (ann.type === 'shape') {
      const s = ann as ShapeAnnotation;
      if (s.kind === 'rectangle' || s.kind === 'square' || s.kind === 'rounded-rectangle') {
        obj = new FabricRect({
          left: s.rect.x,
          top: s.rect.y,
          width: s.rect.width,
          height: s.rect.height,
          fill: s.fillColor || 'transparent',
          stroke: s.strokeColor,
          strokeWidth: s.strokeWidth,
          angle: s.rotation || 0,
          rx: s.kind === 'rounded-rectangle' ? 8 : 0,
          ry: s.kind === 'rounded-rectangle' ? 8 : 0,
          opacity: s.opacity ?? 1,
        });
      } else if (s.kind === 'circle' || s.kind === 'ellipse') {
        obj = new FabricCircle({
          left: s.rect.x,
          top: s.rect.y,
          radius: Math.max(1, s.rect.width / 2),
          fill: s.fillColor || 'transparent',
          stroke: s.strokeColor,
          strokeWidth: s.strokeWidth,
          angle: s.rotation || 0,
          opacity: s.opacity ?? 1,
        });
      } else if (s.kind === 'line') {
        obj = new FabricLine([s.rect.x, s.rect.y, s.rect.x + s.rect.width, s.rect.y + s.rect.height], {
          stroke: s.strokeColor,
          strokeWidth: s.strokeWidth,
          opacity: s.opacity ?? 1,
        });
      } else {
        const pathD = generateShapeSvgPath(s.kind, Math.max(1, s.rect.width), Math.max(1, s.rect.height));
        obj = new FabricPath(pathD, {
          left: s.rect.x,
          top: s.rect.y,
          fill: s.fillColor || 'transparent',
          stroke: s.strokeColor,
          strokeWidth: s.strokeWidth,
          angle: s.rotation || 0,
          opacity: s.opacity ?? 1,
        });
      }
    } else if (ann.type === 'text') {
      const t = ann as TextAnnotation;
      obj = new FabricTextbox(t.text || '', {
        left: t.rect.x,
        top: t.rect.y,
        width: t.rect.width,
        fontSize: t.fontSize,
        fontFamily: t.fontFamily,
        fill: t.color,
        fontWeight: t.fontWeight >= 700 ? 'bold' : 'normal',
        fontStyle: t.italic ? 'italic' : 'normal',
        underline: t.underline,
        textAlign: t.align || 'left',
        angle: t.rotation || 0,
        opacity: t.opacity ?? 1,
      });
    } else if (ann.type === 'drawing') {
      const d = ann as DrawingAnnotation;
      if (d.points && d.points.length > 0) {
        let svgPath = `M ${d.points[0].x} ${d.points[0].y}`;
        for (let i = 1; i < d.points.length; i++) {
          svgPath += ` L ${d.points[i].x} ${d.points[i].y}`;
        }
        obj = new FabricPath(svgPath, {
          fill: 'none',
          stroke: d.color,
          strokeWidth: d.strokeWidth,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          angle: d.rotation || 0,
          opacity: d.opacity ?? 1,
        });
      }
    } else if (ann.type === 'image' || ann.type === 'signature') {
      const imgAnn = ann as ImageAnnotation | SignatureAnnotation;
      try {
        const img = await FabricImage.fromURL(imgAnn.dataUrl);
        img.set({
          left: imgAnn.rect.x,
          top: imgAnn.rect.y,
          scaleX: imgAnn.rect.width / (img.width || 1),
          scaleY: imgAnn.rect.height / (img.height || 1),
          angle: imgAnn.rotation || 0,
          opacity: imgAnn.opacity ?? 1,
        });
        obj = img;
      } catch (err) {
        console.warn('[FabricCanvasManager] Failed to load image/signature into Fabric:', err);
      }
    }

    if (obj) {
      (obj as any).pfId = ann.id;
      (obj as any).pfPageId = pageId;
      (obj as any).pfType = ann.type;
      obj.lockMovementX = Boolean(ann.locked);
      obj.lockMovementY = Boolean(ann.locked);
      obj.lockRotation = Boolean(ann.locked);
      obj.lockScalingX = Boolean(ann.locked);
      obj.lockScalingY = Boolean(ann.locked);
    }

    return obj;
  }

  private setupCanvasListeners(pageId: string, canvas: FabricCanvas): void {
    canvas.on('object:modified', (e) => {
      const target = e.target as (FabricObject & { pfId?: string }) | null;
      if (!target || !target.pfId) return;

      const rect = {
        x: Math.round(target.left || 0),
        y: Math.round(target.top || 0),
        width: Math.round((target.width || 0) * (target.scaleX || 1)),
        height: Math.round((target.height || 0) * (target.scaleY || 1)),
      };

      const rotation = Math.round(target.angle || 0) % 360;

      this.state.updateAnnotation(target.pfId, {
        rect,
        rotation,
      });
    });

    canvas.on('selection:created', (e) => {
      const selected = e.selected || [];
      const ids = selected
        .map((obj: any) => obj.pfId)
        .filter((id): id is string => typeof id === 'string');
      if (ids.length > 0) {
        this.state.selectAnnotation(ids[0]);
      }
    });

    canvas.on('selection:cleared', () => {
      this.state.clearSelection();
    });

    canvas.on('path:created', (e: any) => {
      const pathObj = e.path;
      if (!pathObj) return;

      const points: Point[] = [];
      const pathData = pathObj.path || [];
      for (const cmd of pathData) {
        if (cmd.length >= 3) {
          points.push({ x: Math.round(cmd[1]), y: Math.round(cmd[2]) });
        }
      }

      const drawingAnn: DrawingAnnotation = {
        id: crypto.randomUUID(),
        type: 'drawing',
        color: pathObj.stroke || this.state.penColor(),
        strokeWidth: pathObj.strokeWidth || this.state.penStrokeWidth(),
        opacity: pathObj.opacity ?? 1,
        points: points.length > 0 ? points : [{ x: Math.round(pathObj.left || 0), y: Math.round(pathObj.top || 0) }],
        rect: {
          x: Math.round(pathObj.left || 0),
          y: Math.round(pathObj.top || 0),
          width: Math.round((pathObj.width || 10) * (pathObj.scaleX || 1)),
          height: Math.round((pathObj.height || 10) * (pathObj.scaleY || 1)),
        },
        createdAt: Date.now(),
      };

      this.state.addAnnotation(pageId, drawingAnn);
    });
  }
}
