/**
 * font-matcher.util.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Visual fidelity helpers for inline text editing:
 *   1. resolveFontStyles()           — maps PDF PostScript names to CSS font stacks
 *   2. computeCalibratedFont()       — matches text length, font-size and tracking
 *   3. sampleCanvasBackgroundColor() — extracts exact document background color
 *
 * PRD §5.3 — Style preservation (font family, size, color, metrics)
 */

export interface ResolvedFontStyles {
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  cleanName: string;
}

export interface CalibratedFont extends ResolvedFontStyles {
  fontSize: number;
  letterSpacing: number;
}

let _measureCanvas: HTMLCanvasElement | null = null;
let _measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (_measureCtx) return _measureCtx;
  if (typeof document === 'undefined') return null;
  _measureCanvas = document.createElement('canvas');
  _measureCtx = _measureCanvas.getContext('2d');
  return _measureCtx;
}

/**
 * Resolves a PostScript/PDF font name into CSS fontFamily, fontWeight, fontStyle,
 * and a human-friendly cleanName (e.g. "Times New Roman", "Calibri", "Arial").
 */
export function resolveFontStyles(rawFontName?: string): ResolvedFontStyles {
  if (!rawFontName) {
    return {
      fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      cleanName: 'Detected Font',
    };
  }

  // Strip subset prefix e.g. "ABCDEF+TimesNewRomanPSMT" -> "TimesNewRomanPSMT"
  // Strip leading "~" or "/" markers
  const name = rawFontName.replace(/^[~/]+/, '').replace(/^[A-Z]{6}\+/, '');
  const lower = name.toLowerCase();

  // Weight detection
  let fontWeight = 'normal';
  if (
    lower.includes('black') ||
    lower.includes('heavy') ||
    lower.includes('extrabold') ||
    lower.includes('ultrabold') ||
    lower.includes('w9') ||
    lower.includes('w8')
  ) {
    fontWeight = 'bold';
  } else if (
    lower.includes('bold') ||
    lower.includes('-bd') ||
    lower.includes('-b') ||
    lower.includes('bld') ||
    lower.includes('w7')
  ) {
    fontWeight = 'bold';
  } else if (
    lower.includes('semibold') ||
    lower.includes('demibold') ||
    lower.includes('demi') ||
    lower.includes('w6')
  ) {
    fontWeight = '600';
  } else if (lower.includes('medium') || lower.includes('w5')) {
    fontWeight = '500';
  } else if (
    lower.includes('light') ||
    lower.includes('thin') ||
    lower.includes('hairline') ||
    lower.includes('w2') ||
    lower.includes('w3')
  ) {
    fontWeight = '300';
  }

  // Style detection
  const isItalic =
    lower.includes('italic') ||
    lower.includes('oblique') ||
    lower.includes('-it') ||
    lower.includes('ital') ||
    lower.includes('slanted') ||
    lower.includes('kursiv') ||
    lower.endsWith('it');

  // Family stack and clean name detection
  let fontFamily: string;
  let cleanName: string;

  if (
    lower.includes('times') ||
    lower.includes('nimbusrom') ||
    lower.includes('dejavuserif') ||
    (lower.includes('dejavu') && lower.includes('serif')) ||
    (lower.includes('roman') && !lower.includes('bookman'))
  ) {
    cleanName = 'Times New Roman';
    fontFamily = '"Times New Roman", Times, "Liberation Serif", serif';
  } else if (lower.includes('georgia')) {
    cleanName = 'Georgia';
    fontFamily = 'Georgia, serif';
  } else if (lower.includes('garamond')) {
    cleanName = 'Garamond';
    fontFamily = 'Garamond, "EB Garamond", serif';
  } else if (lower.includes('cambria')) {
    cleanName = 'Cambria';
    fontFamily = 'Cambria, Georgia, serif';
  } else if (lower.includes('palatino')) {
    cleanName = 'Palatino';
    fontFamily = '"Palatino Linotype", "Book Antiqua", Palatino, serif';
  } else if (lower.includes('baskerville')) {
    cleanName = 'Baskerville';
    fontFamily = 'Baskerville, Georgia, serif';
  } else if (lower.includes('century') && lower.includes('gothic')) {
    cleanName = 'Century Gothic';
    fontFamily = '"Century Gothic", Century, sans-serif';
  } else if (lower.includes('century')) {
    cleanName = 'Century';
    fontFamily = '"Century Schoolbook", Century, serif';
  } else if (lower.includes('bookman')) {
    cleanName = 'Bookman';
    fontFamily = '"Bookman Old Style", Bookman, serif';
  } else if (
    lower.includes('courier') ||
    lower.includes('typewriter') ||
    lower.includes('dejavusansmono') ||
    (lower.includes('dejavu') && lower.includes('mono')) ||
    (lower.includes('liberation') && lower.includes('mono'))
  ) {
    cleanName = 'Courier New';
    fontFamily = '"Courier New", Courier, monospace';
  } else if (lower.includes('consolas')) {
    cleanName = 'Consolas';
    fontFamily = 'Consolas, "Courier New", monospace';
  } else if (lower.includes('menlo') || lower.includes('monaco')) {
    cleanName = 'Menlo';
    fontFamily = 'Menlo, Monaco, "Courier New", monospace';
  } else if (
    lower.includes('arial') ||
    lower.includes('dejavusans') ||
    lower.includes('dejavu')
  ) {
    cleanName = 'Arial';
    fontFamily = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
  } else if (lower.includes('helvetica') || lower.includes('nimbussan')) {
    cleanName = 'Helvetica';
    fontFamily = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  } else if (lower.includes('calibri')) {
    cleanName = 'Calibri';
    fontFamily = 'Calibri, "Segoe UI", Arial, sans-serif';
  } else if (lower.includes('verdana')) {
    cleanName = 'Verdana';
    fontFamily = 'Verdana, Geneva, sans-serif';
  } else if (lower.includes('tahoma')) {
    cleanName = 'Tahoma';
    fontFamily = 'Tahoma, Verdana, sans-serif';
  } else if (lower.includes('trebuchet')) {
    cleanName = 'Trebuchet MS';
    fontFamily = '"Trebuchet MS", "Lucida Grande", sans-serif';
  } else if (lower.includes('roboto')) {
    cleanName = 'Roboto';
    fontFamily = 'Roboto, -apple-system, BlinkMacSystemFont, sans-serif';
  } else if (lower.includes('inter')) {
    cleanName = 'Inter';
    fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';
  } else if (lower.includes('lato')) {
    cleanName = 'Lato';
    fontFamily = 'Lato, -apple-system, BlinkMacSystemFont, sans-serif';
  } else if (lower.includes('open') && lower.includes('sans')) {
    cleanName = 'Open Sans';
    fontFamily = '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif';
  } else if (lower.includes('liberation') && lower.includes('serif')) {
    cleanName = 'Liberation Serif';
    fontFamily = '"Liberation Serif", "Times New Roman", serif';
  } else if (lower.includes('liberation') && lower.includes('sans')) {
    cleanName = 'Liberation Sans';
    fontFamily = '"Liberation Sans", Arial, sans-serif';
  } else if (lower.includes('serif') && !lower.includes('sans')) {
    cleanName = 'Serif';
    fontFamily = 'Georgia, "Times New Roman", serif';
  } else if (lower.includes('mono')) {
    cleanName = 'Monospace';
    fontFamily = '"Courier New", Courier, monospace';
  } else if (lower.includes('sans')) {
    cleanName = 'Sans Serif';
    fontFamily = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
  } else {
    // If it is an anonymous PDF font ID like F1, TT0, C0_0, Font1
    if (/^(?:f|tt|c|r|font)\d+$/i.test(name)) {
      cleanName = 'Detected Font';
      fontFamily = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
    } else {
      // Strip style suffixes to get clean base family name
      const clean = name
        .replace(/[-_,]?(bold|italic|oblique|regular|medium|light|black|heavy|demi|semibold|psmt|mt|ps|regu)/gi, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .trim();
      cleanName = clean || 'Detected Font';
      fontFamily = clean ? `"${clean}", Arial, sans-serif` : 'Arial, sans-serif';
    }
  }

  return {
    fontFamily,
    fontWeight,
    fontStyle: isItalic ? 'italic' : 'normal',
    cleanName,
  };
}

/**
 * Measures the rendered width of text in pixels at a fixed font size and style,
 * without modifying the font size or letter spacing.
 */
export function measureNaturalTextWidth(
  text: string,
  fontSizePx: number,
  rawFontName?: string,
): number {
  if (!text) return 0;
  const styles = resolveFontStyles(rawFontName);
  const ctx = getMeasureContext();
  if (!ctx) {
    return Math.ceil(text.length * fontSizePx * 0.55);
  }
  ctx.font = `${styles.fontStyle} ${styles.fontWeight} ${fontSizePx}px ${styles.fontFamily}`;
  return Math.ceil(ctx.measureText(text).width);
}

/**
 * Computes the consistent letter-spacing (in pixels) for a text run so that
 * the rendered font's character spacing matches the PDF document's native spacing.
 *
 * This value is derived from the original run's metrics and remains constant throughout
 * editing, ensuring the space between letters never stretches or squishes when
 * typing or modifying text.
 */
export function computeConsistentLetterSpacing(
  runText: string,
  targetWidthPx: number,
  fontSizePx: number,
  rawFontName?: string,
  charSpacingPt?: number,
  scale = 1,
): number {
  if (typeof charSpacingPt === 'number' && Math.abs(charSpacingPt) > 0.01) {
    const fromTc = Math.round(charSpacingPt * scale * 100) / 100;
    return Math.max(-2.5, Math.min(6.0, fromTc));
  }

  if (!runText || runText.length <= 1 || targetWidthPx <= 0 || fontSizePx <= 0) {
    return 0;
  }

  const naturalWidth = measureNaturalTextWidth(runText, fontSizePx, rawFontName);
  if (naturalWidth <= 0) return 0;

  const diff = targetWidthPx - naturalWidth;
  const rawSpacing = diff / (runText.length - 1);

  return Math.max(-2.0, Math.min(4.0, Math.round(rawSpacing * 100) / 100));
}

/**
 * Calibrates font size and letter spacing so the rendered text length exactly matches
 * the original PDF text bounding box width.
 */
export function computeCalibratedFont(
  text: string,
  targetWidthPx: number,
  baseFontSizePx: number,
  rawFontName?: string,
): CalibratedFont {
  const styles = resolveFontStyles(rawFontName);

  if (!text || targetWidthPx <= 0 || baseFontSizePx <= 0) {
    return {
      ...styles,
      fontSize: baseFontSizePx,
      letterSpacing: 0,
    };
  }

  const ctx = getMeasureContext();
  if (!ctx) {
    return {
      ...styles,
      fontSize: baseFontSizePx,
      letterSpacing: 0,
    };
  }

  ctx.font = `${styles.fontStyle} ${styles.fontWeight} ${baseFontSizePx}px ${styles.fontFamily}`;
  const measuredWidth = ctx.measureText(text).width;

  if (!measuredWidth || text.length <= 1) {
    return {
      ...styles,
      fontSize: baseFontSizePx,
      letterSpacing: 0,
    };
  }

  const ratio = targetWidthPx / measuredWidth;
  let effectiveFontSize = baseFontSizePx;
  let letterSpacing = 0;

  // If width is substantially different (e.g. condensed or expanded PDF font metrics)
  if (ratio < 0.85 || ratio > 1.2) {
    effectiveFontSize = baseFontSizePx * Math.min(1.15, Math.max(0.85, ratio));
    ctx.font = `${styles.fontStyle} ${styles.fontWeight} ${effectiveFontSize}px ${styles.fontFamily}`;
    const remeasured = ctx.measureText(text).width;
    letterSpacing = (targetWidthPx - remeasured) / (text.length - 1);
  } else {
    letterSpacing = (targetWidthPx - measuredWidth) / (text.length - 1);
  }

  // Clamp letter spacing to sensible bounds so text doesn't collapse or distort
  const clampedSpacing = Math.max(-2.5, Math.min(4.0, letterSpacing));

  return {
    ...styles,
    fontSize: Math.round(effectiveFontSize * 10) / 10,
    letterSpacing: Math.round(clampedSpacing * 100) / 100,
  };
}

/**
 * Samples the background color of the PDF page from the rendered canvas around
 * and immediately adjacent to the text bounding box.
 *
 * @param canvas - The rendered HTMLCanvasElement from pdf.js.
 * @param bbox   - BoundingBox in PDF points.
 * @param scale  - CSS pixel scale factor.
 * @returns CSS color string, e.g. "rgb(255, 255, 255)"
 */
export function sampleCanvasBackgroundColor(
  canvas: HTMLCanvasElement,
  bbox: { x: number; y: number; width: number; height: number },
  scale: number,
): string {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '#ffffff';

    const canvasW = canvas.width;
    const canvasH = canvas.height;
    if (canvasW === 0 || canvasH === 0) return '#ffffff';

    const styleW = parseFloat(canvas.style.width) || canvasW;
    const cssToCanvas = canvasW / styleW;

    const cssLeft = bbox.x * scale;
    const cssTop = bbox.y * scale;
    const cssW = bbox.width * scale;
    const cssH = bbox.height * scale;

    // Sample candidate points around the text box (top, bottom, left, right, and outer corners)
    const samplePoints: [number, number][] = [
      // Above text box (clear of glyphs)
      [cssLeft + cssW * 0.2, cssTop - 2],
      [cssLeft + cssW * 0.5, cssTop - 2],
      [cssLeft + cssW * 0.8, cssTop - 2],
      // Below text box
      [cssLeft + cssW * 0.2, cssTop + cssH + 2],
      [cssLeft + cssW * 0.5, cssTop + cssH + 2],
      [cssLeft + cssW * 0.8, cssTop + cssH + 2],
      // Left and right
      [cssLeft - 2, cssTop + cssH * 0.5],
      [cssLeft + cssW + 2, cssTop + cssH * 0.5],
      // Outer corners
      [cssLeft + 1, cssTop + 1],
      [cssLeft + cssW - 1, cssTop + 1],
      [cssLeft + 1, cssTop + cssH - 1],
      [cssLeft + cssW - 1, cssTop + cssH - 1],
    ];

    const colorCounts = new Map<string, { count: number; r: number; g: number; b: number }>();

    for (const [sx, sy] of samplePoints) {
      const bx = Math.max(0, Math.min(canvasW - 1, Math.round(sx * cssToCanvas)));
      const by = Math.max(0, Math.min(canvasH - 1, Math.round(sy * cssToCanvas)));

      const pixel = ctx.getImageData(bx, by, 1, 1).data;
      const a = pixel[3];
      if (a < 10) continue; // Transparent

      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];

      // Quantize slightly (step of 4) to group minor antialiasing/JPEG artifacts
      const qr = Math.round(r / 4) * 4;
      const qg = Math.round(g / 4) * 4;
      const qb = Math.round(b / 4) * 4;
      const key = `${qr},${qg},${qb}`;

      const existing = colorCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        colorCounts.set(key, { count: 1, r, g, b });
      }
    }

    if (colorCounts.size === 0) return '#ffffff';

    // Find the most frequent background color sample
    let best = { count: -1, r: 255, g: 255, b: 255 };
    for (const val of colorCounts.values()) {
      if (val.count > best.count) {
        best = val;
      }
    }

    return `rgb(${best.r}, ${best.g}, ${best.b})`;
  } catch {
    return '#ffffff';
  }
}
