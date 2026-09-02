import { Injectable } from '@angular/core';
import { PDFDocument, degrees, rgb, StandardFonts, BlendMode as PdfBlendMode } from 'pdf-lib';
import { PdfAnnotation, ImageAnnotation } from '../../models/pdf.models';
import { generateShapeSvgPath } from '../../utilities/shape-paths.util';
import { SHAPE_DEFINITIONS } from '../../constants/shapes';

export interface ExportPageSpec {
  readonly sourceIndex: number;
  readonly rotation: number;
  readonly annotations?: readonly PdfAnnotation[];
  readonly baseWidth?: number;
  readonly baseHeight?: number;
}

export interface ExportOptions {
  readonly filename?: string;
  readonly author?: string;
  readonly title?: string;
}

function mapBlendMode(mode?: string): PdfBlendMode | undefined {
  if (!mode || mode === 'normal') return undefined;
  const map: Record<string, PdfBlendMode> = {
    multiply: PdfBlendMode.Multiply,
    screen: PdfBlendMode.Screen,
    overlay: PdfBlendMode.Overlay,
    darken: PdfBlendMode.Darken,
    lighten: PdfBlendMode.Lighten,
    'color-burn': PdfBlendMode.ColorBurn,
    'color-dodge': PdfBlendMode.ColorDodge,
    'hard-light': PdfBlendMode.HardLight,
    'soft-light': PdfBlendMode.SoftLight,
    difference: PdfBlendMode.Difference,
    exclusion: PdfBlendMode.Exclusion,
  };
  return map[mode];
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(',');
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const binStr = atob(base64);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

function parseRgb(colorStr: string) {
  if (!colorStr) return rgb(0, 0, 0);
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const num = parseInt(hex, 16);
    const r = ((num >> 16) & 255) / 255;
    const g = ((num >> 8) & 255) / 255;
    const b = (num & 255) / 255;
    return rgb(r, g, b);
  }
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return rgb(
      Number(match[1]) / 255,
      Number(match[2]) / 255,
      Number(match[3]) / 255,
    );
  }
  return rgb(0, 0, 0);
}

