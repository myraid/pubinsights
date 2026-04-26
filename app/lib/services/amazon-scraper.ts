const DECODO_URL = 'https://scraper-api.decodo.com/v2/scrape';
const AFFILIATE_TAG = 'pubinsights-20';
const MAX_CONCURRENT = 5;

interface DecodoResponse {
  results: {
    content: {
      results: {
        results?: {
          organic?: RawSearchItem[];
        };
        [key: string]: unknown;
      };
    };
  }[];
}

interface RawSearchItem {
  pos?: number;
  asin?: string;
  title?: string;
  price?: number;
  rating?: number;
  currency?: string;
  is_prime?: boolean;
  url_image?: string;
  manufacturer?: string;
  reviews_count?: number;
}

interface RawReview {
  id?: string;
  title?: string;
  author?: string;
  rating?: number;
  content?: string;
  timestamp?: string;
  profile_id?: string;
  is_verified?: boolean;
  review_from?: string;
  helpful_count?: number;
}

interface RawProductResults {
  description?: string;
  sales_rank?: { rank?: number }[];
  product_details?: Record<string, unknown> & {
    publication_date?: string;
    publisher?: string;
  };
  manufacturer?: string;
  category?: { ladder?: { name?: string }[] }[];
  reviews?: RawReview[];
  rating?: number;
  rating_stars_distribution?: Record<string, unknown>[];
  review_ai_summary?: string;
}

export interface Review {
  id: string;
  title: string;
  author: string;
  rating: number;
  content: string;
  timestamp: string;
  profile_id?: string;
  is_verified: boolean;
  review_from?: string;
  helpful_count?: number;
}

export interface BookItem {
  title: string;
  asin: string;
  url: string;
  image_url: string;
  description: string | null;
  price: number;
  currency: string;
  is_prime: boolean;
  position: number;
  rating: number;
  reviews_count: number;
  reviews: Review[];
  rating_stars_distribution: Record<string, unknown>[];
  review_ai_summary: string | null;
  publisher: string | null;
  publication_date: string | null;
  manufacturer: string | null;
  categories: string[];
  bsr: number;
  product_details: Record<string, unknown> | null;
}

function getAuthHeader(): string {
  const key = process.env.SCRAPPER_AUTHORIZATION_KEY;
  if (!key) throw new Error('SCRAPPER_AUTHORIZATION_KEY is not configured');
  return key;
}

