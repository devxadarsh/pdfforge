import { Injectable } from '@angular/core';
import {
  PDFDocument,
  degrees,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import { PdfAnnotation, HighlightAnnotation } from '../../models/pdf.models';

export interface ExportPageSpec {
  readonly sourceIndex: number;
  readonly rotation: number;
  /** Native (unrotated) page width in PDF user units. */
  readonly width: number;
  /** Native (unrotated) page height in PDF user units. */
  readonly height: number;
  /** Display scale (px per PDF user unit) used for the annotation coordinates. */
  readonly scale: number;
  readonly annotations?: readonly PdfAnnotation[];
}

export interface ExportTextEdit {
  readonly pageIndex: number;
  readonly box: { x: number; y: number; width: number; height: number };
  readonly baseline: { x: number; y: number };
  readonly fontSize: number;
  readonly text: string;
  readonly removed: boolean;
}

export interface ExportOptions {
  readonly filename?: string;
  readonly author?: string;
  readonly title?: string;
  readonly textEdits?: readonly ExportTextEdit[];
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  async exportDocument(
    sourceBytes: Uint8Array,
    pages: readonly ExportPageSpec[],
    options?: ExportOptions,
  ): Promise<Uint8Array> {
    if (!pages.length) {
      throw new Error('The document has no pages to export.');
    }
    const src = await PDFDocument.load(sourceBytes);
    const out = await PDFDocument.create();
    if (options?.title) {
      out.setTitle(options.title);
    }
    if (options?.author) {
      out.setAuthor(options.author);
    }
    const indices = pages.map((p) => p.sourceIndex);
    const copied = await out.copyPages(src, indices);
    const font = await out.embedFont(StandardFonts.Helvetica);
    const textEdits = options?.textEdits ?? [];

    for (let i = 0; i < pages.length; i++) {
      const spec = pages[i];
      const page = copied[i];
      const normalized = ((spec.rotation % 360) + 360) % 360;
      page.setRotation(degrees(normalized));
      out.addPage(page);

        for (const edit of textEdits) {
          if (edit.pageIndex !== spec.sourceIndex) {
            continue;
          }
          this.bakeTextEdit(page, edit, font);
        }

      const annotations = spec.annotations ?? [];
      if (annotations.length) {
        await this.bakeAnnotations(
          page,
          annotations,
          spec.rotation,
          spec.scale,
          spec.width,
          spec.height,
          out,
          font,
        );
      }
    }

    const data = await out.save();
    return new Uint8Array(data);
  }

  private bakeTextEdit(
    page: PDFPage,
    edit: ExportTextEdit,
    font: PDFFont,
  ): void {
    page.drawRectangle({
      x: edit.box.x,
      y: edit.box.y,
      width: edit.box.width,
      height: edit.box.height,
      color: rgb(1, 1, 1),
      borderWidth: 0,
    });
    if (!edit.removed && edit.text.trim().length > 0) {
      page.drawText(edit.text, {
        x: edit.baseline.x,
        y: edit.baseline.y,
        size: edit.fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }

  private async bakeAnnotations(
    page: PDFPage,
    annotations: readonly PdfAnnotation[],
    rotation: number,
    scale: number,
    pw: number,
    ph: number,
    out: PDFDocument,
    font: PDFFont,
  ): Promise<void> {
    const imageCache = new Map<string, PDFImage>();
    for (const ann of annotations) {
      switch (ann.type) {
        case 'shape':
          this.drawShape(page, ann, rotation, scale, pw, ph);
          break;
        case 'drawing':
          this.drawDrawing(page, ann, rotation, scale, pw, ph);
          break;
        case 'text':
          this.drawTextAnn(page, ann, rotation, scale, pw, ph, font);
          break;
        case 'highlight':
        case 'underline':
        case 'strikethrough':
          this.drawHighlight(page, ann, rotation, scale, pw, ph);
          break;
        case 'image':
        case 'signature':
          await this.drawImageAnn(page, ann, rotation, scale, pw, ph, out, imageCache);
          break;
        case 'stamp':
          this.drawStamp(page, ann, rotation, scale, pw, ph, font);
          break;
        case 'comment':
          this.drawComment(page, ann, rotation, scale, pw, ph);
          break;
      }
    }
  }

  /** Map a point from display (page-frame px, origin top-left, y down) to
   *  native PDF user space (origin bottom-left, y up). */
  private toNative(
    dx: number,
    dy: number,
    rotation: number,
    scale: number,
    pw: number,
    ph: number,
  ): { x: number; y: number } {
    const s = scale || 1;
    const r = ((rotation % 360) + 360) % 360;
    switch (r) {
      case 90:
        return { x: dy / s, y: pw - dx / s };
      case 180:
        return { x: pw - dx / s, y: dy / s };
      case 270:
        return { x: pw - dy / s, y: ph - dx / s };
      default:
        return { x: dx / s, y: ph - dy / s };
    }
  }

  private nativeRect(
    rect: { x: number; y: number; width: number; height: number },
    rotation: number,
    scale: number,
    pw: number,
    ph: number,
  ): { x: number; y: number; width: number; height: number } {
    const tl = this.toNative(rect.x, rect.y, rotation, scale, pw, ph);
    const br = this.toNative(
      rect.x + rect.width,
      rect.y + rect.height,
      rotation,
      scale,
      pw,
      ph,
    );
    const x = Math.min(tl.x, br.x);
    const y = Math.min(tl.y, br.y);
    return {
      x,
      y,
      width: Math.abs(br.x - tl.x),
      height: Math.abs(br.y - tl.y),
    };
  }

  private drawShape(
    page: PDFPage,
    ann: Extract<PdfAnnotation, { type: 'shape' }>,
    rotation: number,
    scale: number,
    pw: number,
    ph: number,
  ): void {
    const r = this.nativeRect(ann.rect, rotation, scale, pw, ph);
    const opacity = ann.opacity ?? 1;
    const fill = parseColor(ann.fillColor);
    const stroke = parseColor(ann.strokeColor);
    if (ann.kind === 'circle') {
      page.drawEllipse({
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        xScale: r.width / 2,
        yScale: r.height / 2,
        color: fill.a > 0 ? rgb(fill.r, fill.g, fill.b) : undefined,
        borderColor: stroke.a > 0 ? rgb(stroke.r, stroke.g, stroke.b) : undefined,
        borderWidth: ann.strokeWidth,
        opacity,
      });
      return;
    }
    if (ann.kind === 'line' || ann.kind === 'arrow') {
      const p1 = this.toNative(ann.rect.x, ann.rect.y, rotation, scale, pw, ph);
      const p2 = this.toNative(
        ann.rect.x + ann.rect.width,
        ann.rect.y + ann.rect.height,
        rotation,
        scale,
        pw,
        ph,
      );
      page.drawLine({
        start: p1,
        end: p2,
        color: rgb(stroke.r, stroke.g, stroke.b),
        thickness: ann.strokeWidth,
        opacity,
      });
      if (ann.kind === 'arrow') {
        this.drawArrowHead(page, p1, p2, ann.strokeWidth, stroke, opacity);
      }
      return;
    }
    page.drawRectangle({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      color: fill.a > 0 ? rgb(fill.r, fill.g, fill.b) : undefined,
      borderColor: stroke.a > 0 ? rgb(stroke.r, stroke.g, stroke.b) : undefined,
      borderWidth: ann.strokeWidth,
      opacity,
    });
  }

  private drawArrowHead(
    page: PDFPage,
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    width: number,
    stroke: Rgba,
    opacity: number,
  ): void {
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const len = Math.max(8, width * 4);
    const a1 = angle + Math.PI - Math.PI / 7;
    const a2 = angle + Math.PI + Math.PI / 7;
    page.drawLine({
      start: p2,
      end: { x: p2.x + len * Math.cos(a1), y: p2.y + len * Math.sin(a1) },
      color: rgb(stroke.r, stroke.g, stroke.b),
      thickness: width,
      opacity,
    });
    page.drawLine({
      start: p2,
      end: { x: p2.x + len * Math.cos(a2), y: p2.y + len * Math.sin(a2) },
      color: rgb(stroke.r, stroke.g, stroke.b),
      thickness: width,
      opacity,
    });
  }

  private drawDrawing(
    page: PDFPage,
    ann: Extract<PdfAnnotation, { type: 'drawing' }>,
    rotation: number,
    scale: number,
    pw: number,
    ph: number,
  ): void {
    const pts = ann.points.map((p) =>
      this.toNative(p.x, p.y, rotation, scale, pw, ph),
    );
    const color = parseColor(ann.color);
    for (let i = 1; i < pts.length; i++) {
      page.drawLine({
        start: pts[i - 1],
        end: pts[i],
        color: rgb(color.r, color.g, color.b),
        thickness: ann.strokeWidth,
        opacity: ann.opacity ?? 1,
      });
    }
  }

  private drawTextAnn(
    page: PDFPage,
    ann: Extract<PdfAnnotation, { type: 'text' }>,
    rotation: number,
    scale: number,
    pw: number,
    ph: number,
    font: PDFFont,
  ): void {
    const baseline = this.toNative(
      ann.rect.x,
      ann.rect.y + ann.fontSize,
      rotation,
      scale,
      pw,
      ph,
    );
    const color = parseColor(ann.color);
    page.drawText(ann.text, {
      x: baseline.x,
      y: baseline.y,
      size: ann.fontSize / (scale || 1),
      font,
      color: rgb(color.r, color.g, color.b),
      opacity: ann.opacity ?? 1,
    });
  }

  private drawHighlight(
    page: PDFPage,
    ann: HighlightAnnotation,
    rotation: number,
    scale: number,
    pw: number,
    ph: number,
  ): void {
    if (ann.type === 'underline' || ann.type === 'strikethrough') {
      const p1 = this.toNative(
        ann.rect.x,
        ann.type === 'underline'
          ? ann.rect.y + ann.rect.height
          : ann.rect.y + ann.rect.height / 2,
        rotation,
        scale,
        pw,
        ph,
      );
      const p2 = this.toNative(
        ann.rect.x + ann.rect.width,
        ann.type === 'underline'
          ? ann.rect.y + ann.rect.height
          : ann.rect.y + ann.rect.height / 2,
        rotation,
        scale,
        pw,
        ph,
      );
      const color = parseColor(ann.color);
      page.drawLine({
        start: p1,
        end: p2,
        color: rgb(color.r, color.g, color.b),
        thickness: 2,
        opacity: ann.opacity ?? 1,
      });
      return;
    }
    const r = this.nativeRect(ann.rect, rotation, scale, pw, ph);
    const color = parseColor(ann.color);
    page.drawRectangle({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      color: rgb(color.r, color.g, color.b),
      opacity: 0.35 * (ann.opacity ?? 1),
    });
  }

  private async drawImageAnn(
    page: PDFPage,
    ann: Extract<PdfAnnotation, { type: 'image' | 'signature' }>,
    rotation: number,
    scale: number,
    pw: number,
    ph: number,
    out: PDFDocument,
    cache: Map<string, PDFImage>,
  ): Promise<void> {
    const img = await this.embedImage(out, ann.dataUrl, cache);
    if (!img) {
      return;
    }
    const r = this.nativeRect(ann.rect, rotation, scale, pw, ph);
    page.drawImage(img, {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      rotate: degrees(ann.rotation ?? 0),
      opacity: ann.opacity ?? 1,
    });
  }

  private drawStamp(
    page: PDFPage,
    ann: Extract<PdfAnnotation, { type: 'stamp' }>,
    rotation: number,
    scale: number,
    pw: number,
    ph: number,
    font: PDFFont,
  ): void {
    const r = this.nativeRect(ann.rect, rotation, scale, pw, ph);
    const color = parseColor(ann.color);
    page.drawRectangle({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      borderColor: rgb(color.r, color.g, color.b),
      borderWidth: 3,
      color: undefined,
      opacity: ann.opacity ?? 1,
    });
    const fontSize = Math.max(8, Math.min(r.height, r.width * 0.5));
    const textWidth = font.widthOfTextAtSize(ann.text, fontSize);
    page.drawText(ann.text, {
      x: r.x + (r.width - textWidth) / 2,
      y: r.y + (r.height + fontSize) / 2,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
      opacity: ann.opacity ?? 1,
    });
  }

  private drawComment(
    page: PDFPage,
    ann: Extract<PdfAnnotation, { type: 'comment' }>,
    rotation: number,
    scale: number,
    pw: number,
    ph: number,
  ): void {
    const center = this.toNative(
      ann.rect.x + ann.rect.width / 2,
      ann.rect.y + ann.rect.height / 2,
      rotation,
      scale,
      pw,
      ph,
    );
    const radius = 9 / (scale || 1);
    page.drawEllipse({
      x: center.x,
      y: center.y,
      xScale: radius,
      yScale: radius,
      color: rgb(0.98, 0.8, 0.26),
      borderColor: rgb(0.7, 0.33, 0.03),
      borderWidth: 1.5,
    });
  }

  private async embedImage(
    out: PDFDocument,
    dataUrl: string,
    cache: Map<string, PDFImage>,
  ): Promise<PDFImage | null> {
    const cached = cache.get(dataUrl);
    if (cached) {
      return cached;
    }
    try {
      const comma = dataUrl.indexOf(',');
      if (comma < 0) {
        return null;
      }
      const meta = dataUrl.slice(0, comma);
      const isJpeg = /image\/jpeg/i.test(meta);
      const base64 = dataUrl.slice(comma + 1);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const img = isJpeg
        ? await out.embedJpg(bytes)
        : await out.embedPng(bytes);
      cache.set(dataUrl, img);
      return img;
    } catch {
      return null;
    }
  }
}

function parseColor(input: string): Rgba {
  if (!input || input === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const value = input.trim();
  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (hex.length < 6) {
      return { r: 0, g: 0, b: 0, a: 1 };
    }
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return { r, g, b, a: 1 };
  }
  const rgbaMatch = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((p) => p.trim());
    const r = parseFloat(parts[0]) / 255;
    const g = parseFloat(parts[1]) / 255;
    const b = parseFloat(parts[2]) / 255;
    const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
    return { r, g, b, a };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}
