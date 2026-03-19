import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImageCropModalProps {
  /** Raw data-URL of the selected image */
  imageSrc: string;
  onConfirm: (croppedDataUrl: string, croppedBlob: Blob) => void;
  onCancel: () => void;
}

/**
 * Draws the cropped region of `imageSrc` onto a canvas and returns both
 * a data-URL and a Blob.
 */
async function getCroppedImage(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0
): Promise<{ dataUrl: string; blob: Blob }> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);
  ctx.drawImage(
    image,
    safeArea / 2 - image.width / 2,
    safeArea / 2 - image.height / 2
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  // First pass: extract the cropped region at original resolution
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = pixelCrop.width;
  cropCanvas.height = pixelCrop.height;
  const cropCtx = cropCanvas.getContext("2d")!;
  cropCtx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width / 2 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height / 2 - pixelCrop.y)
  );

  // Second pass: resize to max 400×400 to keep the base64 small enough for DB storage
  const MAX_DIM = 400;
  const scale = Math.min(1, MAX_DIM / pixelCrop.width, MAX_DIM / pixelCrop.height);
  canvas.width = Math.round(pixelCrop.width * scale);
  canvas.height = Math.round(pixelCrop.height * scale);
  ctx.drawImage(cropCanvas, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.8), blob });
    }, "image/jpeg", 0.8);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = src;
  });
}

export function ImageCropModal({ imageSrc, onConfirm, onCancel }: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const { dataUrl, blob } = await getCroppedImage(imageSrc, croppedAreaPixels, rotation);
      onConfirm(dataUrl, blob);
    } catch (err) {
      console.error("Crop failed:", err);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-lg w-full p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-2">
          <DialogTitle>Adjust Profile Photo</DialogTitle>
        </DialogHeader>

        {/* Crop area */}
        <div className="relative w-full bg-black" style={{ height: 340 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Controls */}
        <div className="px-6 py-4 space-y-4">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Slider
              min={1}
              max={3}
              step={0.01}
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
              aria-label="Zoom"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-3">
            <RotateCcw className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Slider
              min={-180}
              max={180}
              step={1}
              value={[rotation]}
              onValueChange={([v]) => setRotation(v)}
              className="flex-1"
              aria-label="Rotation"
            />
            <span className="text-xs text-muted-foreground w-9 text-right tabular-nums">
              {rotation}°
            </span>
          </div>
        </div>

        <DialogFooter className="px-6 pb-5 flex flex-row justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
            Reset
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={processing}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleConfirm} disabled={processing}>
              {processing ? "Processing…" : "Apply"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
