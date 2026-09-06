import { TextAnnotation, TextTransform } from '../models/pdf.models';

export const TEXT_PAD_X = 10;
export const TEXT_PAD_Y = 8;
export const TEXT_LINE_HEIGHT = 1.35;
export const TEXT_BACKGROUND_PADDING = 0;

export function transformText(text: string, transform?: TextTransform): string {
  if (!transform || transform === 'none') {
    return text;
  }
  if (transform === 'uppercase') {
    return text.toUpperCase();
  }
  if (transform === 'lowercase') {
    return text.toLowerCase();
  }
  if (transform === 'capitalize') {
    return text.replace(
      /(^|\s|\n)(\p{L})/gu,
      (_, prefix, letter) => prefix + letter.toUpperCase(),
    );
  }
  return text;
}

export function measureTextBounds(
  text: string,
  fontSize: number,
  bold: boolean,
  fontFamily = 'sans-serif',
  italic = false,
  transform?: TextTransform,
  lineHeight = TEXT_LINE_HEIGHT,
  letterSpacing = 0,
): { width: number; height: number } {
  const transformed = transformText(text, transform);
  const lines = transformed.split('\n');
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
      let maxW = 0;
      for (const line of lines) {
        const baseW = ctx.measureText(line || ' ').width;
        const spacingExtra = letterSpacing * Math.max(0, line.length - 1);
        const w = baseW + spacingExtra;
        if (w > maxW) {
          maxW = w;
        }
      }
      return {
        width: Math.max(40, Math.ceil(maxW) + TEXT_PAD_X * 2),
        height: Math.ceil(
          lines.length * fontSize * lineHeight + TEXT_PAD_Y * 2,
        ),
      };
    }
  }
  const approx = Math.max(...lines.map((l) => l.length)) * (fontSize * 0.6 + letterSpacing);
  return {
    width: Math.max(40, Math.ceil(approx) + TEXT_PAD_X * 2),
    height: Math.ceil(
      lines.length * fontSize * lineHeight + TEXT_PAD_Y * 2,
    ),
  };
}

export function measureTextAnnotation(
  ann: Partial<TextAnnotation> & { text: string; fontSize: number },
): { width: number; height: number } {
  return measureTextBounds(
    ann.text,
    ann.fontSize,
    (ann.fontWeight ?? 400) >= 700,
    ann.fontFamily || 'sans-serif',
    !!ann.italic,
    ann.transform,
    ann.lineHeight ?? TEXT_LINE_HEIGHT,
    ann.letterSpacing ?? 0,
  );
}
