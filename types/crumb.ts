export type Category =
  | 'all'
  | 'clothes'
  | 'shoes & accessories'
  | 'home & living'
  | 'tools & tech'
  | 'misc'
  | 'curios'
  | (string & {});

export const DEFAULT_CATEGORIES: Category[] = [
  'all',
  'clothes',
  'shoes & accessories',
  'home & living',
  'tools & tech',
  'misc',
];

export const CATEGORIES = DEFAULT_CATEGORIES;

export const AI_CATEGORIES = ['clothes', 'shoes & accessories', 'home & living', 'tools & tech', 'misc'] as const;

export type CrumbStatus = 'pending' | 'ready' | 'failed';

export interface Crumb {
  id: string;
  user_id: string;
  image_url: string;
  product_url: string;
  category: Category;
  title?: string | null;
  created_at: string;

  // Enrichment fields (Phase 2)
  tags?: string[];
  item_type?: string | null;
  brand?: string | null;
  colors?: string[];
  aesthetic?: string[];
  source_domain?: string | null;
  status: CrumbStatus;
  original_image_url?: string | null;
  width?: number | null;
  height?: number | null;
  blur_data_url?: string | null;
}

export type CollectionKind =
  | 'category'
  | 'aesthetic'
  | 'color'
  | 'brand'
  | 'custom';

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  kind: CollectionKind;
  slug: string;
  created_at: string;
  item_count?: number;
  count?: number;
}

export interface CaptureToken {
  id: string;
  user_id: string;
  label: string;
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
}
