import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Download,
  RefreshCw,
  ImageIcon,
  Sparkles,
  ZoomIn,
  X,
  ArrowRight,
  Check,
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { addToast } = useToast();

  // Track single mode usage on mount
  useEffect(() => {
    trackSingleModeUse();
  }, []);

  // Auto-process when image is loaded
  const processLoadedImage = useCallback(
    async (
      dataUrl: string,
      name: string,
      size: { width: number; height: number },
    ) => {
      if (!canvasRef.current || !currentFile) return;

      setStage("processing");
      setProgress(0);
      const startTime = Date.now();
      setProcessingStartTime(startTime);

      // Track processing start
      trackProcessingStart(currentFile, {
        width: size.width,
        height: size.height,
        watermarkSize: detectedSize || undefined,
      });

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 15, 85));
      }, 100);

      try {
        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        await processImage(canvasRef.current, img);
        setProgress(100);

        const processedDataUrl = canvasRef.current.toDataURL("image/png");
        setProcessedImage(processedDataUrl);
        setStage("complete");

        // Track processing completion
        trackProcessingComplete(currentFile, {
          width: size.width,
          height: size.height,
          durationMs: Date.now() - startTime,
          watermarkSize: detectedSize || undefined,
        });

        // Save to history
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

        // Track processing error
        trackProcessingError(
          currentFile,
          error instanceof Error ? error : new Error(String(error)),
          { width: size.width, height: size.height }
        );

        addToast("error", "Error processing image. Please try again.");
        setStage("idle");
      } finally {
        clearInterval(progressInterval);
      }
    },
    [addToast, currentFile, detectedSize],
  );

  const handleFile = useCallback(
    (file: File, method: 'click' | 'drag_drop' = 'click') => {
      if (!file.type.startsWith("image/")) {
        trackError('invalid_file_type', `User tried to upload ${file.type}`, 'WatermarkRemover');
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

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          const size = { width: img.naturalWidth, height: img.naturalHeight };
          setImageSize(size);
          setDetectedSize(
            getWatermarkSize(img.naturalWidth, img.naturalHeight),
          );

          // Track file upload
          trackFileUpload(file, method, {
            width: size.width,
            height: size.height,
          });

          // Auto-process after loading
          processLoadedImage(dataUrl, file.name, size);
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
      if (file) handleFile(file, 'drag_drop');
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

      // Track download
      trackDownload(newFileName, 'image/png', 'single');

      addToast("success", `Downloaded ${newFileName}`);
    } catch (error) {
      console.error("Error downloading:", error);
      trackError('download_failed', String(error), 'WatermarkRemover');
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

  // Keyboard shortcuts
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
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Remove Watermark</h1>
        <p className="text-muted-foreground">
          Upload an image to automatically remove the Gemini watermark
        </p>
      </div>

      {/* Upload Zone - Always visible but compact when image loaded */}
      <Card className={stage !== "idle" ? "overflow-hidden" : ""}>
        <CardContent className={stage !== "idle" ? "p-4" : "p-6"}>
          {stage === "idle" ? (
            // Empty state - large drop zone
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-xl p-16 text-center cursor-pointer
                transition-all duration-300 ease-out
                ${
                  isDragging
                    ? "border-primary bg-primary/10 scale-[1.02]"
                    : "border-accent hover:border-primary/50 hover:bg-card/50"
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

              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-medium text-foreground">
                    Drop your image here
                  </p>
                  <p className="text-muted-foreground mt-2">
                    or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    PNG, JPG, WebP supported • Auto-processes on upload
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium">
                  <Sparkles className="w-4 h-4" />
                  <span>Instant watermark removal</span>
                </div>
              </div>
            </div>
          ) : (
            // Compact upload button when image is loaded
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground truncate max-w-[200px]">
                    {fileName}
                  </p>
                  {imageSize && (
                    <p className="text-xs text-muted-foreground">
                      {imageSize.width} × {imageSize.height}px
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  New Image
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

      {/* Processing State */}
      {(stage === "uploading" || stage === "processing") && (
        <Card>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                  {Math.round(progress)}%
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">
                  {stage === "uploading"
                    ? "Loading image..."
                    : "Removing watermark..."}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stage === "processing" &&
                    "Applying reverse alpha blending algorithm"}
                </p>
              </div>
              <ProgressBar
                value={progress}
                max={100}
                size="lg"
                className="w-64"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result - Side by Side Comparison */}
      {stage === "complete" && originalImage && processedImage && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Watermark Removed!</CardTitle>
                  <CardDescription>
                    {detectedSize === "large" ? "96×96" : "48×48"} watermark
                    detected and removed
                  </CardDescription>
                </div>
              </div>
              <Button onClick={handleDownload} size="lg">
                <Download className="w-5 h-5" />
                Download PNG
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Side by Side Preview */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Original */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Original
                  </span>
                </div>
                <div
                  className="relative rounded-lg overflow-hidden bg-black/5 cursor-pointer group"
                  onClick={() => {
                setShowOriginal(true);
                setShowZoom(true);
                trackZoomView(fileName);
              }}
                >
                  <img
                    src={originalImage}
                    alt="Original"
                    className="w-full h-auto max-h-[350px] object-contain"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ZoomIn className="w-8 h-8 text-white" />
                  </div>
                  {/* Watermark indicator */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-red-500/80 text-white text-xs rounded font-medium">
                    Has Watermark
                  </div>
                </div>
              </div>

              {/* Arrow between */}
              <div className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>

              {/* Processed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Processed
                  </span>
                </div>
                <div
                  className="relative rounded-lg overflow-hidden bg-black/5 cursor-pointer group"
                  onClick={() => {
                  setShowOriginal(false);
                  setShowZoom(true);
                  trackZoomView(fileName);
                }}
                >
                  <img
                    src={processedImage}
                    alt="Processed"
                    className="w-full h-auto max-h-[350px] object-contain"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ZoomIn className="w-8 h-8 text-white" />
                  </div>
                  {/* Clean indicator */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-green-500/80 text-white text-xs rounded font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Clean
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Compare Hint */}
            <div className="text-center text-sm text-muted-foreground">
              Click images to zoom • Press{" "}
              <kbd className="px-2 py-0.5 bg-accent/30 rounded text-xs">⌘S</kbd>{" "}
              to save
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden Canvas for Processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Zoom Modal */}
      {showZoom && (originalImage || processedImage) && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowZoom(false)}
        >
          <div
            className="relative max-w-6xl max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={showOriginal ? originalImage! : processedImage!}
              alt={showOriginal ? "Original" : "Processed"}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />

            {/* Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-full px-6 py-3">
              <button
                onClick={() => {
                  setShowOriginal(true);
                  trackCompareToggle(true);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  showOriginal
                    ? "bg-white text-black"
                    : "text-white hover:bg-white/20"
                }`}
              >
                Original
              </button>
              <button
                onClick={() => {
                  setShowOriginal(false);
                  trackCompareToggle(false);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  !showOriginal
                    ? "bg-white text-black"
                    : "text-white hover:bg-white/20"
                }`}
              >
                Processed
              </button>
              <div className="w-px h-6 bg-white/30" />
              <Button size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowZoom(false)}
              className="absolute top-4 right-4 w-12 h-12 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
            >
              <X className="w-6 h-6" />
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