async function decodoRequest(payload: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(DECODO_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'authorization': getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Decodo API error ${response.status}: ${text}`);
  }

  return response.json();
}

async function fetchProductDetails(asin: string): Promise<RawProductResults> {
  try {
    const data = await decodoRequest({
      target: 'amazon_product',
      query: asin,
      parse: true,
      autoselect_variant: false,
    }) as { results?: { content?: { results?: RawProductResults } }[] };

    return data?.results?.[0]?.content?.results ?? {};
  } catch (error) {
    console.error(`Error fetching details for ASIN ${asin}:`, error);
    return {};
  }
}

function enrichBookWithDetails(book: BookItem, product: RawProductResults): void {
  if (!product || !Object.keys(product).length) return;

  book.description = product.description ?? null;

  const salesRank = product.sales_rank;
  if (Array.isArray(salesRank) && salesRank.length > 0) {
    book.bsr = salesRank[0]?.rank ?? 0;
  }

  const details = product.product_details;
  if (details && typeof details === 'object') {
    book.publication_date = details.publication_date ?? null;
    book.publisher = details.publisher ?? 'unknown publisher';
    book.product_details = details;
  }

  book.manufacturer = product.manufacturer ?? 'unknown manufacturer';

  const categories = product.category;
  if (Array.isArray(categories) && categories.length > 0) {
    const ladder = categories[0]?.ladder;
    if (Array.isArray(ladder)) {
      book.categories = ladder
        .map(c => c?.name ?? '')
        .filter(name => name && name !== 'Books');
    }
  }

  const reviews = product.reviews;
  if (Array.isArray(reviews)) {
    book.reviews = reviews
      .filter((r): r is RawReview => typeof r === 'object' && r !== null)
      .map(r => ({
        id: r.id ?? '',
        title: r.title ?? '',
        author: r.author ?? '',
        rating: Number(r.rating ?? 0),
        content: r.content ?? '',
        timestamp: r.timestamp ?? '',
        profile_id: r.profile_id ?? undefined,
        is_verified: r.is_verified ?? false,
        review_from: r.review_from ?? undefined,
        helpful_count: r.helpful_count ?? undefined,
      }));
    book.reviews_count = reviews.length;
  }

  if (product.rating != null) book.rating = product.rating;
  book.rating_stars_distribution = product.rating_stars_distribution ?? [];
  book.review_ai_summary = product.review_ai_summary ?? null;
}

async function runConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const p = fn(item).then(r => { results.push(r); });
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

export async function searchAmazonBooks(keyword: string): Promise<BookItem[]> {
  const data = await decodoRequest({
    target: 'amazon_search',
    query: keyword,
    domain: 'com',
    page_from: '1',
    category: '1000',
    parse: true,
  }) as DecodoResponse;

  const organic = data?.results?.[0]?.content?.results?.results?.organic ?? [];

  const books: BookItem[] = organic
    .filter(item => item.asin && item.title)
    .map(item => ({
      position: item.pos ?? 0,
      url: `https://www.amazon.com/dp/${item.asin}?tag=${AFFILIATE_TAG}`,
      asin: item.asin!,
      price: item.price ?? 0,
      title: item.title!,
      rating: item.rating ?? 0,
      currency: item.currency ?? 'USD',
      is_prime: item.is_prime ?? false,
      image_url: item.url_image ?? '',
      manufacturer: item.manufacturer ?? null,
      reviews_count: item.reviews_count ?? 0,
      description: null,
      reviews: [],
      rating_stars_distribution: [],
      review_ai_summary: null,
      publisher: null,
      publication_date: null,
      categories: [],
      bsr: 0,
      product_details: null,
    }));

  const detailResults = await runConcurrent(
    books,
    async (book) => {
      const details = await fetchProductDetails(book.asin);
      return { book, details };
    },
    MAX_CONCURRENT
  );

  for (const { book, details } of detailResults) {
    enrichBookWithDetails(book, details);
  }

  return books;
}

export async function getProductDetails(asin: string): Promise<RawProductResults> {
  return fetchProductDetails(asin);
}

export interface BookLookup {
  asin: string;
  title: string;
  author: string | null;
  description: string | null;
  price: number | null;
  rating: number | null;
  imageUrl: string | null;
  publisher: string | null;
  categories: string[];
  bsr: number | null;
  url: string;
}

export async function lookupBookByAsin(asin: string): Promise<BookLookup | null> {
  const product = await fetchProductDetails(asin);
  if (!product || !Object.keys(product).length) return null;

  const details = product.product_details ?? {};
  const categories = product.category ?? [];
  const ladder = Array.isArray(categories) && categories[0]?.ladder
    ? categories[0].ladder
        .map((c: { name?: string }) => c?.name ?? '')
        .filter((n: string) => n && n !== 'Books')
    : [];

  // Search by ASIN to get title, image, and price (not in product details)
  let title = '';
  let imageUrl: string | null = null;
  let price: number | null = null;

  try {
    const searchData = await decodoRequest({
      target: 'amazon_search',
      query: asin,
      domain: 'com',
      category: '1000',
      parse: true,
    }) as DecodoResponse;

    const organic = searchData?.results?.[0]?.content?.results?.results?.organic ?? [];
    const match = organic.find(item => item.asin === asin) ?? organic[0];
    if (match) {
      title = match.title ?? '';
      imageUrl = match.url_image ?? null;
      price = match.price ?? null;
    }
  } catch {
    // Search failed — use what we have from product details
  }

  return {
    asin,
    title: title || asin,
    author: product.manufacturer ?? null,
    description: product.description ?? null,
    price,
    rating: product.rating ?? null,
    imageUrl,
    publisher: (details as Record<string, unknown>).publisher as string ?? null,
    categories: ladder,
    bsr: Array.isArray(product.sales_rank) && product.sales_rank[0]?.rank
      ? product.sales_rank[0].rank
      : null,
    url: `https://www.amazon.com/dp/${asin}?tag=${AFFILIATE_TAG}`,
  };
}

