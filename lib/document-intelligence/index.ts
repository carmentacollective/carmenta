/**
 * Document Intelligence Module
 *
 * Provides document extraction via Docling for PDFs, DOCX, and PPTX files.
 * This module is optional - only enabled when DOCLING_API_URL is set.
 */

export { DOCLING_CONFIG, type SupportedDoclingType } from "./config";
export { extractDocument, checkDoclingHealth, type DoclingResult } from "./client";
