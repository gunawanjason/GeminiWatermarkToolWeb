import * as React from "react";
import {
  Upload,
  Play,
  Download,
  Trash2,
  Archive,
  CheckCircle,
  XCircle,
  ZoomIn,
  X,
  Sparkles,
  Clock,
  AlertCircle,
  Loader2,
  Check,
  Layers,
  FileImage,
  ShieldCheck,
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
import {
  trackBatchUpload,
  trackBatchProcess,
  trackBatchDownload,
  trackBatchClear,
  trackDownload,
  trackBatchModeUse,
  trackError,
} from "@/lib/analytics";

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
  const [batchStartTime, setBatchStartTime] = React.useState<number>(0);
  const [uploadedFiles, setUploadedFiles] = React.useState<File[]>([]);
  const [currentProcessingIndex, setCurrentProcessingIndex] =
    React.useState<number>(-1);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const { addToast } = useToast();

  React.useEffect(() => {
    trackBatchModeUse();
  }, []);

  const stats: ProcessingStats = React.useMemo(() => {
    return {
      total: images.length,
      completed: images.filter((i) => i.status === "completed").length,
      failed: images.filter((i) => i.status === "error").length,
      pending: images.filter((i) => i.status === "pending").length,
    };
  }, [images]);

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
      trackError("batch_processing_error", String(error), "BatchProcessor");
      return null;
    }
  }, []);

  const processNewImages = React.useCallback(
    async (newItems: ImageItem[]) => {
      if (!autoProcess) return;

      setIsProcessing(true);
      const startTime = Date.now();
      setBatchStartTime(startTime);

      let successCount = 0;
      let errorCount = 0;

      for (let idx = 0; idx < newItems.length; idx++) {
        const item = newItems[idx];
        setCurrentProcessingIndex(images.indexOf(item));

        setImages((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "processing" } : i,
          ),
        );

        const processedDataUrl = await processOneImage(item);

        if (processedDataUrl) {
          successCount++;
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
          errorCount++;
          setImages((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: "error", error: "Processing failed" }
                : i,
            ),
          );
        }
      }

      setCurrentProcessingIndex(-1);
      setIsProcessing(false);
      onHistoryUpdated?.();

      const totalSizeBytes = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
      trackBatchProcess({
        fileCount: newItems.length,
        totalSizeBytes,
        durationMs: Date.now() - startTime,
        successCount,
        errorCount,
      });

      addToast("success", `Processed ${newItems.length} image(s)`);
    },
    [
      autoProcess,
      processOneImage,
      addToast,
      onHistoryUpdated,
      uploadedFiles,
      images,
    ],
  );

  const handleFiles = React.useCallback(
    async (files: FileList | File[]) => {
      const validFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/"),
      );

      if (validFiles.length === 0) {
        trackError(
          "invalid_batch_files",
          "No valid image files in batch upload",
          "BatchProcessor",
        );
        addToast("error", "No valid image files found");
        return;
      }

      const totalSizeBytes = validFiles.reduce((sum, f) => sum + f.size, 0);
      setUploadedFiles((prev) => [...prev, ...validFiles]);
      trackBatchUpload(validFiles, totalSizeBytes);

      const newItems: ImageItem[] = [];

      for (const file of validFiles) {
        const dataUrl = await readFileAsDataUrl(file);
        const { width, height } = await getImageDimensions(dataUrl);

        newItems.push({
          id: generateId(),
          file,
          originalDataUrl: dataUrl,
          processedDataUrl: null,
          status: "pending",
          width,
          height,
          addedAt: Date.now(),
        });
      }

      setImages((prev) => [...prev, ...newItems]);
      addToast("info", `Added ${newItems.length} image(s)`);

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

        trackDownload(newFileName, "image/png", "batch");

        addToast("success", `Downloaded ${newFileName}`);
      } catch (error) {
        console.error("Download error:", error);
        trackError("batch_download_failed", String(error), "BatchProcessor");
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

    trackBatchDownload(completed.length, "zip");

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
    <div className="space-y-8">
      <div className="text-center space-y-4 max-w-2xl mx-auto slide-in-up">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          <span>Batch Process</span>
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          Multiple Images at Once
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Upload several images and we'll remove watermarks from all of them.
          Download individually or as a tidy ZIP file.
        </p>
        <div className="flex items-center justify-center gap-4 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span>100% Local</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Archive className="w-3.5 h-3.5 text-primary" />
            <span>ZIP Download</span>
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>Unlimited</span>
          </div>
        </div>
      </div>

      <Card className="shadow-sm scale-in">
        <CardContent className="p-6 sm:p-8">
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
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Upload multiple images"
            className={cn(
              "relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer",
              "transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01] shadow-lg shadow-primary/10"
                : "border-border hover:border-primary/50 hover:bg-accent/30",
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

            <div className="space-y-6">
              <div
                className={cn(
                  "mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sage-gradient flex items-center justify-center shadow-md transition-all duration-300",
                  isDragging && "scale-110 rotate-3",
                )}
              >
                <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <div>
                <p className="text-lg sm:text-xl font-medium text-foreground">
                  {isDragging
                    ? "Drop your images here!"
                    : "Drop multiple images here"}
                </p>
                <p className="text-muted-foreground mt-2">or click to browse</p>
                <p className="text-xs sm:text-sm text-muted-foreground/60 mt-3">
                  PNG, JPG, WebP supported • No limit on file count
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <div className="h-px w-8 sm:w-12 bg-border" />
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Drag & Drop Multiple
                </span>
                <div className="h-px w-8 sm:w-12 bg-border" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {images.length > 0 && (
        <Card className="shadow-sm fade-in">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10">
                  <Layers className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    {stats.total} image{stats.total !== 1 ? "s" : ""}
                  </span>
                </div>

                {stats.completed > 0 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-success/10">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="text-sm font-medium text-success">
                      {stats.completed} complete
                    </span>
                  </div>
                )}

                {isProcessing && stats.pending > 0 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-warning/10">
                    <Loader2 className="w-4 h-4 text-warning animate-spin" />
                    <span className="text-sm font-medium text-warning">
                      Processing...
                    </span>
                  </div>
                )}

                {stats.failed > 0 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-error/10">
                    <XCircle className="w-4 h-4 text-error" />
                    <span className="text-sm font-medium text-error">
                      {stats.failed} failed
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                {selectedIds.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveSelected}
                    className="text-error min-h-[44px] px-3"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">
                      Remove ({selectedIds.size})
                    </span>
                    <span className="sm:hidden">({selectedIds.size})</span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleClearAll();
                    trackBatchClear(images.length);
                  }}
                  disabled={isProcessing}
                  className="min-h-[44px] px-3"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">Clear</span>
                </Button>

                {stats.completed > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadAll}
                    className="min-h-[44px]"
                  >
                    <Archive className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">
                      ZIP ({stats.completed})
                    </span>
                    <span className="sm:hidden">({stats.completed})</span>
                  </Button>
                )}

                {!autoProcess && stats.pending > 0 && (
                  <Button
                    onClick={handleProcessAll}
                    disabled={isProcessing}
                    size="sm"
                    className="min-h-[44px]"
                  >
                    <Play className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">
                      Process ({stats.pending})
                    </span>
                  </Button>
                )}
              </div>
            </div>

            {isProcessing && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Processing images...</span>
                  <span>
                    {stats.completed} / {stats.total - stats.failed}
                  </span>
                </div>
                <ProgressBar
                  value={stats.completed}
                  max={stats.total - stats.failed}
                  showLabel={false}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {images.length > 0 && (
        <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-muted/30 border border-border/30 fade-in">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                selectedIds.size === images.length
                  ? handleDeselectAll()
                  : handleSelectAll()
              }
              className={cn(
                "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 min-w-[44px] min-h-[44px]",
                "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
                selectedIds.size === images.length && images.length > 0
                  ? "bg-primary border-primary text-white"
                  : "border-border hover:border-primary",
              )}
              aria-label="Select all images"
            >
              {selectedIds.size === images.length && images.length > 0 && (
                <Check className="w-3.5 h-3.5" />
              )}
            </button>
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size === images.length && images.length > 0
                ? "All selected"
                : selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : "Select all"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeselectAll}
            className={cn(
              "h-8 text-xs transition-all duration-200",
              selectedIds.size === 0 && "invisible",
            )}
          >
            Clear selection
          </Button>
        </div>
      )}

      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center fade-in">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl" />
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-primary/10 to-accent flex items-center justify-center border border-primary/10">
              <div className="flex items-end gap-1">
                <FileImage className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/30" />
                <FileImage className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/20 -translate-y-2" />
                <FileImage className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/10 -translate-y-4" />
              </div>
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-heading font-semibold text-foreground mb-3">
            No images yet
          </h3>
          <p className="text-muted-foreground max-w-md leading-relaxed mb-6">
            Drag and drop multiple images or click the upload zone above.
            Supports PNG, JPG, and WebP formats.
          </p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="lg"
          >
            <Upload className="w-5 h-5 mr-2" />
            Browse Images
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {images.map((item, index) => (
            <ImageCard
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              isCurrentlyProcessing={currentProcessingIndex === index}
              onToggleSelect={() => handleToggleSelect(item.id)}
              onRemove={() => handleRemove(item.id)}
              onDownload={() => handleDownload(item)}
              onPreview={() => setPreviewItem(item)}
            />
          ))}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

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

