'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import Header from '@/components/Header';
import MasonryGrid from '@/components/MasonryGrid';
import AddCrumbModal from '@/components/AddCrumbModal';
import Toast, { type ToastMessage } from '@/components/Toast';
import type { Category, Collection, Crumb } from '@/types/crumb';
import { createClient } from '@/lib/supabase';
import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // 2-second splash screen transition
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  const addToast = useCallback((type: 'info' | 'success' | 'error', title: string, subtitle?: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, type, title, subtitle }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth listener
  useEffect(() => {
    if (!mounted) return;

    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setUser(data.user);
      if (!data.user) {
        window.location.href = '/login';
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: User } | null) => {
        setUser(session?.user ?? null);
        if (!session) window.location.href = '/login';
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [mounted, supabase]);

  // Fetch collections
  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/collections');
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections || []);
      }
    } catch (err) {
      console.warn('Failed to fetch collections:', err);
    }
  }, []);

  // Fetch crumbs
  const fetchCrumbs = useCallback(
    async (cat: Category, col: Collection | null, query: string, showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (cat !== 'all') params.set('category', cat);
        if (col) params.set('collection_id', col.id);
        if (query.trim()) params.set('q', query.trim());

        const url = `/api/crumbs${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch crumbs');
        const { crumbs: data } = await res.json();
        setCrumbs(data ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    []
  );

  // Trigger crumb fetch when filters change
  useEffect(() => {
    if (user) {
      fetchCrumbs(activeCategory, activeCollection, searchQuery);
      fetchCollections();
    }
  }, [user, activeCategory, activeCollection, searchQuery, fetchCrumbs, fetchCollections]);

  // Realtime subscription on `crumbs` table
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('realtime:crumbs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crumbs',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newCrumb = payload.new as Crumb;
            // Prepend new crumb
            setCrumbs((prev) => {
              if (prev.some((c) => c.id === newCrumb.id)) return prev;
              return [newCrumb, ...prev];
            });
            addToast('info', 'piece captured', 'AI is analyzing and tagging...');
            fetchCollections();
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Crumb;
            setCrumbs((prev) =>
              prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
            );
            if (updated.status === 'ready') {
              addToast('success', 'piece ready', `${updated.category}${updated.brand ? ` · ${updated.brand}` : ''}`);
              fetchCollections();
            }
          } else if (payload.eventType === 'DELETE') {
            setCrumbs((prev) => prev.filter((c) => c.id !== payload.old.id));
            fetchCollections();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, addToast, fetchCollections]);

  // Short polling fallback for pending crumbs
  useEffect(() => {
    const hasPending = crumbs.some((c) => c.status === 'pending');

    if (hasPending && !pollTimerRef.current) {
      pollTimerRef.current = setInterval(() => {
        fetchCrumbs(activeCategory, activeCollection, searchQuery, false);
        fetchCollections();
      }, 3500);
    } else if (!hasPending && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [crumbs, activeCategory, activeCollection, searchQuery, fetchCrumbs, fetchCollections]);

  const handleCategoryChange = (cat: Category) => {
    setActiveCategory(cat);
    setActiveCollection(null);
  };

  const handleSelectCollection = (col: Collection | null) => {
    setActiveCollection(col);
    if (col) setActiveCategory('all');
  };

  const handleAdd = (crumb: Crumb) => {
    setCrumbs((prev) => [crumb, ...prev]);
    fetchCollections();
    addToast('success', 'piece added');
  };

  const handleDelete = (id: string) => {
    setCrumbs((prev) => prev.filter((c) => c.id !== id));
    fetchCollections();
  };

  const handleUpdate = (updatedCrumb: Crumb) => {
    setCrumbs((prev) =>
      prev.map((c) => (c.id === updatedCrumb.id ? updatedCrumb : c))
    );
    fetchCollections();
    addToast('success', 'piece re-sorted', `${updatedCrumb.category}${updatedCrumb.brand ? ` · ${updatedCrumb.brand}` : ''}`);
  };

  const customCategories = useMemo(() => {
    return collections
      .filter((c) => c.kind === 'custom')
      .map((c) => c.name.toLowerCase().trim())
      .filter(Boolean);
  }, [collections]);

  const handleAddBoard = async (name: string) => {
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok && data.collection) {
        addToast('success', 'board created', `created board "${data.collection.name}"`);
        await fetchCollections();
        handleCategoryChange(data.collection.name as Category);
      } else {
        addToast('error', 'could not create board', data.error || 'Something went wrong');
      }
    } catch {
      addToast('error', 'error', 'Failed to connect to server');
    }
  };

  const handleDeleteBoard = async (name: string) => {
    try {
      const res = await fetch(`/api/collections?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        addToast('info', 'board deleted', `removed "${name}"`);
        await fetchCollections();
        if (activeCategory.toLowerCase() === name.toLowerCase()) {
          handleCategoryChange('all');
        } else {
          fetchCrumbs(activeCategory, activeCollection, searchQuery);
        }
      } else {
        addToast('error', 'delete failed', data.error || 'Could not delete board');
      }
    } catch {
      addToast('error', 'error', 'Failed to connect to server');
    }
  };

  const [resortingAll, setResortingAll] = useState(false);

  const handleResortAll = async () => {
    if (resortingAll) return;
    setResortingAll(true);
    addToast('info', 're-analyzing pieces', 'AI vision is inspecting and categorizing items...');
    try {
      const res = await fetch('/api/crumbs/resort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('success', 'pieces categorized', `re-sorted ${data.count ?? ''} pieces into their boards`);
        fetchCrumbs(activeCategory, activeCollection, searchQuery);
        fetchCollections();
      } else {
        addToast('error', 're-sort failed', data.error || 'Could not re-sort pieces');
      }
    } catch {
      addToast('error', 're-sort failed', 'Network error');
    } finally {
      setResortingAll(false);
    }
  };

  if (!mounted) {
    return (
      <div className="fixed inset-0 z-50 bg-canvas flex flex-col items-center justify-center select-none">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-ink font-sans">
            crumbs
          </h1>
          <p className="text-xs sm:text-sm text-muted tracking-wide mt-2 font-sans">
            every piece you love.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas relative">
      {/* 2-Second Luxury Brand Splash Overlay */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 bg-canvas flex flex-col items-center justify-center select-none pointer-events-none"
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="text-center"
            >
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-ink font-sans">
                crumbs
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-xs sm:text-sm text-muted tracking-wide mt-2 font-sans"
              >
                every piece you love.
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Header
        user={user}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        customCategories={customCategories}
        onAddCategory={handleAddBoard}
        onDeleteCategory={handleDeleteBoard}
        collections={collections}
        activeCollection={activeCollection}
        onSelectCollection={handleSelectCollection}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {loading ? (
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-3 sm:gap-4 column-fill-balance w-full">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-surface animate-pulse mb-3 sm:mb-4 inline-block w-full break-inside-avoid"
                style={{ height: `${[220, 310, 260, 380, 190, 290, 340, 240, 400, 270, 320, 230][i]}px` }}
              />
            ))}
          </div>
        ) : (
          <MasonryGrid
            crumbs={crumbs}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            customCategories={customCategories}
          />
        )}
      </main>

      {user && <AddCrumbModal onAdd={handleAdd} customCategories={customCategories} />}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
