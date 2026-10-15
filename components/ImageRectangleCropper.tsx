'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, Crop } from 'lucide-react';

interface ImageRectangleCropperProps {
  imageSrc: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

export default function ImageRectangleCropper({
  imageSrc,
  onCrop,
  onCancel,
}: ImageRectangleCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const [imgLoaded, setImgLoaded] = useState(false);

  // Initialize a default center crop when image loads
  const handleImageLoad = () => {
    setImgLoaded(true);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const w = Math.round(rect.width * 0.7);
    const h = Math.round(rect.height * 0.7);
    const x = Math.round((rect.width - w) / 2);
    const y = Math.round((rect.height - h) / 2);
    setCropRect({ x, y, w, h });
  };

  const getContainerCoords = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    return { x, y };
  }, []);

  const handlePointerDown = (clientX: number, clientY: number) => {
    const coords = getContainerCoords(clientX, clientY);
    setIsDragging(true);
    setStartPoint(coords);
    setCropRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
  };

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging || !startPoint) return;
      const coords = getContainerCoords(clientX, clientY);
      const x = Math.min(startPoint.x, coords.x);
      const y = Math.min(startPoint.y, coords.y);
      const w = Math.abs(coords.x - startPoint.x);
      const h = Math.abs(coords.y - startPoint.y);
      setCropRect({ x, y, w, h });
    },
    [isDragging, startPoint, getContainerCoords]
  );

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent) => {
    handlePointerDown(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handlePointerMove(e.clientX, e.clientY);
  };

  const applyCrop = () => {
    if (!imgRef.current || !containerRef.current || !cropRect || cropRect.w < 10 || cropRect.h < 10) {
      onCancel();
      return;
    }

    const img = imgRef.current;
    const container = containerRef.current.getBoundingClientRect();

    const scaleX = img.naturalWidth / container.width;
    const scaleY = img.naturalHeight / container.height;

    const sourceX = Math.round(cropRect.x * scaleX);
    const sourceY = Math.round(cropRect.y * scaleY);
    const sourceW = Math.round(cropRect.w * scaleX);
    const sourceH = Math.round(cropRect.h * scaleY);

    const canvas = document.createElement('canvas');
    canvas.width = sourceW;
    canvas.height = sourceH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
    const croppedDataUrl = canvas.toDataURL('image/png');
    onCrop(croppedDataUrl);
  };

  return (
    <div className="space-y-3 select-none">
      <div className="flex items-center justify-between text-xs text-ink/80">
        <span className="font-medium flex items-center gap-1.5">
          <Crop className="w-3.5 h-3.5" />
          Drag a rectangle over the piece
        </span>
        <span className="text-[11px] text-muted">Touch &amp; mouse friendly</span>
      </div>

      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={handlePointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={handlePointerUp}
        className="relative overflow-hidden rounded-xl bg-surface border border-border cursor-crosshair touch-none select-none"
        style={{ maxHeight: '320px' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt="To crop"
          crossOrigin="anonymous"
          onLoad={handleImageLoad}
          className="w-full h-auto block max-h-[320px] object-contain mx-auto pointer-events-none select-none"
        />

        {/* Shading outside crop rectangle */}
        {imgLoaded && cropRect && cropRect.w > 5 && cropRect.h > 5 && (
          <div
            className="absolute border-2 border-dashed border-white shadow-soft pointer-events-none"
            style={{
              left: `${cropRect.x}px`,
              top: `${cropRect.y}px`,
              width: `${cropRect.w}px`,
              height: `${cropRect.h}px`,
              boxShadow: '0 0 0 9999px rgba(28, 26, 23, 0.55)',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
            }}
          >
            <div className="absolute -bottom-6 right-0 bg-ink text-paper text-[10px] font-mono px-1.5 py-0.5 rounded shadow">
              {Math.round(cropRect.w)} × {Math.round(cropRect.h)}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-muted hover:text-ink transition-colors flex items-center gap-1 rounded-lg"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>

        <button
          type="button"
          onClick={applyCrop}
          className="px-4 py-1.5 bg-ink text-paper text-xs font-medium rounded-lg hover:bg-ink-light transition-colors flex items-center gap-1.5 shadow-soft"
        >
          <Check className="w-3.5 h-3.5" />
          Apply crop
        </button>
      </div>
    </div>
  );
}
