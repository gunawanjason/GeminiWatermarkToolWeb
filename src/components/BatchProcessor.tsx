import * as React from "react";
import {
  Upload,
  Play,
  Download,
  Trash2,
  Archive,
  CheckCircle,
  XCircle,
  Eye,
  ZoomIn,
  X,
  Sparkles,
  RefreshCw,
  Clock,
  AlertCircle,
  Loader2,
  ImageIcon,
  Check,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { ProgressBar } from "./ui/ProgressBar";
import { useToast, ToastProvider } from "./ui/Toast";
import type { ImageItem, ProcessingStats } from "@/lib/types";
import { generateId, saveToHistory } from "@/lib/storage";
import { processImage, downloadBlob } from "@/lib/watermark";
import { downloadAsZip, type ZipFile } from "@/lib/zip";
import { cn } from "@/lib/utils";

interface BatchProcessorProps {
  onHistoryUpdated?: () => void;
}

function BatchProcessorContent({ onHistoryUpdated }: BatchProcessorProps) {
  const [images, setImages] = React.useState<ImageItem[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [previewItem, setPreviewItem] = React.useState<ImageItem | null>(null);
  const [autoProcess, setAutoProcess] = React.useState(true);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const { addToast } = useToast();

  const stats: ProcessingStats = React.useMemo(() => {
    return {
      total: images.length,
      completed: images.filter((i) => i.status === "completed").length,
      failed: images.filter((i) => i.status === "error").length,
      pending: images.filter((i) => i.status === "pending").length,
    };
  }, [images]);

  // Process a single image
  const processOneImage = React.useCallback(async (item: ImageItem) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    try {
      const img = new Image();
      img.src = item.originalDataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      await processImage(canvas, img);
      return canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Error processing:", error);
      return null;
    }
  }, []);

  // Auto-process new images
  const processNewImages = React.useCallback(
    async (newItems: ImageItem[]) => {
      if (!autoProcess) return;

      setIsProcessing(true);

      for (const item of newItems) {
        setImages((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "processing" } : i,
          ),
        );

        const processedDataUrl = await processOneImage(item);

        if (processedDataUrl) {
          setImages((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: "completed",
                    processedDataUrl,
                    processedAt: Date.now(),
                  }
                : i,
            ),
          );

          await saveToHistory({
            id: item.id,
            fileName: item.file.name,
            originalDataUrl: item.originalDataUrl,
            processedDataUrl,
            width: item.width,
            height: item.height,
            processedAt: Date.now(),
          });
        } else {
          setImages((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: "error", error: "Processing failed" }
                : i,
            ),
          );
        }
      }

      setIsProcessing(false);
      onHistoryUpdated?.();
      addToast("success", `Processed ${newItems.length} image(s)`);
    },
    [autoProcess, processOneImage, addToast, onHistoryUpdated],
  );

  const handleFiles = React.useCallback(
    async (files: FileList | File[]) => {
      const validFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/"),
      );

      if (validFiles.length === 0) {
        addToast("error", "No valid image files found");
        return;
      }

      const newItems: ImageItem[] = [];

      for (const file of validFiles) {
        const dataUrl = await readFileAsDataUrl(file);
        const { width, height } = await getImageDimensions(dataUrl);

        newItems.push({
          id: generateId(),
          file,
          originalDataUrl: dataUrl,
          processedDataUrl: null,
          status: autoProcess ? "pending" : "pending",
          width,
          height,
          addedAt: Date.now(),
        });
      }

      setImages((prev) => [...prev, ...newItems]);
      addToast("info", `Added ${newItems.length} image(s)`);

      // Auto-process if enabled
      if (autoProcess) {
        processNewImages(newItems);
      }
    },
    [addToast, autoProcess, processNewImages],
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleProcessAll = React.useCallback(async () => {
    const pending = images.filter((i) => i.status === "pending");
    if (pending.length === 0) {
      addToast("info", "No pending images to process");
      return;
    }

    await processNewImages(pending);
  }, [images, addToast, processNewImages]);

  const handleDownload = React.useCallback(
    async (item: ImageItem) => {
      if (!item.processedDataUrl) return;

      try {
        const response = await fetch(item.processedDataUrl);
        const blob = await response.blob();
        const pngBlob = new Blob([blob], { type: "image/png" });
        const newFileName =
          item.file.name.replace(/\.[^.]+$/, "") + "_clean.png";
        downloadBlob(pngBlob, newFileName);
        addToast("success", `Downloaded ${newFileName}`);
      } catch (error) {
        console.error("Download error:", error);
        addToast("error", "Failed to download image");
      }
    },
    [addToast],
  );

  const handleDownloadAll = React.useCallback(async () => {
    const completed = images.filter(
      (i) => i.status === "completed" && i.processedDataUrl,
    );

    if (completed.length === 0) {
      addToast("error", "No processed images to download");
      return;
    }

    addToast("info", "Creating ZIP archive...");

    const files: ZipFile[] = completed.map((item) => ({
      name: item.file.name.replace(/\.[^.]+$/, "") + "_clean.png",
      dataUrl: item.processedDataUrl!,
    }));

    await downloadAsZip(
      files,
      `processed_images_${new Date().toISOString().slice(0, 10)}.zip`,
    );
    addToast("success", `Downloaded ${files.length} images as ZIP`);
  }, [images, addToast]);

  const handleRemove = React.useCallback((id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleClearAll = React.useCallback(() => {
    setImages([]);
    setSelectedIds(new Set());
  }, []);

  const handleToggleSelect = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = React.useCallback(() => {
    setSelectedIds(new Set(images.map((i) => i.id)));
  }, [images]);

  const handleDeselectAll = React.useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleRemoveSelected = React.useCallback(() => {
    setImages((prev) => prev.filter((i) => !selectedIds.has(i.id)));
    setSelectedIds(new Set());
  }, [selectedIds]);

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <Card>
        <CardContent className="p-6">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer",
              "transition-all duration-300 ease-out",
              isDragging
                ? "border-primary bg-primary/10 scale-[1.02]"
                : "border-accent hover:border-primary/50 hover:bg-card/50",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
            />

            <div className="space-y-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <Upload className="w-10 h-10 text-primary" />
              </div>
              <div>
                <p className="text-xl font-medium text-foreground">
                  Drop multiple images here
                </p>
                <p className="text-muted-foreground mt-2">or click to browse</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  PNG, JPG, WebP supported • No limit on file count
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                <Sparkles className="w-4 h-4" />
                <span>Auto-processes all images on upload</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats & Actions Bar */}
      {images.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium text-foreground">
                  {stats.total} image(s)
                </span>
                {stats.completed > 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    {stats.completed} done
                  </span>
                )}
                {isProcessing && stats.pending > 0 && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </span>
                )}
                {stats.failed > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-4 h-4" />
                    {stats.failed} failed
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveSelected}
                    className="text-red-500"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove {selectedIds.size}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={isProcessing}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>

                {stats.completed > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadAll}
                  >
                    <Archive className="w-4 h-4 mr-1" />
                    Download ZIP ({stats.completed})
                  </Button>
                )}

                {!autoProcess && stats.pending > 0 && (
                  <Button
                    onClick={handleProcessAll}
                    disabled={isProcessing}
                    size="sm"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Process ({stats.pending})
                  </Button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {isProcessing && (
              <div className="mt-4">
                <ProgressBar
                  value={stats.completed}
                  max={stats.total - stats.failed}
                  showLabel
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Selection Controls */}
      {images.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleSelectAll}>
            Select All
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          )}
        </div>
      )}

      {/* Image Grid */}
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mb-4">
            <ImageIcon className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            No images yet
          </h3>
          <p className="text-muted-foreground">
            Drag and drop images or click to upload
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((item) => (
            <ImageCard
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={() => handleToggleSelect(item.id)}
              onRemove={() => handleRemove(item.id)}
              onDownload={() => handleDownload(item)}
              onPreview={() => setPreviewItem(item)}
            />
          ))}
        </div>
      )}

      {/* Hidden Canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Preview Modal */}
      {previewItem && (
        <ImagePreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onDownload={() => handleDownload(previewItem)}
        />
      )}
    </div>
  );
}

