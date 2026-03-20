import * as React from "react";
import { Download, Trash2, Eye, Clock, Archive, RefreshCw } from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
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
  const [previewItem, setPreviewItem] = React.useState<HistoryItem | null>(
    null,
  );
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const { addToast } = useToast();

  const loadHistory = React.useCallback(async () => {
    setLoading(true);
    try {
      const history = await getHistory();
      setItems(history);

      // Track history view with item count
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
        // Convert data URL directly to blob
        const response = await fetch(item.processedDataUrl);
        const blob = await response.blob();

        // Create a new blob with explicit PNG type
        const pngBlob = new Blob([blob], { type: "image/png" });

        const newFileName =
          item.fileName.replace(/\.[^.]+$/, "") + "_clean.png";
        downloadBlob(pngBlob, newFileName);

        // Track history download
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

        // Track history delete
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

      // Track history clear all
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

    await downloadAsZip(
      files,
      `history_${new Date().toISOString().slice(0, 10)}.zip`,
    );

    // Track history download all
    trackHistoryDownloadAll(items.length);

    addToast("success", `Downloaded ${files.length} images as ZIP`);
  }, [items, addToast]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mb-4">
          <Clock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          No history yet
        </h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Processed images are automatically saved here. You can download them anytime or clear your history.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        >
          Process your first image
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <ConfirmDialog
          title="Clear All History"
          message={`Are you sure you want to clear all ${items.length} item(s) from history? This action cannot be undone.`}
          confirmLabel="Clear All"
          cancelLabel="Cancel"
          onConfirm={confirmClearAll}
          onCancel={() => setShowClearConfirm(false)}
          isDestructive
        />
      )}

      {/* Actions Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">
              {items.length} processed image(s)
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={loadHistory}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
              <Button variant="secondary" size="sm" onClick={handleDownloadAll}>
                <Archive className="w-4 h-4 mr-1" />
                Download All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="text-red-500"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <HistoryCard
            key={item.id}
            item={item}
            onDownload={() => handleDownload(item)}
            onDelete={() => handleDelete(item.id)}
            onPreview={() => setPreviewItem(item)}
            formatDate={formatDate}
          />
        ))}
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <HistoryPreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onDownload={() => handleDownload(previewItem)}
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

interface HistoryCardProps {
  item: HistoryItem;
  onDownload: () => void;
  onDelete: () => void;
  onPreview: () => void;
  formatDate: (ts: number) => string;
}

function HistoryCard({
  item,
  onDownload,
  onDelete,
  onPreview,
  formatDate,
}: HistoryCardProps) {
  const [showOriginal, setShowOriginal] = React.useState(false);

  return (
    <div className="group relative rounded-xl overflow-hidden border bg-card shadow-md hover:shadow-lg transition-all duration-200">
      {/* Image */}
      <div
        className="aspect-square cursor-pointer relative focus-within:ring-2 focus-within:ring-primary/50 focus-within:ring-offset-2 rounded-t-xl"
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
          className="w-full h-full object-cover rounded-t-xl"
          loading="lazy"
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 ease-out flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none rounded-t-xl">
          <Eye className="w-8 h-8 text-white" />
        </div>
      </div>

      {/* Info Bar */}
      <div className="p-2">
        <p
          className="text-xs font-medium text-foreground truncate"
          title={item.fileName}
        >
          {item.fileName}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(item.processedAt)}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="px-2 pb-2 flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-8 text-xs"
          onMouseDown={() => setShowOriginal(true)}
          onMouseUp={() => setShowOriginal(false)}
          onMouseLeave={() => setShowOriginal(false)}
          onTouchStart={() => setShowOriginal(true)}
          onTouchEnd={() => setShowOriginal(false)}
        >
          {showOriginal ? "Original" : "Compare"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
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
          className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

interface HistoryPreviewModalProps {
  item: HistoryItem;
  onClose: () => void;
  onDownload: () => void;
}

function HistoryPreviewModal({
  item,
  onClose,
  onDownload,
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
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Preview image"
    >
      <div
        className="relative max-w-5xl max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={showOriginal ? item.originalDataUrl : item.processedDataUrl}
          alt={item.fileName}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />

        {/* Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
          <button
            onMouseDown={() => setShowOriginal(true)}
            onMouseUp={() => setShowOriginal(false)}
            onMouseLeave={() => setShowOriginal(false)}
            onTouchStart={() => setShowOriginal(true)}
            onTouchEnd={() => setShowOriginal(false)}
            className="px-4 py-2 text-white text-sm font-medium rounded-full hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {showOriginal ? "Original" : "Hold to compare"}
          </button>

          <Button size="sm" onClick={onDownload}>
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Confirm Dialog Component
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
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div
        className="bg-card rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="confirm-dialog-title"
          className="text-lg font-semibold text-foreground mb-2"
        >
          {title}
        </h3>
        <p
          id="confirm-dialog-message"
          className="text-sm text-muted-foreground mb-6"
        >
          {message}
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className={isDestructive ? "bg-red-600 hover:bg-red-700 text-white" : ""}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
