'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import Header from '@/components/Header';
import MasonryGrid from '@/components/MasonryGrid';
import AddCrumbModal from '@/components/AddCrumbModal';
import type { Category, Crumb } from '@/types/crumb';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth listener — only runs in browser
  useEffect(() => {
    if (!mounted) return;

    const { createClient } = require('@/lib/supabase');
    const supabase = createClient();

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
  }, [mounted]);

  // Fetch crumbs
  const fetchCrumbs = useCallback(async (category: Category) => {
    setLoading(true);
    try {
      const params = category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
      const res = await fetch(`/api/crumbs${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const { crumbs: data } = await res.json();
      setCrumbs(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchCrumbs(activeCategory);
  }, [user, activeCategory, fetchCrumbs]);

  const handleCategoryChange = (cat: Category) => {
    setActiveCategory(cat);
  };

  const handleAdd = (crumb: Crumb) => {
    if (activeCategory === 'all' || crumb.category === activeCategory) {
      setCrumbs((prev) => [crumb, ...prev]);
    }
  };

  const handleDelete = (id: string) => {
    setCrumbs((prev) => prev.filter((c) => c.id !== id));
  };

  if (!mounted) {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center">
        <div className="text-muted text-sm animate-pulse">loading crumbs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <Header
        user={user}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
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
          <MasonryGrid crumbs={crumbs} onDelete={handleDelete} />
        )}
      </main>

      {user && <AddCrumbModal onAdd={handleAdd} />}
    </div>
  );
}
