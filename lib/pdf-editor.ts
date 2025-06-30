import { PDFPage, rgb, BlendMode, PDFFont } from "pdf-lib"

/**
 * The rectangular bounds for a piece of text on a PDF page (in PDF coordinate space).
 */
export interface TextBounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Apply a triple-layer white mask over the supplied bounds to ensure that any
 * underlying content is completely removed. All coordinates are expected to be
 * in the PDF coordinate system (origin bottom-left).
 *
 * Layer strategy:
 * 1) Solid opaque white rectangle.
 * 2) Secondary rectangle using Multiply blend at very high opacity to burn out
 *    any lingering glyph hints.
 * 3) Final solid white rectangle for total coverage.
 */
export const maskOriginalText = (page: PDFPage, bounds: TextBounds) => {
  // Slight inflation values (px) for each layer – helps obliterate halos.
  const expansions = [3, 2, 1]
  expansions.forEach((inflate, idx) => {
    page.drawRectangle({
      x: bounds.x - inflate,
      y: bounds.y - inflate,
      width: bounds.width + inflate * 2,
      height: bounds.height + inflate * 2,
      color: rgb(1, 1, 1), // pure white
      opacity: idx === 1 ? 0.98 : 1.0,
      blendMode: idx === 1 ? BlendMode.Multiply : BlendMode.Normal,
    })
  })
}

/**
 * Replace a text element by first masking it completely and then drawing the
 * replacement string at the same location. The caller must supply the font to
 * use for the new string.
 */
export const replaceTextCompletely = (
  page: PDFPage,
  originalBounds: TextBounds,
  newText: string,
  font: PDFFont,
  fontSize: number,
  color: { r: number; g: number; b: number } = { r: 0, g: 0, b: 0 }
) => {
  maskOriginalText(page, originalBounds)
  page.drawText(newText, {
    x: originalBounds.x,
    y: originalBounds.y,
    size: fontSize,
    font,
    color: rgb(color.r, color.g, color.b),
  })
}

/**
 * Utility: very small helper for converting a #RRGGBB hex string to 0-1 range
 * RGB object accepted by pdf-lib's rgb(). Returns black for invalid input.
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!res) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(res[1], 16) / 255,
    g: parseInt(res[2], 16) / 255,
    b: parseInt(res[3], 16) / 255,
  }
} 