interface ImageCardProps {
  item: ImageItem;
  isSelected: boolean;
  isCurrentlyProcessing?: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onDownload: () => void;
  onPreview: () => void;
}

function ImageCard({
  item,
  isSelected,
  isCurrentlyProcessing = false,
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
        "group relative rounded-2xl overflow-hidden border-2 transition-all duration-300",
        "bg-card shadow-sm hover:shadow-lg card-lift",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-transparent hover:border-border",
        isCurrentlyProcessing && "ring-2 ring-primary/30 border-primary/50",
      )}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        className={cn(
          "absolute top-2.5 left-2.5 z-20 rounded-lg border-2 flex items-center justify-center",
          "transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
          "w-6 h-6 min-w-[44px] min-h-[44px]",
          isSelected
            ? "bg-primary border-primary text-primary-foreground scale-105"
            : "bg-white/95 border-border hover:border-primary hover:bg-white",
        )}
        aria-label={isSelected ? "Deselect image" : "Select image"}
      >
        {isSelected && <Check className="w-3.5 h-3.5" />}
      </button>

      <StatusBadge
        status={item.status}
        isCurrentlyProcessing={isCurrentlyProcessing}
      />

      <div
        className={cn(
          "aspect-square cursor-pointer relative focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2 rounded-t-2xl overflow-hidden",
          item.status === "processing" || isCurrentlyProcessing
            ? "opacity-70"
            : "",
        )}
        onClick={onPreview}
        tabIndex={0}
        role="button"
        aria-label={`Preview ${item.file.name}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPreview();
          }
        }}
      >
        <img
          src={displayImage}
          alt={item.file.name}
          className={cn(
            "w-full h-full object-cover transition-transform duration-500",
            "group-hover:scale-105 group-focus-visible:scale-105",
          )}
          loading="lazy"
        />

        {(item.status === "processing" || isCurrentlyProcessing) && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          </div>
        )}

        <div
          className={cn(
            "absolute inset-0 bg-black/0 flex items-center justify-center",
            "transition-all duration-300 ease-out",
            "group-hover:bg-black/20",
            item.status === "processing" || isCurrentlyProcessing
              ? "opacity-0"
              : "opacity-0 group-hover:opacity-100",
          )}
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/90 flex items-center justify-center shadow-sm transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <ZoomIn className="w-5 h-5 sm:w-6 sm:h-6 text-foreground" />
          </div>
        </div>
      </div>

      <div className="p-2.5 sm:p-3 border-t border-border/40">
        <p
          className="text-xs sm:text-sm font-medium text-foreground truncate"
          title={item.file.name}
        >
          {item.file.name}
        </p>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <span>
            {item.width} × {item.height}
          </span>
          {item.status === "completed" && (
            <>
              <span>•</span>
              <CheckCircle className="w-3 h-3 text-success" />
            </>
          )}
        </p>
      </div>

      <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3 flex gap-1.5">
        {item.status === "completed" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 min-h-[44px] text-xs sm:text-sm font-medium"
              onMouseDown={() => setShowProcessed(false)}
              onMouseUp={() => setShowProcessed(true)}
              onMouseLeave={() => setShowProcessed(true)}
              onTouchStart={() => setShowProcessed(false)}
              onTouchEnd={() => setShowProcessed(true)}
            >
              {!showProcessed ? "Original" : "Compare"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px] min-w-[44px] p-0"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              aria-label="Download image"
            >
              <Download className="w-4 h-4" />
            </Button>
          </>
        )}
        {item.status === "error" && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 min-h-[44px] text-xs sm:text-sm font-medium text-error"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            Remove Failed
          </Button>
        )}
        {item.status !== "error" && (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] min-w-[44px] p-0 text-error hover:text-error hover:bg-error/10"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Remove image"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  isCurrentlyProcessing,
}: {
  status: ImageItem["status"];
  isCurrentlyProcessing?: boolean;
}) {
  const config = {
    pending: {
      icon: <Clock className="w-3 h-3" />,
      bg: "bg-warning/15",
      text: "text-warning",
      label: "Pending",
    },
    processing: {
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      bg: "bg-primary",
      text: "text-white",
      label: "Processing",
    },
    completed: {
      icon: <CheckCircle className="w-3 h-3" />,
      bg: "bg-success",
      text: "text-white",
      label: "Complete",
    },
    error: {
      icon: <AlertCircle className="w-3 h-3" />,
      bg: "bg-error",
      text: "text-white",
      label: "Failed",
    },
  };

  const { icon, bg, text, label } = config[status];

  return (
    <div
      className={cn(
        "absolute top-2.5 right-2.5 z-10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1 sm:gap-1.5",
        "text-[10px] sm:text-xs font-medium shadow-sm backdrop-blur-sm",
        bg,
        text,
        isCurrentlyProcessing && "animate-pulse",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

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
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 sm:p-4 animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Preview image"
    >
      <div
        className="relative max-w-6xl max-h-full w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={displayImage}
          alt={item.file.name}
          className="w-full max-h-[80vh] sm:max-h-[90vh] object-contain rounded-xl sm:rounded-2xl shadow-2xl animate-in scale-in"
        />

        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs sm:text-sm font-medium max-w-[70vw] truncate">
          {item.file.name}
        </div>

        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 min-w-[44px] min-h-[44px]"
          aria-label="Close preview"
        >
          <X className="w-5 h-5" />
        </button>

        {item.processedDataUrl && (
          <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-3 bg-black/70 backdrop-blur-xl rounded-xl sm:rounded-2xl px-3 py-2 sm:px-6 sm:py-4 shadow-lg max-w-[95vw] overflow-x-auto">
            <button
              onClick={() => setShowOriginal(true)}
              className={cn(
                "px-3 py-2.5 sm:px-5 sm:py-2.5 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 whitespace-nowrap min-h-[44px]",
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
                "px-3 py-2.5 sm:px-5 sm:py-2.5 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 whitespace-nowrap min-h-[44px]",
                !showOriginal
                  ? "bg-white text-foreground shadow-sm"
                  : "text-white hover:bg-white/10",
              )}
            >
              Processed
            </button>
            <div className="w-px h-6 bg-white/20 flex-shrink-0 hidden sm:block" />
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              variant="default"
              className="flex-shrink-0 min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Download</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
