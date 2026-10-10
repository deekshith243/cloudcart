type ProductImageDefinition = {
  name: string;
  imageUrl: string;
};

const productImages: ProductImageDefinition[] = [
  {
    name: 'Brass Desk Lamp',
    imageUrl:
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Wool Desk Mat',
    imageUrl:
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Aluminium Notebook Stand',
    imageUrl:
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Field Notes Set',
    imageUrl:
      'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Canvas Weekender',
    imageUrl:
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Packable Rain Shell',
    imageUrl:
      'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Passport Wallet',
    imageUrl:
      'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Merino Travel Blanket',
    imageUrl:
      'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Compact Bluetooth Speaker',
    imageUrl:
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Walnut Headphone Stand',
    imageUrl:
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Analog Alarm Clock',
    imageUrl:
      'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=900&q=85',
  },
];

const imageByName = new Map(productImages.map((product) => [product.name.toLowerCase(), product.imageUrl]));

const keywordImages: Array<{ keywords: string[]; imageUrl: string }> = [
  {
    keywords: ['lamp', 'lighting'],
    imageUrl: imageByName.get('brass desk lamp')!,
  },
  {
    keywords: ['notebook', 'journal', 'notes', 'paper'],
    imageUrl: imageByName.get('field notes set')!,
  },
  {
    keywords: ['stand', 'desk'],
    imageUrl: imageByName.get('aluminium notebook stand')!,
  },
  {
    keywords: ['bag', 'weekender', 'luggage', 'backpack'],
    imageUrl: imageByName.get('canvas weekender')!,
  },
  {
    keywords: ['rain', 'jacket', 'shell', 'coat'],
    imageUrl: imageByName.get('packable rain shell')!,
  },
  {
    keywords: ['passport', 'wallet', 'leather'],
    imageUrl: imageByName.get('passport wallet')!,
  },
  {
    keywords: ['blanket', 'throw'],
    imageUrl: imageByName.get('merino travel blanket')!,
  },
  {
    keywords: ['speaker', 'audio', 'sound'],
    imageUrl: imageByName.get('compact bluetooth speaker')!,
  },
  {
    keywords: ['headphone', 'headset'],
    imageUrl: imageByName.get('walnut headphone stand')!,
  },
  {
    keywords: ['clock', 'alarm'],
    imageUrl: imageByName.get('analog alarm clock')!,
  },
];

const categoryImages = new Map<string, string>([
  ['desk essentials', imageByName.get('aluminium notebook stand')!],
  ['travel goods', imageByName.get('canvas weekender')!],
  ['home audio', imageByName.get('compact bluetooth speaker')!],
]);

export const resolveProductImage = (
  name: string,
  description = '',
  category = '',
): string | null => {
  const normalizedName = name.trim().toLowerCase();
  const exact = imageByName.get(normalizedName);
  if (exact) return exact;

  const searchableText = `${normalizedName} ${description.toLowerCase()}`;
  const keywordMatch = keywordImages.find(({ keywords }) =>
    keywords.some((keyword) => searchableText.includes(keyword)),
  );
  if (keywordMatch) return keywordMatch.imageUrl;

  return categoryImages.get(category.trim().toLowerCase()) ?? null;
};
