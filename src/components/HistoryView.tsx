import * as React from "react";
import { Download, Trash2, Eye, Clock, Archive, RefreshCw, ArrowRight, Calendar, Image as ImageIcon, Check, X } from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { useToast, ToastProvider } from "./ui/Toast";
import type { HistoryItem } from "@/lib/types";
import { getHistory, deleteHistoryItem, clearHistory } from "@/lib/storage";
import { downloadBlob } from "@/lib/watermark";
import { downloadAsZip, type ZipFile } from "@/lib/zip";
import {
  trackHistoryView,
  trackHistoryDownload,
  trackHistoryDelete,
  trackHistoryClearAll,
  trackHistoryDownloadAll,
  trackError,
} from "@/lib/analytics";

interface HistoryViewProps {
  refreshTrigger?: number;
}

function HistoryViewContent({ refreshTrigger }: HistoryViewProps) {
  const [items, setItems] = React.useState<HistoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [previewItem, setPreviewItem] = React.useState<HistoryItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const { addToast } = useToast();

  const loadHistory = React.useCallback(async () => {
    setLoading(true);
    try {
      const history = await getHistory();
      setItems(history);
      trackHistoryView(history.length);
    } catch (error) {
      console.error("Failed to load history:", error);
      trackError('history_load_failed', String(error), 'HistoryView');
      addToast("error", "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory, refreshTrigger]);

  const handleDownload = React.useCallback(
    async (item: HistoryItem) => {
      try {
        const response = await fetch(item.processedDataUrl);
        const blob = await response.blob();
        const pngBlob = new Blob([blob], { type: "image/png" });
        const newFileName = item.fileName.replace(/\.[^.]+$/, "") + "_clean.png";
        downloadBlob(pngBlob, newFileName);
        trackHistoryDownload(newFileName);
        addToast("success", `Downloaded ${newFileName}`);
      } catch (error) {
        console.error("Download error:", error);
        trackError('history_download_failed', String(error), 'HistoryView');
        addToast("error", "Failed to download image");
      }
    },
    [addToast],
  );

  const handleDelete = React.useCallback(
    async (id: string) => {
      try {
        await deleteHistoryItem(id);
        setItems((prev) => prev.filter((i) => i.id !== id));
        trackHistoryDelete();
        addToast("success", "Removed from history");
      } catch (error) {
        console.error("Failed to delete:", error);
        trackError('history_delete_failed', String(error), 'HistoryView');
        addToast("error", "Failed to delete item");
      }
    },
    [addToast],
  );

  const handleClearAll = React.useCallback(async () => {
    setShowClearConfirm(true);
  }, []);

  const confirmClearAll = React.useCallback(async () => {
    setShowClearConfirm(false);
    try {
      const itemCount = items.length;
      await clearHistory();
      setItems([]);
      trackHistoryClearAll(itemCount);
      addToast("success", "History cleared");
    } catch (error) {
      console.error("Failed to clear history:", error);
      trackError('history_clear_failed', String(error), 'HistoryView');
      addToast("error", "Failed to clear history");
    }
  }, [addToast, items.length]);

  const handleDownloadAll = React.useCallback(async () => {
    if (items.length === 0) return;
    addToast("info", "Creating ZIP archive...");
    const files: ZipFile[] = items.map((item) => ({
      name: item.fileName.replace(/\.[^.]+$/, "") + "_clean.png",
      dataUrl: item.processedDataUrl,
    }));
    await downloadAsZip(files, `history_${new Date().toISOString().slice(0, 10)}.zip`);
    trackHistoryDownloadAll(items.length);
    addToast("success", `Downloaded ${files.length} images as ZIP`);
  }, [items, addToast]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatFullDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading history...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="relative mb-8">
          <div className="w-32 h-32 rounded-3xl bg-accent/40 flex items-center justify-center">
            <ImageIcon className="w-16 h-16 text-muted-foreground/30" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
        </div>
        <h3 className="text-2xl font-heading font-semibold text-foreground mb-3">
          No history yet
        </h3>
        <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
          Your processed images will be saved here automatically.
          Everything stays private on your device.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/85 transition-all shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          Start removing watermarks
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Your History
          </h1>
          <p className="text-sm text-muted-foreground">
            {items.length} image{items.length !== 1 ? 's' : ''} saved locally
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleDownloadAll}>
            <Archive className="w-4 h-4 mr-1" />
            Download All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-error"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      {/* Clear Confirm Dialog */}
      {showClearConfirm && (
        <ConfirmDialog
          title="Clear all history?"
          message={`This will remove ${items.length} image${items.length !== 1 ? 's' : ''} from your history. This action cannot be undone.`}
          confirmLabel="Clear All"
          cancelLabel="Cancel"
          onConfirm={confirmClearAll}
          onCancel={() => setShowClearConfirm(false)}
          isDestructive
        />
      )}

      {/* History List - improved layout */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <HistoryListItem
            key={item.id}
            item={item}
            index={index}
            onDownload={() => handleDownload(item)}
            onDelete={() => handleDelete(item.id)}
            onPreview={() => setPreviewItem(item)}
            formatDate={formatDate}
            formatFullDate={formatFullDate}
          />
        ))}
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <HistoryPreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onDownload={() => handleDownload(previewItem)}
          formatFullDate={formatFullDate}
        />
      )}
    </div>
  );
}

