import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { fromBuffer } from "pdf2pic";
import type { WriteImageResponse } from "pdf2pic/dist/types/convertResponse";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createServerClient } from "@/lib/supabase";

// Disable the PDF.js worker — not available in Node.js API route context
(pdfjsLib.GlobalWorkerOptions as { workerSrc: string }).workerSrc = "";

// pdfjs-dist's TextContent.items is Array<TextItem | TextMarkedContent>.
// TextItem has `str` + `hasEOL`; TextMarkedContent does not.
// We cast to this local shape to avoid chained filter/map narrowing issues.
type PdfTextItem = { str: string; hasEOL: boolean };

// ---------------------------------------------------------------------------
// extractTextFromPDF
// ---------------------------------------------------------------------------

/**
 * Extract plain text from a PDF buffer, one entry per page.
 * Returns pages in order; empty pages return an empty string for `text`.
 */
export async function extractTextFromPDF(
  pdfBuffer: Buffer
): Promise<{ pageNumber: number; text: string }[]> {
  try {
    // pdfjs-dist accepts Uint8Array — Buffer is a subclass, so this is safe
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    const results: { pageNumber: number; text: string }[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Concatenate text items; respect hasEOL for line breaks.
      // Use a for-loop + explicit cast to sidestep TypeScript's chained
      // filter/map narrowing on the union type Array<TextItem | TextMarkedContent>.
      let text = "";
      for (const item of textContent.items) {
        if ("str" in item) {
          const { str, hasEOL } = item as PdfTextItem;
          text += hasEOL ? str + "\n" : str + " ";
        }
      }
      text = text.replace(/ {2,}/g, " ").trim();

      results.push({ pageNumber: pageNum, text });
      page.cleanup();
    }

    return results;
  } catch (err) {
    throw new Error(
      `extractTextFromPDF failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ---------------------------------------------------------------------------
// convertPDFToImages
// ---------------------------------------------------------------------------

/**
 * Convert each PDF page to a PNG, upload to Supabase Storage, and return
 * the storage paths. Paths are in the form `{dealId}/slides/slide_{n}.png`.
 *
 * Uses pdf2pic (GraphicsMagick/ImageMagick) — requires gm/ImageMagick installed
 * in the runtime environment.
 */
export async function convertPDFToImages(
  pdfBuffer: Buffer,
  dealId: string
): Promise<{ pageNumber: number; imageUrl: string }[]> {
  // Write images to an isolated temp directory so concurrent calls don't collide
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `innovia-${dealId}-`));

  try {
    const converter = fromBuffer(pdfBuffer, {
      density: 150,
      saveFilename: "slide",
      format: "png",
      width: 1400,
      height: 900,
      savePath: tmpDir,
    });

    // bulk(-1) asks pdf2pic to identify the page count then convert all pages
    const rawResults: WriteImageResponse[] = await converter.bulk(-1);

    const supabase = createServerClient();
    const uploads: { pageNumber: number; imageUrl: string }[] = [];

    for (const result of rawResults) {
      if (!result.path || result.page == null) {
        continue; // skip malformed entries
      }

      const imageBuffer = await fs.readFile(result.path);
      const storagePath = `${dealId}/slides/slide_${result.page}.png`;

      const { error: uploadError } = await supabase.storage
        .from("decks")
        .upload(storagePath, imageBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(
          `Storage upload failed for page ${result.page}: ${uploadError.message}`
        );
      }

      uploads.push({ pageNumber: result.page, imageUrl: storagePath });
    }

    // Sort by page number in case pdf2pic returns them out of order
    uploads.sort((a, b) => a.pageNumber - b.pageNumber);

    return uploads;
  } finally {
    // Always clean up temp files, even if an upload fails
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {
      // Non-fatal: temp files will be cleaned by the OS eventually
    });
  }
}

// ---------------------------------------------------------------------------
// getSignedUrl
// ---------------------------------------------------------------------------

/**
 * Generate a 1-hour signed URL for a Supabase Storage path in the 'decks' bucket.
 * Used by the analyze route when passing slide images to Claude.
 *
 * @param storagePath - The path returned by convertPDFToImages, e.g.
 *   `{dealId}/slides/slide_1.png`
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const supabase = createServerClient();

  const { data, error } = await supabase.storage
    .from("decks")
    .createSignedUrl(storagePath, 60 * 60); // 1 hour in seconds

  if (error) {
    throw new Error(`getSignedUrl failed for "${storagePath}": ${error.message}`);
  }
  if (!data?.signedUrl) {
    throw new Error(`getSignedUrl returned no URL for "${storagePath}"`);
  }

  return data.signedUrl;
}