function buildPageSvg(
  annotations: readonly PdfAnnotation[],
  baseW: number,
  baseH: number,
): string {
  let svgContent = '';
  for (const a of annotations) {
    if (a.type === 'shape') {
      if (a.renderMode === 'icon') {
        const iconDef = SHAPE_DEFINITIONS.find((s) => s.id === a.kind);
        const iconClass = iconDef ? iconDef.icon : 'fa-solid fa-shapes';
        const fontSize = Math.max(10, Math.min(a.rect.width, a.rect.height) * 0.72);
        const transform = a.rotation
          ? `transform="rotate(${a.rotation}, ${a.rect.x + a.rect.width / 2}, ${a.rect.y + a.rect.height / 2})"`
          : '';
        let bg = '';
        if (a.fillColor && a.fillColor !== 'transparent') {
          bg = `<rect x="${a.rect.x}" y="${a.rect.y}" width="${a.rect.width}" height="${a.rect.height}" fill="${a.fillColor}" stroke="${a.strokeColor}" stroke-width="${a.strokeWidth}" rx="8" opacity="${a.opacity ?? 1}" />`;
        }
        svgContent += `<g ${transform}>${bg}<foreignObject x="${a.rect.x}" y="${a.rect.y}" width="${a.rect.width}" height="${a.rect.height}" opacity="${a.opacity ?? 1}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="${iconClass}" style="color:${a.strokeColor};font-size:${fontSize}px;"></i></div></foreignObject></g>`;
      } else {
        const isLine = a.kind === 'line';
        const pathD = generateShapeSvgPath(a.kind, Math.max(1, a.rect.width), Math.max(1, a.rect.height));
        const transform = a.rotation
          ? `rotate(${a.rotation}, ${a.rect.x + a.rect.width / 2}, ${a.rect.y + a.rect.height / 2}) translate(${a.rect.x}, ${a.rect.y})`
          : `translate(${a.rect.x}, ${a.rect.y})`;
        const dash =
          a.strokeStyle === 'dashed'
            ? 'stroke-dasharray="6,4"'
            : a.strokeStyle === 'dotted'
              ? 'stroke-dasharray="2,3"'
              : '';
        if (isLine) {
          svgContent += `<line x1="${a.rect.x}" y1="${a.rect.y}" x2="${a.rect.x + a.rect.width}" y2="${a.rect.y + a.rect.height}" stroke="${a.strokeColor}" stroke-width="${a.strokeWidth}" opacity="${a.opacity ?? 1}" ${dash} />`;
        } else {
          svgContent += `<g transform="${transform}"><path d="${pathD}" fill="${a.fillColor || 'transparent'}" stroke="${a.strokeColor}" stroke-width="${a.strokeWidth}" opacity="${a.opacity ?? 1}" ${dash} /></g>`;
        }
      }
    } else if (a.type === 'drawing') {
      const points = a.points || [];
      if (points.length > 0) {
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i];
          const p1 = points[i + 1];
          const mx = (p0.x + p1.x) / 2;
          const my = (p0.y + p1.y) / 2;
          d += ` Q ${p0.x} ${p0.y}, ${mx} ${my}`;
        }
        const last = points[points.length - 1];
        d += ` L ${last.x} ${last.y}`;
        const transform = a.rotation
          ? `transform="rotate(${a.rotation}, ${a.rect.x + a.rect.width / 2}, ${a.rect.y + a.rect.height / 2})"`
          : '';
        svgContent += `<path d="${d}" fill="none" stroke="${a.color}" stroke-width="${a.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${a.opacity ?? 1}" ${transform} />`;
      }
    } else if (a.type === 'highlight') {
      svgContent += `<rect x="${a.rect.x}" y="${a.rect.y}" width="${a.rect.width}" height="${a.rect.height}" fill="${a.color}" fill-opacity="0.4" opacity="${a.opacity ?? 1}" />`;
    } else if (a.type === 'underline') {
      svgContent += `<line x1="${a.rect.x}" y1="${a.rect.y + a.rect.height - 2}" x2="${a.rect.x + a.rect.width}" y2="${a.rect.y + a.rect.height - 2}" stroke="${a.color}" stroke-width="2" opacity="${a.opacity ?? 1}" />`;
    } else if (a.type === 'strikethrough') {
      svgContent += `<line x1="${a.rect.x}" y1="${a.rect.y + a.rect.height / 2}" x2="${a.rect.x + a.rect.width}" y2="${a.rect.y + a.rect.height / 2}" stroke="${a.color}" stroke-width="2" opacity="${a.opacity ?? 1}" />`;
    } else if (a.type === 'text') {
      const transform = a.rotation
        ? `transform="rotate(${a.rotation}, ${a.rect.x + a.rect.width / 2}, ${a.rect.y + a.rect.height / 2})"`
        : '';
      const lines = (a.text || '').split('\n');
      const lineHeight = (a.lineHeight ?? 1.35) * a.fontSize;
      const startY = a.rect.y + 8 + a.fontSize;
      let textChildren = '';
      lines.forEach((line, idx) => {
        const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        textChildren += `<tspan x="${a.rect.x + 10}" y="${startY + idx * lineHeight}">${escaped}</tspan>`;
      });
      svgContent += `<text fill="${a.color}" font-size="${a.fontSize}" font-family="${a.fontFamily}" font-weight="${a.fontWeight}" font-style="${a.italic ? 'italic' : 'normal'}" opacity="${a.opacity ?? 1}" ${transform}>${textChildren}</text>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${baseW}" height="${baseH}" viewBox="0 0 ${baseW} ${baseH}">${svgContent}</svg>`;
}

