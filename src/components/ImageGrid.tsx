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
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
        {isSelected && <CheckCircle className="w-4 h-4" />}
      </button>

      {/* Status Badge */}
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
          <Eye className="w-8 h-8 text-white" />
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
              onClick={(e) => {
                e.stopPropagation();
                setShowProcessed(!showProcessed);
              }}
            >
              {showProcessed ? "Original" : "Processed"}
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

function StatusBadge({ status }: { status: ProcessingStatus }) {
  const config: Record<
    ProcessingStatus,
    { icon: React.ReactNode; bg: string; text: string }
  > = {
    pending: {
      icon: <Clock className="w-3 h-3" />,
      bg: "bg-amber-100",
      text: "text-amber-700",
    },
    processing: {
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      bg: "bg-blue-100",
      text: "text-blue-700",
    },
    completed: {
      icon: <CheckCircle className="w-3 h-3" />,
      bg: "bg-green-100",
      text: "text-green-700",
    },
    error: {
      icon: <AlertCircle className="w-3 h-3" />,
      bg: "bg-red-100",
      text: "text-red-700",
    },
  };

  const { icon, bg, text } = config[status];

  return (
    <div
      className={cn(
        "absolute top-2 right-2 z-10 px-2 py-1 rounded-full flex items-center gap-1",
        "text-xs font-medium capitalize",
        bg,
        text,
      )}
    >
      {icon}
      <span>{status}</span>
    </div>
  );
}
