/**
 * PDF processing utilities.
 * These functions are stubs — implementation is deferred.
 */

/**
 * Extract plain text from a PDF file buffer.
 *
 * TODO: Implement using pdfjs-dist.
 * - Load the PDF document from the buffer.
 * - Iterate over each page and collect text items.
 * - Return an array of strings, one entry per page.
 */
export async function extractTextFromPDF(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pdfBuffer: ArrayBuffer
): Promise<string[]> {
  // TODO: implement with pdfjs-dist
  throw new Error("extractTextFromPDF is not yet implemented");
}

/**
 * Convert each page of a PDF to a base64-encoded PNG image.
 *
 * TODO: Implement using pdf2pic (wraps GraphicsMagick/ImageMagick) or
 *       pdfjs-dist canvas rendering.
 * - Accept a file path or buffer.
 * - Render each page at a reasonable DPI (e.g. 150–200).
 * - Return an array of base64 PNG strings, one per page.
 */
export async function convertPDFToImages(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pdfBuffer: ArrayBuffer
): Promise<string[]> {
  // TODO: implement with pdf2pic or pdfjs-dist canvas
  throw new Error("convertPDFToImages is not yet implemented");
}
