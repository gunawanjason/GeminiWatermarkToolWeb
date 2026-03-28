/**
 * Google Analytics 4 Event Tracking Module
 * Provides comprehensive tracking for user interactions and custom events
 */

// GA4 Event Names - following recommended naming conventions
export const GA_EVENTS = {
  // Page & Navigation
  PAGE_VIEW: 'page_view',
  
  // File Operations
  FILE_UPLOAD: 'file_upload',
  FILE_DOWNLOAD: 'file_download',
  FILE_DRAG_DROP: 'file_drag_drop',
  
  // Processing Events
  PROCESSING_START: 'processing_start',
  PROCESSING_COMPLETE: 'processing_complete',
  PROCESSING_ERROR: 'processing_error',
  
  // Batch Operations
  BATCH_UPLOAD: 'batch_upload',
  BATCH_PROCESS: 'batch_process',
  BATCH_DOWNLOAD: 'batch_download',
  BATCH_CLEAR: 'batch_clear',
  
  // History Operations
  HISTORY_VIEW: 'history_view',
  HISTORY_DOWNLOAD: 'history_download',
  HISTORY_DELETE: 'history_delete',
  HISTORY_CLEAR_ALL: 'history_clear_all',
  HISTORY_DOWNLOAD_ALL: 'history_download_all',
  
  // UI Interactions
  COMPARE_TOGGLE: 'compare_toggle',
  ZOOM_VIEW: 'zoom_view',
  AUTO_PROCESS_TOGGLE: 'auto_process_toggle',
  TAB_SWITCH: 'tab_switch',
  
  // Feature Usage
  SINGLE_MODE_USE: 'single_mode_use',
  BATCH_MODE_USE: 'batch_mode_use',
  
  // Errors
  ERROR: 'error',
} as const;

// Type for event names
type EventName = typeof GA_EVENTS[keyof typeof GA_EVENTS];

// Type definitions for event parameters
interface BaseEventParams {
  [key: string]: string | number | boolean | undefined;
}

interface FileUploadParams extends BaseEventParams {
  file_type: string;
  file_size_bytes: number;
  file_name?: string;
  method: 'click' | 'drag_drop';
}

interface ProcessingParams extends BaseEventParams {
  file_type: string;
  file_size_bytes: number;
  image_width: number;
  image_height: number;
  processing_duration_ms?: number;
  watermark_size?: string;
}

interface BatchParams extends BaseEventParams {
  file_count: number;
  total_size_bytes: number;
  success_count?: number;
  error_count?: number;
  processing_duration_ms?: number;
}

interface ErrorParams extends BaseEventParams {
  error_type: string;
  error_message: string;
  component: string;
}

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'js',
      eventName: string,
      eventParams?: Record<string, string | number | boolean | undefined>
    ) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Check if analytics is enabled (not in development)
 */
function isAnalyticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  // Check if we're in development mode via a flag set in Layout
  const isDev = import.meta.env.DEV;

  // Check if measurement ID is configured
  const measurementId = import.meta.env.PUBLIC_GA_MEASUREMENT_ID;

  return !isDev && !!measurementId;
}

/**
 * Check if gtag is available
 */
function isGtagAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function' && isAnalyticsEnabled();
}

/**
 * Track a custom event with Google Analytics 4
 */
export function trackEvent(
  eventName: EventName | string,
  params: BaseEventParams = {}
): void {
  if (!isGtagAvailable()) {
    // Log in development mode so you can see what would be tracked
    if (import.meta.env.DEV) {
      console.debug('[GA] DEV MODE - Would track:', eventName, params);
    }
    return;
  }

  try {
    window.gtag!('event', eventName, {
      ...params,
      event_timestamp: new Date().toISOString(),
    });
    console.debug('[GA] Event tracked:', eventName, params);
  } catch (error) {
    console.error('[GA] Error tracking event:', error);
  }
}

/**
 * Track file upload event
 */
export function trackFileUpload(
  file: File,
  method: 'click' | 'drag_drop',
  metadata?: { width?: number; height?: number }
): void {
  trackEvent(GA_EVENTS.FILE_UPLOAD, {
    file_type: file.type,
    file_size_bytes: file.size,
    file_name: file.name,
    method,
    image_width: metadata?.width,
    image_height: metadata?.height,
  });
}

/**
 * Track processing start event
 */
export function trackProcessingStart(
  file: File,
  metadata: { width: number; height: number; watermarkSize?: string }
): void {
  trackEvent(GA_EVENTS.PROCESSING_START, {
    file_type: file.type,
    file_size_bytes: file.size,
    image_width: metadata.width,
    image_height: metadata.height,
    watermark_size: metadata.watermarkSize,
  });
}

/**
 * Track processing completion event
 */
export function trackProcessingComplete(
  file: File,
  metadata: { 
    width: number; 
    height: number; 
    durationMs: number;
    watermarkSize?: string;
  }
): void {
  trackEvent(GA_EVENTS.PROCESSING_COMPLETE, {
    file_type: file.type,
    file_size_bytes: file.size,
    image_width: metadata.width,
    image_height: metadata.height,
    processing_duration_ms: metadata.durationMs,
    watermark_size: metadata.watermarkSize,
  });
}

/**
 * Track processing error event
 */
