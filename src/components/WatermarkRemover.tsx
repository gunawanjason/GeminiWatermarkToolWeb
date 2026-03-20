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

  // Animation states
  const [showResultCard, setShowResultCard] = useState(false);
  const [animateSuccess, setAnimateSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    trackSingleModeUse();
  }, []);

  // Handle processing completion with smooth animation
  useEffect(() => {
    if (stage === "complete") {
      setAnimateSuccess(true);
      setTimeout(() => {
        setShowResultCard(true);
      }, 300);
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

        // Small delay for smooth animation
        await new Promise(r => setTimeout(r, 300));
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
          { width: size.width, height: size.height }
        );

        addToast("error", "Error processing image. Please try again.");
        setStage("idle");
      }
    },
    [addToast, detectedSize],
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
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          <span>Simple & Private</span>
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
          Remove Gemini Watermarks
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Upload your image and we'll gently remove the watermark.
          Everything happens right here in your browser — your images never leave your device.
        </p>
      </div>

      {/* Upload Zone - with smooth height transition */}
      <Card className={stage !== "idle" ? "overflow-hidden transition-all duration-500 ease-out" : "shadow-sm"}>
        <CardContent className={stage !== "idle" ? "p-4 transition-all duration-500 ease-out" : "p-8 transition-all duration-500 ease-out"}>
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
                relative border-2 border-dashed rounded-2xl p-12 sm:p-16 text-center cursor-pointer
                transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2
                ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
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
                <div className="mx-auto w-20 h-20 rounded-2xl sage-gradient flex items-center justify-center shadow-sm transition-transform duration-300 hover:scale-105">
                  <Upload className="w-10 h-10 text-white" />
                </div>
                <div>
                  <p className="text-xl font-medium text-foreground">
                    Drop your image here
                  </p>
                  <p className="text-muted-foreground mt-2">
                    or click to browse files
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-3">
                    PNG, JPG, WebP supported • Max 10MB
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
            <div className="flex items-center justify-between gap-4 animate-in fade-in">
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
                      {imageSize.width} × {imageSize.height}px • PNG
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

      {/* Processing State - with smooth entrance/exit */}
      {(stage === "uploading" || stage === "processing") && (
        <Card className="shadow-sm animate-in slide-in-up">
          <CardContent className="p-10">
            <div className="flex flex-col items-center justify-center space-y-8">
              <div className="relative">
                <div className={`w-24 h-24 rounded-2xl sage-gradient flex items-center justify-center transition-all duration-500 ${progress >= 100 ? 'scale-110' : 'scale-100'}`}>
                  <RefreshCw className={`w-12 h-12 text-white transition-all duration-500 ${stage === "processing" ? 'animate-spin' : ''} ${progress >= 100 ? 'opacity-0' : 'opacity-100'}`} />
                </div>
                {progress >= 100 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="w-12 h-12 text-white checkmark-draw" />
                  </div>
                )}
                <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center text-sm font-semibold shadow-md transition-all duration-300 ${progress >= 100 ? 'scale-110 bg-success' : ''}`}>
                  <span className={progress >= 100 ? 'count-up' : ''}>{Math.round(progress)}%</span>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-medium text-foreground">
                  {stage === "uploading"
                    ? "Loading your image..."
                    : progress >= 100
                    ? "Complete!"
                    : "Gently removing watermark..."}
                </p>
                <p className="text-sm text-muted-foreground">
                  {stage === "processing" && progress < 100 &&
                    "Applying reverse alpha blending"}
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

      {/* Result - with staggered entrance animations */}
      {stage === "complete" && showResultCard && originalImage && processedImage && (
        <Card className="shadow-sm animate-in slide-in-up">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 stagger-1">
                <div className={`w-12 h-12 rounded-xl bg-success flex items-center justify-center text-white shadow-sm transition-all duration-500 ${animateSuccess ? 'pulse-success' : ''}`}>
                  <Check className="w-6 h-6" />
                </div>
                <div className="stagger-2">
                  <CardTitle className="text-xl">All done!</CardTitle>
                  <CardDescription className="mt-1">
                    {detectedSize === "large" ? "96×96" : "48×48"} watermark
                    removed
                  </CardDescription>
                </div>
              </div>
              <div className="stagger-3">
                <Button onClick={handleDownload} size="lg">
                  <Download className="w-5 h-5" />
                  Download PNG
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 items-center">
              {/* Original */}
              <div className="space-y-3 stagger-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Original
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-error/15 text-error text-xs font-medium">
                    Has Watermark
                  </span>
                </div>
                <div
                  className="relative rounded-2xl overflow-hidden bg-accent/50 cursor-pointer group focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2 transition-all duration-200 image-reveal"
                  onClick={() => {
                    setShowOriginal(true);
                    setShowZoom(true);
                    trackZoomView(fileName);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Zoom original image"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowZoom(true);
                      setShowOriginal(true);
                      trackZoomView(fileName);
                    }
                  }}
                >
                  <img
                    src={originalImage}
                    alt="Original"
                    className="w-full h-auto max-h-[350px] object-contain"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-250 ease-out flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                    <div className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center shadow-sm">
                      <ZoomIn className="w-6 h-6 text-foreground" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Arrow - centered between images */}
              <div className="hidden md:flex flex-col items-center justify-center self-stretch stagger-4">
                <div className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm shrink-0">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>

              {/* Processed */}
              <div className="space-y-3 stagger-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Processed
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-success/15 text-success text-xs font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Clean
                  </span>
                </div>
                <div
                  className="relative rounded-2xl overflow-hidden bg-accent/50 cursor-pointer group focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2 transition-all duration-200 image-reveal"
                  onClick={() => {
                    setShowOriginal(false);
                    setShowZoom(true);
                    trackZoomView(fileName);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Zoom processed image"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowZoom(true);
                      setShowOriginal(false);
                      trackZoomView(fileName);
                    }
                  }}
                >
                  <img
                    src={processedImage}
                    alt="Processed"
                    className="w-full h-auto max-h-[350px] object-contain"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-250 ease-out flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                    <div className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center shadow-sm">
                      <ZoomIn className="w-6 h-6 text-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center py-3 px-4 rounded-xl bg-accent/40">
              <p className="text-sm text-muted-foreground">
                Click images to zoom • Press{" "}
                <kbd className="px-2 py-0.5 bg-background rounded-md text-xs font-medium shadow-sm">
                  ⌘S
                </kbd>{" "}
                to save
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Zoom Modal */}
      {showZoom && (originalImage || processedImage) && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowZoom(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image comparison zoom"
        >
          <div
            className="relative max-w-6xl max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={showOriginal ? originalImage! : processedImage!}
              alt={showOriginal ? "Original" : "Processed"}
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-xl"
            />

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/75 backdrop-blur-xl rounded-2xl px-6 py-4 shadow-lg">
              <button
                onClick={() => {
                  setShowOriginal(true);
                  trackCompareToggle(true);
                }}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
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
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  !showOriginal
                    ? "bg-white text-foreground shadow-sm"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Processed
              </button>
              <div className="w-px h-8 bg-white/20" />
              <Button size="sm" onClick={handleDownload} variant="default">
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            </div>

            <button
              onClick={() => setShowZoom(false)}
              className="absolute top-6 right-6 w-14 h-14 rounded-2xl bg-black/75 text-white flex items-center justify-center hover:bg-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label="Close zoom view"
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
