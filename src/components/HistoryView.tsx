import * as React from "react";
import {
  Download,
  Trash2,
  Eye,
  Clock,
  Archive,
  RefreshCw,
  ArrowRight,
  Image as ImageIcon,
  Check,
  X,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { useToast, ToastProvider } from "./ui/Toast";
import type { HistoryItem } from "@/lib/types";
import { getHistory, deleteHistoryItem, clearHistory } from "@/lib/storage";
import { downloadBlob } from "@/lib/watermark";
import { downloadAsZip, type ZipFile } from "@/lib/zip";
import { cn } from "@/lib/utils";
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
      trackHistoryView(history.length);
    } catch (error) {
      console.error("Failed to load history:", error);
      trackError("history_load_failed", String(error), "HistoryView");
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
        const newFileName =
          item.fileName.replace(/\.[^.]+$/, "") + "_clean.png";
        downloadBlob(pngBlob, newFileName);
        trackHistoryDownload(newFileName);
        addToast("success", `Downloaded ${newFileName}`);
      } catch (error) {
        console.error("Download error:", error);
        trackError("history_download_failed", String(error), "HistoryView");
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
        trackError("history_delete_failed", String(error), "HistoryView");
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
      trackError("history_clear_failed", String(error), "HistoryView");
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
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
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
          <p className="text-sm text-muted-foreground font-medium">
            Loading history...
          </p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl" />
          <div className="relative w-32 h-32 rounded-3xl bg-gradient-to-br from-primary/10 to-accent flex items-center justify-center border border-primary/10">
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
          Your processed images will be saved here automatically. Everything
          stays private on your device.
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Your History
          </h1>
          <p className="text-sm text-muted-foreground">
            {items.length} image{items.length !== 1 ? "s" : ""} saved locally
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleDownloadAll}>
            <Archive className="w-4 h-4 mr-1.5" />
            Download All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-error"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Clear
          </Button>
        </div>
      </div>

      {showClearConfirm && (
        <ConfirmDialog
          title="Clear all history?"
          message={`This will remove ${items.length} image${items.length !== 1 ? "s" : ""} from your history. This action cannot be undone.`}
          confirmLabel="Clear All"
          cancelLabel="Cancel"
          onConfirm={confirmClearAll}
          onCancel={() => setShowClearConfirm(false)}
          isDestructive
        />
      )}

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

  return (
    <div
      className="group relative bg-card rounded-2xl border border-transparent hover:border-border/60 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden animate-in slide-in-up"
      style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
    >
      <div className="flex items-center gap-3 sm:gap-4 p-3">
        <div
          className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden cursor-pointer bg-accent/50"
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
            src={
              showOriginal ? item.originalDataUrl : item.processedDataUrl
            }
            alt={item.fileName}
            className="w-full h-full object-cover transition-all duration-200"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p
                className="font-medium text-foreground truncate text-sm"
                title={item.fileName}
              >
                {item.fileName}
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <span
                  className="flex items-center gap-1"
                  title={formatFullDate(item.processedAt)}
                >
                  <Clock className="w-3 h-3" />
                  {formatDate(item.processedAt)}
                </span>
                <span className="text-border">•</span>
                <span>
                  {item.width} × {item.height}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] px-2.5 text-xs"
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
            className="min-h-[44px] min-w-[44px] px-2.5"
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
            className="min-h-[44px] min-w-[44px] px-2.5 text-error hover:text-error hover:bg-error/10"
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
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 sm:p-4 animate-in fade-in"
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
          src={
            showOriginal ? item.originalDataUrl : item.processedDataUrl
          }
          alt={item.fileName}
          className="w-full max-h-[80vh] sm:max-h-[85vh] object-contain rounded-xl sm:rounded-2xl shadow-xl animate-in scale-in"
        />

        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-xl rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 shadow-lg max-w-[70vw]">
          <ImageIcon className="w-3.5 h-3.5 text-white/70" />
          <p className="text-xs sm:text-sm text-white font-medium truncate">
            {item.fileName}
          </p>
        </div>

        <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-3 bg-black/75 backdrop-blur-xl rounded-xl sm:rounded-2xl px-2.5 py-2 sm:px-5 sm:py-3 shadow-lg max-w-[95vw] overflow-x-auto">
          <button
            onClick={() => setShowOriginal(true)}
            className={cn(
              "px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 whitespace-nowrap min-h-[44px]",
              showOriginal
                ? "bg-white text-foreground shadow-sm"
                : "text-white hover:bg-white/10",
            )}
          >
            Original
          </button>
          <button
            onClick={() => setShowOriginal(false)}
            className={cn(
              "px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 whitespace-nowrap min-h-[44px]",
              !showOriginal
                ? "bg-white text-foreground shadow-sm"
                : "text-white hover:bg-white/10",
            )}
          >
            Processed
          </button>
          <div className="w-px h-5 sm:h-7 bg-white/20 flex-shrink-0 hidden sm:block" />
          <Button size="sm" onClick={onDownload} variant="default" className="flex-shrink-0 min-h-[44px]">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Download</span>
          </Button>
        </div>

        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 min-w-[44px] min-h-[44px]"
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
        className="bg-card rounded-2xl shadow-xl max-w-md w-full p-6 animate-in scale-in border border-border/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            isDestructive ? "bg-error/10" : "bg-primary/10",
          )}>
            <Trash2 className={cn("w-5 h-5", isDestructive ? "text-error" : "text-primary")} />
          </div>
          <h3
            id="confirm-dialog-title"
            className="text-lg font-heading font-semibold text-foreground"
          >
            {title}
          </h3>
        </div>
        <p
          id="confirm-dialog-message"
          className="text-sm text-muted-foreground mb-6 leading-relaxed pl-[52px]"
        >
          {message}
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
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
