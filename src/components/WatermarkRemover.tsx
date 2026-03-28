import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Download,
  RefreshCw,
  ImageIcon,
  Sparkles,
  ZoomIn,
  X,
  Check,
  ShieldCheck,
  ArrowDownToLine,
} from "lucide-react";
import { Button } from "./ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/Card";
import { useToast, ToastProvider } from "./ui/Toast";
import { ProgressBar } from "./ui/ProgressBar";
import {
  processImage,
  downloadBlob,
  getWatermarkSize,
  type WatermarkSize,
} from "@/lib/watermark";
import { saveToHistory, generateId } from "@/lib/storage";
import {
  trackFileUpload,
  trackProcessingStart,
  trackProcessingComplete,
  trackProcessingError,
  trackDownload,
  trackCompareToggle,
  trackZoomView,
  trackSingleModeUse,
  trackError,
} from "@/lib/analytics";

type ProcessingStage = "idle" | "uploading" | "processing" | "complete";

function SideBySideComparison({
  originalSrc,
  processedSrc,
  onZoom,
}: {
  originalSrc: string;
  processedSrc: string;
  onZoom: (showOriginal: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-5 image-reveal">
        <div className="space-y-2">
          <div
            className="relative rounded-2xl overflow-hidden bg-accent/50 cursor-pointer group ring-1 ring-black/5"
            onClick={() => onZoom(true)}
          >
            <img
              src={originalSrc}
              alt="Original watermarked image"
              className="w-full h-auto max-h-[300px] sm:max-h-[400px] object-contain pointer-events-none"
              draggable={false}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors duration-250 flex items-center justify-center">
              <div className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all duration-250 scale-90 group-hover:scale-100">
                <ZoomIn className="w-5 h-5 text-foreground" />
              </div>
            </div>
          </div>
          <span className="block text-center text-xs font-medium px-3 py-1 rounded-lg bg-error/10 text-error w-fit mx-auto border border-error/15">
            Original
          </span>
        </div>

        <div className="space-y-2">
          <div
            className="relative rounded-2xl overflow-hidden bg-accent/50 cursor-pointer group ring-1 ring-black/5"
            onClick={() => onZoom(false)}
          >
            <img
              src={processedSrc}
              alt="Clean image with watermark removed"
              className="w-full h-auto max-h-[300px] sm:max-h-[400px] object-contain pointer-events-none"
              draggable={false}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors duration-250 flex items-center justify-center">
              <div className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all duration-250 scale-90 group-hover:scale-100">
                <ZoomIn className="w-5 h-5 text-foreground" />
              </div>
            </div>
          </div>
          <span className="block text-center text-xs font-medium px-3 py-1 rounded-lg bg-success/10 text-success w-fit mx-auto border border-success/15">
            Clean
          </span>
        </div>
      </div>
    </div>
  );
}

function WatermarkRemoverContent() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [detectedSize, setDetectedSize] = useState<WatermarkSize | null>(null);
  const [showZoom, setShowZoom] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number>(0);
  const [showResultCard, setShowResultCard] = useState(false);
  const [animateSuccess, setAnimateSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    setMounted(true);
    trackSingleModeUse();
  }, []);

  useEffect(() => {
    if (stage === "complete") {
      setAnimateSuccess(true);
      setTimeout(() => {
        setShowResultCard(true);
      }, 350);
    } else {
      setShowResultCard(false);
      setAnimateSuccess(false);
    }
  }, [stage]);

  const processLoadedImage = useCallback(
    async (
      dataUrl: string,
      name: string,
      size: { width: number; height: number },
      file: File,
    ) => {
      if (!canvasRef.current) return;

      setStage("processing");
      setProgress(0);
      const startTime = Date.now();
      setProcessingStartTime(startTime);

      trackProcessingStart(file, {
        width: size.width,
        height: size.height,
        watermarkSize: detectedSize || undefined,
      });

      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 12, 90));
      }, 100);

      try {
        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        await processImage(canvasRef.current, img);
        clearInterval(progressInterval);
        setProgress(100);

        const processedDataUrl = canvasRef.current.toDataURL("image/png");
        setProcessedImage(processedDataUrl);

        await new Promise((r) => setTimeout(r, 400));
        setStage("complete");

        trackProcessingComplete(file, {
          width: size.width,
          height: size.height,
          durationMs: Date.now() - startTime,
          watermarkSize: detectedSize || undefined,
        });

        await saveToHistory({
          id: generateId(),
          fileName: name,
          originalDataUrl: dataUrl,
          processedDataUrl,
          width: size.width,
          height: size.height,
          processedAt: Date.now(),
        });

        addToast("success", "Watermark removed successfully!");
      } catch (error) {
        console.error("Error processing image:", error);
        clearInterval(progressInterval);

        trackProcessingError(
          file,
          error instanceof Error ? error : new Error(String(error)),
          { width: size.width, height: size.height },
        );

        addToast("error", "Error processing image. Please try again.");
        setStage("idle");
      }
    },
    [addToast, detectedSize],
  );

  const handleFile = useCallback(
    (file: File, method: "click" | "drag_drop" = "click") => {
      if (!file.type.startsWith("image/")) {
        trackError(
          "invalid_file_type",
          `User tried to upload ${file.type}`,
          "WatermarkRemover",
        );
        addToast("error", "Please upload an image file");
        return;
      }

      setCurrentFile(file);
      setStage("uploading");
      setProgress(0);
      setFileName(file.name);
      setProcessedImage(null);

      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress((e.loaded / e.total) * 100);
        }
      };
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setOriginalImage(dataUrl);

        const img = new Image();
        img.onload = () => {
          const size = { width: img.naturalWidth, height: img.naturalHeight };
          setImageSize(size);
          setDetectedSize(
            getWatermarkSize(img.naturalWidth, img.naturalHeight),
          );

          trackFileUpload(file, method, {
            width: size.width,
            height: size.height,
          });

          processLoadedImage(dataUrl, file.name, size, file);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [addToast, processLoadedImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file, "drag_drop");
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!processedImage) return;

    try {
      const response = await fetch(processedImage);
      const blob = await response.blob();
      const pngBlob = new Blob([blob], { type: "image/png" });
      const newFileName = fileName.replace(/\.[^.]+$/, "") + "_clean.png";
      downloadBlob(pngBlob, newFileName);

      trackDownload(newFileName, "image/png", "single");

      addToast("success", `Downloaded ${newFileName}`);
    } catch (error) {
      console.error("Error downloading:", error);
      trackError("download_failed", String(error), "WatermarkRemover");
      addToast("error", "Failed to download image");
    }
  }, [processedImage, fileName, addToast]);

  const handleReset = useCallback(() => {
    setOriginalImage(null);
    setProcessedImage(null);
    setFileName("");
    setImageSize(null);
    setDetectedSize(null);
    setStage("idle");
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showZoom) {
        setShowZoom(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && processedImage) {
        e.preventDefault();
        handleDownload();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showZoom, processedImage, handleDownload]);

  return (
    <div className="space-y-8">
      <div
        className={`text-center space-y-4 max-w-2xl mx-auto ${mounted ? "hero-enter" : "[&>*]:opacity-0"}`}
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/15">
          <Sparkles className="w-4 h-4" />
          <span>Simple & Private</span>
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          Remove Gemini Watermarks
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg mx-auto">
          Upload your image and we'll gently remove the watermark. Everything
          happens right here in your browser — your images never leave your
          device.
        </p>
        <div className="flex items-center justify-center gap-3 sm:gap-4 pt-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 px-2.5 py-1 rounded-md border border-border/50">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span>100% Local</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 px-2.5 py-1 rounded-md border border-border/50">
            <ImageIcon className="w-3.5 h-3.5 text-primary" />
            <span>PNG, JPG, WebP</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 px-2.5 py-1 rounded-md border border-border/50">
            <ArrowDownToLine className="w-3.5 h-3.5 text-primary" />
            <span>Instant</span>
          </div>
        </div>
      </div>

      <Card
        className={
          stage !== "idle"
            ? "overflow-hidden transition-all duration-500 ease-out animate-in slide-in-from-bottom"
            : "shadow-sm animate-bounce-in upload-zone-glow"
        }
        style={stage === "idle" ? { animationDelay: "200ms" } : undefined}
      >
        <CardContent
          className={
            stage !== "idle"
              ? "p-4 transition-all duration-500 ease-out"
              : "p-8 transition-all duration-500 ease-out"
          }
        >
          {stage === "idle" ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              tabIndex={0}
              role="button"
              aria-label="Upload image"
              className={`
                relative border-2 border-dashed rounded-2xl p-8 sm:p-12 lg:p-16 text-center cursor-pointer
                transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2
                ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.01] shadow-lg shadow-primary/10"
                    : "border-border hover:border-primary/40 hover:bg-accent/50"
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
                className="hidden"
              />

              <div className="space-y-6">
                <div
                  className={`mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sage-gradient flex items-center justify-center shadow-md shadow-primary/20 transition-all duration-300 ${isDragging ? "scale-110 wiggle" : "upload-icon-idle"}`}
                >
                  <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <div>
                  <p className="text-lg sm:text-xl font-medium text-foreground">
                    {isDragging
                      ? "Drop your image here!"
                      : "Drop your image here"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    or click to browse files
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-3">
                    PNG, JPG, WebP supported · Max 10MB
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <div className="h-px w-12 bg-border" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Drag & Drop
                  </span>
                  <div className="h-px w-12 bg-border" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 animate-in slide-in-from-left">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-6 h-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-medium text-foreground truncate"
                    title={fileName}
                  >
                    {fileName}
                  </p>
                  {imageSize && (
                    <p className="text-sm text-muted-foreground">
                      {imageSize.width} × {imageSize.height}px · PNG
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  New
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <X className="w-4 h-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files?.[0] && handleFile(e.target.files[0])
                  }
                  className="hidden"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(stage === "uploading" || stage === "processing") && (
        <Card className="shadow-sm animate-in slide-in-from-bottom">
          <CardContent className="p-5 sm:p-10">
            <div className="flex flex-col items-center justify-center space-y-8">
              <div className="relative processing-orb">
                <div className="processing-orb-ring" />
                <div className="processing-orb-ring-outer" />
                <div
                  className={`relative w-24 h-24 rounded-2xl sage-gradient flex items-center justify-center transition-all duration-500 shadow-lg shadow-primary/20 ${progress >= 100 ? "scale-110" : "scale-100"}`}
                >
                  <RefreshCw
                    className={`w-12 h-12 text-white transition-all duration-500 ${stage === "processing" ? "animate-spin" : ""} ${progress >= 100 ? "opacity-0 scale-0" : "opacity-100"}`}
                  />
                </div>
                {progress >= 100 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-success flex items-center justify-center animate-spring shadow-lg shadow-success/30">
                      <Check className="w-10 h-10 text-white" />
                    </div>
                  </div>
                )}
                <div
                  className={`absolute -bottom-2 -right-2 w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shadow-md transition-all duration-300 ${progress >= 100 ? "scale-110 bg-success text-white success-burst" : "bg-primary text-white"}`}
                >
                  <span className={progress >= 100 ? "count-up" : ""}>
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-medium text-foreground">
                  {stage === "uploading"
                    ? "Loading your image..."
                    : progress >= 100
                      ? "Almost there..."
                      : "Gently removing watermark..."}
                </p>
                <p className="text-sm text-muted-foreground">
                  {stage === "processing" &&
                    progress < 100 &&
                    "Applying reverse alpha blending"}
                  {progress >= 100 && "Preparing your result"}
                </p>
              </div>
              <ProgressBar
                value={progress}
                max={100}
                size="lg"
                className="w-full max-w-xs"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {stage === "complete" &&
        showResultCard &&
        originalImage &&
        processedImage && (
          <Card className="shadow-sm animate-bounce-in overflow-hidden card-success-shimmer">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl bg-success flex items-center justify-center text-white shadow-sm shadow-success/20 transition-all duration-500 ${animateSuccess ? "success-burst" : ""}`}
                  >
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">All done!</CardTitle>
                    <CardDescription className="mt-1">
                      {detectedSize === "large" ? "96×96" : "48×48"} watermark
                      removed
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="btn-shine min-h-[44px]"
                    onClick={() => {
                      setShowOriginal(true);
                      setShowZoom(true);
                      trackZoomView(fileName);
                    }}
                  >
                    <ZoomIn className="w-4 h-4" />
                    <span className="hidden sm:inline">Full View</span>
                    <span className="sm:hidden">Zoom</span>
                  </Button>
                  <Button
                    onClick={handleDownload}
                    size="default"
                    className="btn-shine min-h-[44px] shadow-md shadow-primary/20"
                  >
                    <Download className="w-5 h-5" />
                    Download PNG
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <SideBySideComparison
                  originalSrc={originalImage}
                  processedSrc={processedImage}
                  onZoom={(showOrig) => {
                    setShowOriginal(showOrig);
                    setShowZoom(true);
                    trackZoomView(fileName);
                  }}
                />
              </div>

              <div className="flex items-center justify-center gap-6 py-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-3 h-3 rounded-sm bg-error/30 border border-error/50" />
                  Original
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-3 h-3 rounded-sm bg-success/30 border border-success/50" />
                  Clean
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-px h-4 bg-border" />
                  <p className="text-xs text-muted-foreground">
                    Press{" "}
                    <kbd className="px-1.5 py-0.5 bg-muted rounded-md text-xs font-medium border border-border/60">
                      ⌘S
                    </kbd>{" "}
                    to save
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="text-muted-foreground"
                >
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Process another image
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      <canvas ref={canvasRef} className="hidden" />

      {showZoom && (originalImage || processedImage) && (
        <div
          className="fixed inset-0 z-50 bg-black/90 modal-backdrop flex items-center justify-center p-2 sm:p-4"
          onClick={() => setShowZoom(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image comparison zoom"
        >
          <div
            className="relative max-w-6xl max-h-full w-full animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={showOriginal ? originalImage! : processedImage!}
              alt={showOriginal ? "Original image" : "Processed clean image"}
              className="w-full max-h-[80vh] sm:max-h-[90vh] object-contain rounded-xl sm:rounded-2xl shadow-xl animate-flip-in"
            />

            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-xl rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 shadow-lg animate-in slide-in-from-bottom max-w-[70vw]" style={{ animationDelay: "100ms" }}>
              <ImageIcon className="w-3.5 h-3.5 text-white/70" />
              <p className="text-xs sm:text-sm text-white font-medium truncate">
                {fileName}
              </p>
            </div>

            <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-3 bg-black/75 backdrop-blur-xl rounded-xl sm:rounded-2xl px-2.5 py-2 sm:px-6 sm:py-4 shadow-lg animate-in slide-in-from-bottom max-w-[95vw]" style={{ animationDelay: "200ms" }}>
              <button
                onClick={() => {
                  setShowOriginal(true);
                  trackCompareToggle(true);
                }}
                className={`px-3 py-2.5 sm:px-5 sm:py-2.5 rounded-xl text-sm font-medium transition-all duration-250 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 whitespace-nowrap min-h-[44px] ${
                  showOriginal
                    ? "bg-white text-foreground shadow-sm"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Original
              </button>
              <button
                onClick={() => {
                  setShowOriginal(false);
                  trackCompareToggle(false);
                }}
                className={`px-3 py-2.5 sm:px-5 sm:py-2.5 rounded-xl text-sm font-medium transition-all duration-250 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 whitespace-nowrap min-h-[44px] ${
                  !showOriginal
                    ? "bg-white text-foreground shadow-sm"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Clean
              </button>
              <div className="w-px h-6 bg-white/20 hidden sm:block" />
              <Button
                size="sm"
                onClick={handleDownload}
                variant="default"
                className="btn-shine flex-shrink-0 min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Download</span>
              </Button>
            </div>

            <button
              onClick={() => setShowZoom(false)}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-all duration-200 hover:rotate-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 min-w-[44px] min-h-[44px]"
              aria-label="Close zoom view"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WatermarkRemover() {
  return (
    <ToastProvider>
      <WatermarkRemoverContent />
    </ToastProvider>
  );
}
