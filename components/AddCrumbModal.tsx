'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Upload, Link2, Plus, Loader2, ImageIcon, Crop } from 'lucide-react';
import Image from 'next/image';
import type { Crumb } from '@/types/crumb';
import ImageRectangleCropper from './ImageRectangleCropper';

interface AddCrumbModalProps {
  onAdd: (crumb: Crumb) => void;
}

type InputMode = 'file' | 'url';

export default function AddCrumbModal({ onAdd }: AddCrumbModalProps) {
  const [open, setOpen] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [productUrl, setProductUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'thinking' | 'done'>('idle');
  const [selectedCategory, setSelectedCategory] = useState<string>('auto');
  const [isCropping, setIsCropping] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-open and populate if URL params exist (e.g. from mobile share sheet / PWA)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get('url') || params.get('text');
    const sharedTitle = params.get('title');

    if (sharedUrl && (sharedUrl.startsWith('http://') || sharedUrl.startsWith('https://'))) {
      setProductUrl(sharedUrl);
      if (sharedTitle) setTitle(sharedTitle);
      setOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleClose = () => {
    if (isSubmitting) return;
    setOpen(false);
    setTimeout(() => {
      setImageUrl('');
      setImageFile(null);
      setImagePreview('');
      setProductUrl('');
      setTitle('');
      setSelectedCategory('auto');
      setError('');
      setAiStatus('idle');
    }, 300);
  };

  const handleFileChange = useCallback((file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please choose a JPEG, PNG, WebP, GIF, or AVIF image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('That image is too large. Choose one under 10MB.');
      return;
    }

    setError('');
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) handleFileChange(file);
    },
    [handleFileChange]
  );

  const handleImageUrlChange = (url: string) => {
    setImageUrl(url);
    setImagePreview(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!productUrl.trim()) {
      setError('Please enter a product link.');
      return;
    }
    try {
      const parsedProductUrl = new URL(productUrl.trim());
      if (!['http:', 'https:'].includes(parsedProductUrl.protocol)) {
        throw new Error('Unsupported URL protocol');
      }
    } catch {
      setError('Please enter a valid http or https product link.');
      return;
    }

    const hasImage = inputMode === 'file' ? !!imageFile : !!imageUrl.trim();
    if (!hasImage) {
      setError('Please provide an image (upload or URL).');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Upload image if file mode or cropped data URI
      let finalImageUrl = imageUrl.trim();
      let imageBase64: string | undefined;

      if (imagePreview.startsWith('data:') || (inputMode === 'file' && imageFile)) {
        let fileToUpload = imageFile;

        if (imagePreview.startsWith('data:')) {
          const res = await fetch(imagePreview);
          const blob = await res.blob();
          fileToUpload = new File([blob], 'piece.png', { type: 'image/png' });
        }

        if (fileToUpload) {
          const formData = new FormData();
          formData.append('file', fileToUpload);
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
          if (!uploadRes.ok) {
            const err = await uploadRes.json();
            throw new Error(err.error ?? 'Upload failed');
          }
          const { path } = await uploadRes.json() as { path: string };
          finalImageUrl = path;
          imageBase64 = imagePreview;
        }
      }

      // 2. Determine category
      let finalCategory: string;
      if (selectedCategory && selectedCategory !== 'auto') {
        finalCategory = selectedCategory;
      } else {
        setAiStatus('thinking');
        const catRes = await fetch('/api/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: inputMode === 'url' ? finalImageUrl : undefined,
            imageBase64: imageBase64,
            title: title.trim() || undefined,
            productUrl: productUrl.trim(),
          }),
        });
        const catResult = await catRes.json();
        if (!catRes.ok) {
          throw new Error(catResult.error ?? 'Could not categorize this item.');
        }
        const { category } = catResult as { category?: string };
        if (typeof category !== 'string') {
          throw new Error('Could not categorize this item.');
        }
        finalCategory = category;
        setAiStatus('done');
      }

      // 3. Save crumb
      const saveRes = await fetch('/api/crumbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: finalImageUrl,
          product_url: productUrl.trim(),
          category: finalCategory,
          title: title.trim() || null,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error ?? 'Failed to save');
      }

      const { crumb } = await saveRes.json();
      onAdd(crumb);
      handleClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setAiStatus('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <motion.button
        id="add-crumb-fab"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-8 right-8 z-50 w-14 h-14 bg-ink text-canvas rounded-full shadow-modal flex items-center justify-center transition-shadow hover:shadow-lg"
        aria-label="Add a crumb"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm"
              onClick={handleClose}
            />

            {/* Modal panel */}
            <motion.div
              key="modal"
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full sm:max-w-md bg-canvas rounded-t-3xl sm:rounded-3xl shadow-modal border border-border overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
                  <div>
                    <h2 className="text-base font-semibold text-ink">add a crumb</h2>
                    <p className="text-xs text-muted mt-0.5">drop something you love onto your board</p>
                  </div>
                  <button
                    onClick={handleClose}
                    id="close-modal-btn"
                    disabled={isSubmitting}
                    className="p-1.5 rounded-full text-muted hover:text-ink hover:bg-surface transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                  {/* Image input toggle */}
                  <div>
                    <div className="flex gap-1 mb-3 p-1 bg-surface rounded-xl">
                      <button
                        type="button"
                        id="toggle-url"
                        onClick={() => setInputMode('url')}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition-all duration-150 ${
                          inputMode === 'url'
                            ? 'bg-canvas text-ink shadow-soft'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Image URL
                      </button>
                      <button
                        type="button"
                        id="toggle-file"
                        onClick={() => setInputMode('file')}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition-all duration-150 ${
                          inputMode === 'file'
                            ? 'bg-canvas text-ink shadow-soft'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload
                      </button>
                    </div>

                    {/* URL input */}
                    {inputMode === 'url' && (
                      <input
                        type="url"
                        id="image-url-input"
                        value={imageUrl}
                        onChange={(e) => handleImageUrlChange(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-all"
                      />
                    )}

                    {/* File drop zone */}
                    {inputMode === 'file' && (
                      <div
                        id="drop-zone"
                        onDrop={handleDrop}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-150 ${
                          isDragging
                            ? 'border-ink bg-surface-hover'
                            : 'border-border hover:border-ink/40 hover:bg-surface'
                        }`}
                      >
                        <ImageIcon className="w-5 h-5 text-muted mb-2" />
                        <p className="text-xs text-muted">
                          drag & drop or <span className="text-ink font-medium underline">browse</span>
                        </p>
                        <p className="text-[10px] text-muted mt-0.5">JPEG, PNG, WebP — up to 10MB</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileChange(f);
                          }}
                        />
                      </div>
                    )}

                    {/* Preview or Cropper */}
                    {imagePreview && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 relative"
                      >
                        {isCropping ? (
                          <ImageRectangleCropper
                            imageSrc={imagePreview}
                            onCrop={(croppedDataUrl) => {
                              setImagePreview(croppedDataUrl);
                              setIsCropping(false);
                            }}
                            onCancel={() => setIsCropping(false)}
                          />
                        ) : (
                          <div className="relative h-40 rounded-xl overflow-hidden bg-surface border border-border/70">
                            <Image
                              src={imagePreview}
                              alt="Preview"
                              fill
                              className="object-contain"
                              unoptimized
                            />
                            <div className="absolute top-2 right-2 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setIsCropping(true)}
                                className="px-2.5 py-1 bg-ink/80 hover:bg-ink text-white rounded-lg text-xs font-medium backdrop-blur-md flex items-center gap-1 shadow-soft transition-colors"
                                title="Drag rectangle to crop"
                              >
                                <Crop className="w-3 h-3" />
                                <span>Crop piece</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setImagePreview('');
                                  setImageFile(null);
                                  setImageUrl('');
                                  setIsCropping(false);
                                }}
                                className="p-1.5 bg-ink/70 hover:bg-ink text-white rounded-lg transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* Product link */}
                  <div>
                    <label className="text-xs font-medium text-ink-light mb-1.5 block">
                      product link <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="url"
                      id="product-url-input"
                      value={productUrl}
                      onChange={(e) => setProductUrl(e.target.value)}
                      placeholder="https://shop.com/item"
                      required
                      className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-all"
                    />
                  </div>

                  {/* Optional title */}
                  <div>
                    <label className="text-xs font-medium text-ink-light mb-1.5 block">
                      title / note <span className="text-muted font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      id="title-input"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="linen blazer from cos..."
                      maxLength={100}
                      className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-all"
                    />
                  </div>

                  {/* Category selection */}
                  <div>
                    <label className="text-xs font-medium text-ink-light mb-1.5 flex items-center justify-between">
                      <span>category</span>
                      <span className="text-[11px] text-muted font-normal">
                        {selectedCategory === 'auto' ? '✨ AI auto-sort' : 'manual'}
                      </span>
                    </label>
                    <select
                      id="category-select"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-surface border border-border rounded-xl text-ink focus:outline-none focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-all cursor-pointer"
                    >
                      <option value="auto">✨ AI Auto-sort (recommended)</option>
                      <option value="clothes">clothes (dresses, tops, jackets, pants)</option>
                      <option value="shoes & accessories">shoes & accessories (bags, shoes, jewelry)</option>
                      <option value="body & skin">body & skin (skincare, makeup, perfume)</option>
                      <option value="home & living">home & living (decor, candles, furniture)</option>
                      <option value="tools & tech">tools & tech (gadgets, audio, desk)</option>
                      <option value="misc">misc (art, books, unique finds)</option>
                    </select>
                  </div>

                  {/* Error */}
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-rose-500 bg-rose-50 px-3 py-2 rounded-lg"
                    >
                      {error}
                    </motion.p>
                  )}

                  {/* AI status pill */}
                  <AnimatePresence>
                    {aiStatus === 'thinking' && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-2 px-3.5 py-2.5 bg-surface rounded-xl border border-border"
                      >
                        <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />
                        <span className="text-xs text-muted italic">crumbs AI is sorting...</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit */}
                  <button
                    type="submit"
                    id="submit-crumb-btn"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-ink text-canvas text-sm font-semibold rounded-xl hover:bg-ink-light transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        adding...
                      </>
                    ) : (
                      'add to board'
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