async function renderSvgOverlayToPng(
  svgString: string,
  width: number,
  height: number,
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    try {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = 2;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(null);
            return;
          }
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          canvas.toBlob((b) => {
            if (!b) {
              resolve(null);
              return;
            }
            b.arrayBuffer()
              .then((buf) => resolve(new Uint8Array(buf)))
              .catch(() => resolve(null));
          }, 'image/png');
        } catch {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  async exportDocument(
    sourceBytes: Uint8Array,
    pages?: readonly ExportPageSpec[],
    options?: ExportOptions,
  ): Promise<Uint8Array> {
    if (!sourceBytes || sourceBytes.byteLength === 0) {
      throw new Error('Invalid PDF: document bytes are empty.');
    }

    const src = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    const out = await PDFDocument.create();

    if (options?.title) {
      out.setTitle(options.title);
    }
    if (options?.author) {
      out.setAuthor(options.author);
    }

    const totalPages = src.getPageCount();
    if (totalPages === 0) {
      throw new Error('The PDF document contains no pages.');
    }

    // Filter valid page specs with bounds checking
    const validPages = (pages ?? []).filter(
      (p) =>
        p &&
        typeof p.sourceIndex === 'number' &&
        p.sourceIndex >= 0 &&
        p.sourceIndex < totalPages,
    );

    let helveticaBoldFont: any = null;

    if (validPages.length > 0) {
      for (const spec of validPages) {
        try {
          const [copiedPage] = await out.copyPages(src, [spec.sourceIndex]);
          if (copiedPage) {
            const rot = typeof spec.rotation === 'number' ? spec.rotation : 0;
            const normalized = ((rot % 360) + 360) % 360;
            copiedPage.setRotation(degrees(normalized));

            // Embed annotations onto the copied page if present
            if (spec.annotations && spec.annotations.length > 0) {
              const pageWidth = copiedPage.getWidth();
              const pageHeight = copiedPage.getHeight();
              const baseW = spec.baseWidth || pageWidth;
              const baseH = spec.baseHeight || pageHeight;
              const scaleX = pageWidth / baseW;
              const scaleY = pageHeight / baseH;

              // Render vector overlay (shapes, drawings, text, highlights, etc.)
              const vectorAnns = spec.annotations.filter(
                (a) =>
                  a.type === 'shape' ||
                  a.type === 'drawing' ||
                  a.type === 'text' ||
                  a.type === 'highlight' ||
                  a.type === 'underline' ||
                  a.type === 'strikethrough',
              );

              if (vectorAnns.length > 0) {
                try {
                  const svg = buildPageSvg(vectorAnns, baseW, baseH);
                  const pngBytes = await renderSvgOverlayToPng(svg, baseW, baseH);
                  if (pngBytes) {
                    const overlayImg = await out.embedPng(pngBytes);
                    copiedPage.drawImage(overlayImg, {
                      x: 0,
                      y: 0,
                      width: pageWidth,
                      height: pageHeight,
                    });
                  }
                } catch (svgErr) {
                  console.warn('[PdfExportService] Failed to render vector overlay:', svgErr);
                }
              }

              for (const ann of spec.annotations) {
                try {
                  const pdfX = ann.rect.x * scaleX;
                  const pdfY =
                    pageHeight - (ann.rect.y + ann.rect.height) * scaleY;
                  const pdfW = ann.rect.width * scaleX;
                  const pdfH = ann.rect.height * scaleY;

                  if (ann.type === 'image' || ann.type === 'signature') {
                    const raw = dataUrlToUint8Array(ann.dataUrl);
                    let img;
                    if (
                      ann.dataUrl.includes('image/jpeg') ||
                      ann.dataUrl.includes('image/jpg')
                    ) {
                      img = await out.embedJpg(raw);
                    } else {
                      img = await out.embedPng(raw);
                    }
                    const blend = mapBlendMode((ann as any).blendMode);
                    copiedPage.drawImage(img, {
                      x: pdfX,
                      y: pdfY,
                      width: pdfW,
                      height: pdfH,
                      opacity: ann.opacity ?? 1,
                      blendMode: blend,
                    });
                  } else if (ann.type === 'stamp') {
                    const col = parseRgb(ann.color);
                    copiedPage.drawRectangle({
                      x: pdfX,
                      y: pdfY,
                      width: pdfW,
                      height: pdfH,
                      borderColor: col,
                      borderWidth: 2 * scaleX,
                      opacity: ann.opacity ?? 1,
                    });
                    copiedPage.drawRectangle({
                      x: pdfX + 2 * scaleX,
                      y: pdfY + 2 * scaleY,
                      width: pdfW - 4 * scaleX,
                      height: pdfH - 4 * scaleY,
                      borderColor: col,
                      borderWidth: 1 * scaleX,
                      opacity: ann.opacity ?? 1,
                    });
                    if (!helveticaBoldFont) {
                      helveticaBoldFont = await out.embedFont(
                        StandardFonts.HelveticaBold,
                      );
                    }
                    const fontSize = Math.max(8, Math.min(28, pdfH * 0.45));
                    const textWidth = helveticaBoldFont.widthOfTextAtSize(
                      ann.text,
                      fontSize,
                    );
                    copiedPage.drawText(ann.text, {
                      x: pdfX + (pdfW - textWidth) / 2,
                      y: pdfY + (pdfH - fontSize) / 2 + 1,
                      size: fontSize,
                      font: helveticaBoldFont,
                      color: col,
                      opacity: ann.opacity ?? 1,
                    });
                  }
                } catch (annErr) {
                  console.warn(
                    '[PdfExportService] Failed to draw annotation:',
                    ann,
                    annErr,
                  );
                }
              }
            }

            out.addPage(copiedPage);
          }
        } catch (copyErr) {
          console.warn(
            '[PdfExportService] Failed to copy page at index:',
            spec.sourceIndex,
            copyErr,
          );
        }
      }
    }

    // Fallback: If no pages were copied, copy all original pages
    if (out.getPageCount() === 0) {
      const allIndices = Array.from({ length: totalPages }, (_, i) => i);
      const copiedAll = await out.copyPages(src, allIndices);
      for (const page of copiedAll) {
        if (page) {
          out.addPage(page);
        }
      }
    }

    const data = await out.save();
    return new Uint8Array(data);
  }
}