export function trackProcessingError(
  file: File,
  error: Error,
  metadata: { width?: number; height?: number }
): void {
  trackEvent(GA_EVENTS.PROCESSING_ERROR, {
    file_type: file.type,
    file_size_bytes: file.size,
    image_width: metadata.width,
    image_height: metadata.height,
    error_type: error.name,
    error_message: error.message,
  });
}

/**
 * Track download event
 */
export function trackDownload(
  fileName: string,
  fileType: string,
  source: 'single' | 'batch' | 'history'
): void {
  trackEvent(GA_EVENTS.FILE_DOWNLOAD, {
    file_name: fileName,
    file_type: fileType,
    source,
  });
}

/**
 * Track batch upload event
 */
export function trackBatchUpload(
  files: File[],
  totalSizeBytes: number
): void {
  trackEvent(GA_EVENTS.BATCH_UPLOAD, {
    file_count: files.length,
    total_size_bytes: totalSizeBytes,
    file_types: [...new Set(files.map(f => f.type))].join(','),
  });
}

/**
 * Track batch processing event
 */
export function trackBatchProcess(
  params: {
    fileCount: number;
    totalSizeBytes: number;
    durationMs: number;
    successCount: number;
    errorCount: number;
  }
): void {
  trackEvent(GA_EVENTS.BATCH_PROCESS, {
    file_count: params.fileCount,
    total_size_bytes: params.totalSizeBytes,
    processing_duration_ms: params.durationMs,
    success_count: params.successCount,
    error_count: params.errorCount,
    success_rate: Math.round((params.successCount / params.fileCount) * 100),
  });
}

/**
 * Track batch download event
 */
export function trackBatchDownload(
  fileCount: number,
  format: 'individual' | 'zip'
): void {
  trackEvent(GA_EVENTS.BATCH_DOWNLOAD, {
    file_count: fileCount,
    format,
  });
}

/**
 * Track batch clear event
 */
export function trackBatchClear(fileCount: number): void {
  trackEvent(GA_EVENTS.BATCH_CLEAR, {
    file_count: fileCount,
  });
}

/**
 * Track history operations
 */
export function trackHistoryView(itemCount: number): void {
  trackEvent(GA_EVENTS.HISTORY_VIEW, {
    item_count: itemCount,
  });
}

export function trackHistoryDownload(fileName: string): void {
  trackEvent(GA_EVENTS.HISTORY_DOWNLOAD, {
    file_name: fileName,
  });
}

export function trackHistoryDelete(): void {
  trackEvent(GA_EVENTS.HISTORY_DELETE);
}

export function trackHistoryClearAll(itemCount: number): void {
  trackEvent(GA_EVENTS.HISTORY_CLEAR_ALL, {
    item_count: itemCount,
  });
}

export function trackHistoryDownloadAll(itemCount: number): void {
  trackEvent(GA_EVENTS.HISTORY_DOWNLOAD_ALL, {
    item_count: itemCount,
  });
}

/**
 * Track UI interactions
 */
export function trackCompareToggle(isShowingOriginal: boolean): void {
  trackEvent(GA_EVENTS.COMPARE_TOGGLE, {
    show_original: isShowingOriginal,
  });
}

export function trackZoomView(fileName: string): void {
  trackEvent(GA_EVENTS.ZOOM_VIEW, {
    file_name: fileName,
  });
}

export function trackAutoProcessToggle(enabled: boolean): void {
  trackEvent(GA_EVENTS.AUTO_PROCESS_TOGGLE, {
    enabled,
  });
}

export function trackTabSwitch(tabName: 'single' | 'batch' | 'history'): void {
  trackEvent(GA_EVENTS.TAB_SWITCH, {
    tab_name: tabName,
  });
}

/**
 * Track mode usage
 */
export function trackSingleModeUse(): void {
  trackEvent(GA_EVENTS.SINGLE_MODE_USE);
}

export function trackBatchModeUse(): void {
  trackEvent(GA_EVENTS.BATCH_MODE_USE);
}

/**
 * Track generic errors
 */
export function trackError(
  errorType: string,
  errorMessage: string,
  component: string
): void {
  trackEvent(GA_EVENTS.ERROR, {
    error_type: errorType,
    error_message: errorMessage,
    component,
  });
}

/**
 * Track page view manually (for SPA navigation)
 */
export function trackPageView(
  pagePath: string,
  pageTitle: string
): void {
  if (!isGtagAvailable()) {
    // Log in development mode
    if (import.meta.env.DEV) {
      console.debug('[GA] DEV MODE - Would track page view:', pagePath, pageTitle);
    }
    return;
  }

  try {
    window.gtag!('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle,
      page_location: window.location.href,
    });
    console.debug('[GA] Page view tracked:', pagePath);
  } catch (error) {
    console.error('[GA] Error tracking page view:', error);
  }
}

/**
 * Hook for tracking component mount
 */
export function useAnalytics() {
  return {
    trackEvent,
    trackFileUpload,
    trackProcessingStart,
    trackProcessingComplete,
    trackProcessingError,
    trackDownload,
    trackBatchUpload,
    trackBatchProcess,
    trackBatchDownload,
    trackBatchClear,
    trackHistoryView,
    trackHistoryDownload,
    trackHistoryDelete,
    trackHistoryClearAll,
    trackHistoryDownloadAll,
    trackCompareToggle,
    trackZoomView,
    trackAutoProcessToggle,
    trackTabSwitch,
    trackSingleModeUse,
    trackBatchModeUse,
    trackError,
    trackPageView,
  };
}
