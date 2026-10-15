export interface SampleProduct {
  id: string;
  name: string;
  expectedCategory: string;
  imageUrl: string;
  productUrl: string;
  title: string;
}

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    id: '1',
    name: 'Trench Coat',
    expectedCategory: 'clothes',
    imageUrl: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/oversized-trench-coat',
    title: 'Oversized Wool Blend Trench Coat in Sand',
  },
  {
    id: '2',
    name: 'Ballet Flats',
    expectedCategory: 'shoes & accessories',
    imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/leather-mary-jane-flats',
    title: 'Leather Square-Toe Mary Jane Ballet Flats',
  },
  {
    id: '3',
    name: 'Leather Shoulder Bag',
    expectedCategory: 'shoes & accessories',
    imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/minimalist-leather-tote',
    title: 'Minimalist Structured Leather Tote Bag',
  },
  {
    id: '4',
    name: 'Ceramic Table Lamp',
    expectedCategory: 'home & living',
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/terracotta-ceramic-lamp',
    title: 'Handmade Terracotta Ceramic Table Lamp',
  },
  {
    id: '5',
    name: 'Linen Lounge Chair',
    expectedCategory: 'home & living',
    imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/scandinavian-armchair',
    title: 'Scandinavian Modern Oak and Linen Armchair',
  },
  {
    id: '6',
    name: 'Scented Candle',
    expectedCategory: 'home & living',
    imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/amber-smoke-candle',
    title: 'Amber & Hinoki Wood Soy Wax Scented Candle',
  },
  {
    id: '7',
    name: 'Over-Ear Headphones',
    expectedCategory: 'tools & tech',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/wireless-anc-headphones',
    title: 'Matte Charcoal Wireless Noise Cancelling Headphones',
  },
  {
    id: '8',
    name: 'Mechanical Keyboard',
    expectedCategory: 'tools & tech',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/custom-mechanical-keyboard',
    title: 'Custom Aluminum 75% Mechanical Keyboard with PBT Keycaps',
  },
  {
    id: '9',
    name: 'Minimalist Art Print',
    expectedCategory: 'curios',
    imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/abstract-botanical-print',
    title: 'Framed Archival Abstract Botanical Woodblock Art Print',
  },
  {
    id: '10',
    name: 'Architecture Monograph Book',
    expectedCategory: 'curios',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop',
    productUrl: 'https://shop.example.com/modernist-architecture-book',
    title: 'Hardcover Monograph: Mid-Century Modern Architecture in Japan',
  },
];
