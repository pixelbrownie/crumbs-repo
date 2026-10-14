export type Category =
  | 'all'
  | 'clothes'
  | 'shoes & accessories'
  | 'body & skin'
  | 'home & living'
  | 'tools & tech'
  | 'curios';

export const CATEGORIES: Category[] = [
  'all',
  'clothes',
  'shoes & accessories',
  'body & skin',
  'home & living',
  'tools & tech',
  'curios',
];

export const AI_CATEGORIES = CATEGORIES.filter((c) => c !== 'all') as Exclude<
  Category,
  'all'
>[];

export interface Crumb {
  id: string;
  user_id: string;
  image_url: string;
  product_url: string;
  category: Category;
  title?: string | null;
  created_at: string;
}
