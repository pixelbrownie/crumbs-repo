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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-surface animate-pulse"
                style={{ height: `${[180, 240, 200, 280, 160, 220, 260, 190, 300, 210][i]}px` }}
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
