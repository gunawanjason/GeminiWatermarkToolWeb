/**
 * Local storage utilities using IndexedDB for history persistence
 */

import { openDB, type IDBPDatabase } from "idb";
import type { HistoryItem } from "./types";

const DB_NAME = "gemini-watermark-remover";
const DB_VERSION = 1;
const STORE_NAME = "history";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("processedAt", "processedAt");
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Save a processed image to history
 */
export async function saveToHistory(item: HistoryItem): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, item);
}

/**
 * Get all history items, sorted by most recent first
 */
export async function getHistory(): Promise<HistoryItem[]> {
  const db = await getDB();
  const items = await db.getAll(STORE_NAME);
  return items.sort((a, b) => b.processedAt - a.processedAt);
}

/**
 * Get a single history item by ID
 */
export async function getHistoryItem(
  id: string,
): Promise<HistoryItem | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

/**
 * Delete a history item
 */
export async function deleteHistoryItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/**
 * Clear all history
 */
export async function clearHistory(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

/**
 * Get history count
 */
export async function getHistoryCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE_NAME);
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
