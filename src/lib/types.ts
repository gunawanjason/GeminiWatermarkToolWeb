/**
 * Shared types for the Gemini Watermark Remover
 */

export type ProcessingStatus = "pending" | "processing" | "completed" | "error";

export interface ImageItem {
  id: string;
  file: File;
  originalDataUrl: string;
  processedDataUrl: string | null;
  status: ProcessingStatus;
  error?: string;
  width: number;
  height: number;
  addedAt: number;
  processedAt?: number;
}

export interface HistoryItem {
  id: string;
  fileName: string;
  originalDataUrl: string;
  processedDataUrl: string;
  width: number;
  height: number;
  processedAt: number;
}

export interface ProcessingStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

export type ViewMode = "single" | "batch" | "history";