export function HistoryView(props: HistoryViewProps) {
  return (
    <ToastProvider>
      <HistoryViewContent {...props} />
    </ToastProvider>
  );
}

interface HistoryListItemProps {
  item: HistoryItem;
  index: number;
  onDownload: () => void;
  onDelete: () => void;
  onPreview: () => void;
  formatDate: (ts: number) => string;
  formatFullDate: (ts: number) => string;
}

function HistoryListItem({
  item,
  index,
  onDownload,
  onDelete,
  onPreview,
  formatDate,
  formatFullDate,
}: HistoryListItemProps) {
  const [showOriginal, setShowOriginal] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className={`group relative bg-card rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden animate-in slide-in-up`}
      style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-4 p-3">
        {/* Thumbnail */}
        <div
          className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden cursor-pointer bg-accent/50"
          onClick={onPreview}
          tabIndex={0}
          role="button"
          aria-label={`Preview ${item.fileName}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPreview();
            }
          }}
        >
          <img
            src={showOriginal ? item.originalDataUrl : item.processedDataUrl}
            alt={item.fileName}
            className="w-full h-full object-cover transition-opacity duration-200"
            loading="lazy"
          />
          {/* Quick action overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p
                className="font-medium text-foreground truncate text-sm"
                title={item.fileName}
              >
                {item.fileName}
              </p>
              <p
                className="text-xs text-muted-foreground mt-0.5"
                title={formatFullDate(item.processedAt)}
              >
                {formatDate(item.processedAt)} · {item.width} × {item.height}
              </p>
            </div>
          </div>
        </div>

        {/* Actions - visible on hover or always show on mobile */}
        <div className="flex items-center gap-1.5 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs"
            onMouseDown={() => setShowOriginal(true)}
            onMouseUp={() => setShowOriginal(false)}
            onMouseLeave={() => setShowOriginal(false)}
            onTouchStart={() => setShowOriginal(true)}
            onTouchEnd={() => setShowOriginal(false)}
          >
            {!showOriginal ? "Compare" : "Original"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-error hover:text-error hover:bg-error/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface HistoryPreviewModalProps {
  item: HistoryItem;
  onClose: () => void;
  onDownload: () => void;
  formatFullDate: (ts: number) => string;
}

function HistoryPreviewModal({
  item,
  onClose,
  onDownload,
  formatFullDate,
}: HistoryPreviewModalProps) {
  const [showOriginal, setShowOriginal] = React.useState(false);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Preview image"
    >
      <div
        className="relative max-w-4xl max-h-full w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={showOriginal ? item.originalDataUrl : item.processedDataUrl}
          alt={item.fileName}
          className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-xl"
        />

        {/* Bottom bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/75 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-lg">
          <button
            onClick={() => setShowOriginal(true)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              showOriginal
                ? "bg-white text-foreground shadow-sm"
                : "text-white hover:bg-white/10"
            }`}
          >
            Original
          </button>
          <button
            onClick={() => setShowOriginal(false)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              !showOriginal
                ? "bg-white text-foreground shadow-sm"
                : "text-white hover:bg-white/10"
            }`}
          >
            Processed
          </button>
          <div className="w-px h-7 bg-white/20" />
          <Button size="sm" onClick={onDownload} variant="default">
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
        </div>

        {/* Top info bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/75 backdrop-blur-xl rounded-2xl px-5 py-2 shadow-lg">
          <ImageIcon className="w-4 h-4 text-white/70" />
          <p className="text-sm text-white font-medium truncate max-w-[200px] sm:max-w-[300px]">
            {item.fileName}
          </p>
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-black/75 text-white flex items-center justify-center hover:bg-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmDialogProps) {
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div
        className="bg-card rounded-2xl shadow-xl max-w-md w-full p-6 animate-in scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="confirm-dialog-title"
          className="text-lg font-heading font-semibold text-foreground mb-2"
        >
          {title}
        </h3>
        <p
          id="confirm-dialog-message"
          className="text-sm text-muted-foreground mb-6 leading-relaxed"
        >
          {message}
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            variant={isDestructive ? "danger" : "default"}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
