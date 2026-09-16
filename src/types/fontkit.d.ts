/**
 * fontkit.d.ts — Type declaration for fontkit browser usage.
 * fontkit ships its own types but they are not always picked up by the
 * Angular compiler. This minimal declaration satisfies strict TypeScript.
 */
declare module 'fontkit' {
  export interface Glyph {
    id: number;
    codePoints: number[];
    advanceWidth: number;
  }

  export interface Font {
    /** PostScript name of the font. */
    postscriptName: string | null;
    /** Full name. */
    fullName: string | null;
    /** Family name. */
    familyName: string | null;
    /** Total number of glyphs in the font. */
    numGlyphs: number;
    /**
     * Array of all unicode code points supported by the font.
     * Reads the cmap table.
     */
    characterSet: number[];
    /** Returns true if the font has a glyph for the given Unicode code point. */
    hasGlyphForCodePoint(codePoint: number): boolean;
    /** Returns the Glyph for a Unicode code point. */
    glyphForCodePoint(codePoint: number): Glyph;
  }

  export interface FontCollection {
    fonts: Font[];
    getFont(name: string): Font | null;
  }

  /** Creates a Font from a raw buffer (Uint8Array or Buffer). */
  export function create(buffer: Uint8Array | Buffer, index?: number): Font;

  /** Opens a font from a file path (Node.js only). */
  export function openSync(path: string, index?: number): Font;

  /** Opens a font from a file path asynchronously (Node.js only). */
  export function open(path: string, index?: number): Promise<Font>;
}