export function BatchProcessor(props: BatchProcessorProps) {
  return (
    <ToastProvider>
      <BatchProcessorContent {...props} />
    </ToastProvider>
  );
}

// Helper functions
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = dataUrl;
  });
}

// Image Card Component
interface ImageCardProps {
  item: ImageItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onDownload: () => void;
  onPreview: () => void;
}

function ImageCard({
  item,
  isSelected,
  onToggleSelect,
  onRemove,
  onDownload,
  onPreview,
}: ImageCardProps) {
  const [showProcessed, setShowProcessed] = React.useState(true);

  const displayImage =
    showProcessed && item.processedDataUrl
      ? item.processedDataUrl
      : item.originalDataUrl;

  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden border-2 transition-all duration-200",
        "bg-card shadow-md hover:shadow-lg",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-transparent hover:border-accent",
      )}
    >
      {/* Selection Checkbox */}
      <button
        onClick={onToggleSelect}
        className={cn(
          "absolute top-2 left-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center",
          "transition-all duration-200",
          isSelected
            ? "bg-primary border-primary text-white"
            : "bg-white/80 border-accent/50 hover:border-primary",
        )}
      >
        {isSelected && <Check className="w-4 h-4" />}
      </button>

      {/* Status Badge - top right */}
      <StatusBadge status={item.status} />

      {/* Image */}
      <div
        className="aspect-square cursor-pointer relative"
        onClick={onPreview}
      >
        <img
          src={displayImage}
          alt={item.file.name}
          className="w-full h-full object-cover"
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <ZoomIn className="w-8 h-8 text-white" />
        </div>
      </div>

      {/* Info Bar */}
      <div className="p-2">
        <p className="text-xs font-medium text-foreground truncate">
          {item.file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.width} × {item.height}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="px-2 pb-2 flex gap-1">
        {item.status === "completed" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 text-xs"
              onMouseDown={() => setShowProcessed(false)}
              onMouseUp={() => setShowProcessed(true)}
              onMouseLeave={() => setShowProcessed(true)}
            >
              {!showProcessed ? "Original" : "Compare"}
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
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: ImageItem["status"] }) {
  const config = {
    pending: {
      icon: <Clock className="w-3 h-3" />,
      bg: "bg-amber-100",
      text: "text-amber-700",
      label: "Pending",
    },
    processing: {
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      bg: "bg-blue-100",
      text: "text-blue-700",
      label: "Processing",
    },
    completed: {
      icon: <CheckCircle className="w-3 h-3" />,
      bg: "bg-green-100",
      text: "text-green-700",
      label: "Done",
    },
    error: {
      icon: <AlertCircle className="w-3 h-3" />,
      bg: "bg-red-100",
      text: "text-red-700",
      label: "Error",
    },
  };

  const { icon, bg, text, label } = config[status];

  return (
    <div
      className={cn(
        "absolute top-2 right-2 z-10 px-2 py-1 rounded-full flex items-center gap-1",
        "text-xs font-medium",
        bg,
        text,
      )}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

// Preview Modal Component
interface ImagePreviewModalProps {
  item: ImageItem;
  onClose: () => void;
  onDownload: () => void;
}

function ImagePreviewModal({
  item,
  onClose,
  onDownload,
}: ImagePreviewModalProps) {
  const [showOriginal, setShowOriginal] = React.useState(false);
  const displayImage =
    showOriginal || !item.processedDataUrl
      ? item.originalDataUrl
      : item.processedDataUrl;

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-6xl max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={displayImage}
          alt={item.file.name}
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
        />

        {/* Controls */}
        {item.processedDataUrl && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-full px-6 py-3">
            <button
              onClick={() => setShowOriginal(true)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                showOriginal
                  ? "bg-white text-black"
                  : "text-white hover:bg-white/20",
              )}
            >
              Original
            </button>
            <button
              onClick={() => setShowOriginal(false)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                !showOriginal
                  ? "bg-white text-black"
                  : "text-white hover:bg-white/20",
              )}
            >
              Processed
            </button>
            <div className="w-px h-6 bg-white/30" />
            <Button size="sm" onClick={onDownload}>
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-12 h-12 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
