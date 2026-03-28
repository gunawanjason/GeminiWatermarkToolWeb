import * as React from "react";
import {
  Download,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  ImageIcon,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageItem, ProcessingStatus } from "@/lib/types";
import { Button } from "./ui/Button";

interface ImageGridProps {
  images: ImageItem[];
  onRemove: (id: string) => void;
  onDownload: (item: ImageItem) => void;
  onPreview: (item: ImageItem) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function ImageGrid({
  images,
  onRemove,
  onDownload,
  onPreview,
  selectedIds,
  onToggleSelect,
}: ImageGridProps) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl" />
          <div className="relative w-20 h-20 rounded-2xl bg-accent/40 flex items-center justify-center border border-border/30">
            <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
          </div>
        </div>
        <h3 className="text-lg font-heading font-medium text-foreground mb-2">
          No images yet
        </h3>
        <p className="text-muted-foreground text-sm">
          Drag and drop images or click to upload
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {images.map((item) => (
        <ImageCard
          key={item.id}
          item={item}
          isSelected={selectedIds.has(item.id)}
          onToggleSelect={() => onToggleSelect(item.id)}
          onRemove={() => onRemove(item.id)}
          onDownload={() => onDownload(item)}
          onPreview={() => onPreview(item)}
        />
      ))}
    </div>
  );
}

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
        "group relative rounded-2xl overflow-hidden border-2 transition-all duration-300",
        "bg-card shadow-sm hover:shadow-lg card-lift",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-transparent hover:border-border",
      )}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        className={cn(
          "absolute top-2.5 left-2.5 z-10 rounded-lg border-2 flex items-center justify-center",
          "transition-all duration-200 min-w-[44px] min-h-[44px]",
          isSelected
            ? "bg-primary border-primary text-primary-foreground"
            : "bg-white/95 border-border hover:border-primary",
        )}
        aria-label={isSelected ? "Deselect image" : "Select image"}
      >
        {isSelected && <Check className="w-3.5 h-3.5" />}
      </button>

      <StatusBadge status={item.status} />

      <div
        className="aspect-square cursor-pointer relative"
        onClick={onPreview}
      >
        <img
          src={displayImage}
          alt={item.file.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="w-10 h-10 rounded-xl bg-white/90 flex items-center justify-center shadow-sm">
            <Eye className="w-5 h-5 text-foreground" />
          </div>
        </div>
      </div>

      <div className="p-2.5 border-t border-border/40">
        <p className="text-xs font-medium text-foreground truncate">
          {item.file.name}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {item.width} × {item.height}
        </p>
      </div>

      <div className="px-2.5 pb-2.5 flex gap-1.5">
        {item.status === "completed" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 min-h-[44px] text-xs"
              onMouseDown={() => setShowProcessed(false)}
              onMouseUp={() => setShowProcessed(true)}
              onMouseLeave={() => setShowProcessed(true)}
              onTouchStart={() => setShowProcessed(false)}
              onTouchEnd={() => setShowProcessed(true)}
            >
              {showProcessed ? "Compare" : "Original"}
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
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProcessingStatus }) {
  const config: Record<
    ProcessingStatus,
    { icon: React.ReactNode; bg: string; text: string; label: string }
  > = {
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
        "absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded-full flex items-center gap-1",
        "text-[10px] font-medium shadow-sm backdrop-blur-sm",
        bg,
        text,
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}
