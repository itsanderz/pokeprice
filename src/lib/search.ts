/**
 * Fuzzy search engine powered by Fuse.js
 * 
 * Used both server-side (API route ranking) and client-side (collection/watchlist filtering).
 * Configured for Pokémon card data: name, set, series, rarity, number.
 */

import Fuse, { IFuseOptions } from 'fuse.js';

export interface SearchableCard {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  set?: { name?: string; series?: string };
}

const DEFAULT_FUSE_OPTIONS: IFuseOptions<SearchableCard> = {
  keys: [
    { name: 'name', weight: 0.45 },
    { name: 'set.name', weight: 0.25 },
    { name: 'set.series', weight: 0.15 },
    { name: 'rarity', weight: 0.10 },
    { name: 'number', weight: 0.05 },
  ],
  threshold: 0.35,        // Lower = stricter; 0.35 catches "charzard" → "Charizard" without too much noise
  distance: 100,
  includeScore: true,
  includeMatches: false,
  minMatchCharLength: 2,
  shouldSort: true,
  ignoreLocation: true,   // Match anywhere in the string
  useExtendedSearch: true, // Enables exact-match and prefix operators
};

/**
 * Create a Fuse instance for a given dataset.
 */
export function createSearchIndex<T extends SearchableCard>(
  items: T[],
  options?: IFuseOptions<T>
): Fuse<T> {
  return new Fuse(items, { ...DEFAULT_FUSE_OPTIONS, ...options } as IFuseOptions<T>);
}

/**
 * Perform fuzzy search and return ranked results.
 * When query is empty, returns the original items unchanged.
 */
export function fuzzySearch<T extends SearchableCard>(
  index: Fuse<T>,
  query: string,
  limit?: number
): T[] {
  if (!query || query.trim().length < 2) {
    // Return all items in original order for empty queries
    return index.getIndex().docs as T[];
  }

  const results = index.search(query.trim());
  const sliced = limit ? results.slice(0, limit) : results;
  return sliced.map((r) => r.item);
}

/**
 * Convenience: search raw array without pre-building index.
 */
export function fuzzySearchArray<T extends SearchableCard>(
  items: T[],
  query: string,
  limit?: number
): T[] {
  const index = createSearchIndex(items);
  return fuzzySearch(index, query, limit);
}

/**
 * Server-side: rank and filter API results by relevance.
 * Fetches a broader set from upstream, then uses Fuse to find the best matches.
 */
export function rankByRelevance<T extends SearchableCard>(
  items: T[],
  query: string,
  limit: number
): T[] {
  if (!query || query.trim().length < 2) {
    return items.slice(0, limit);
  }

  const index = createSearchIndex(items, {
    threshold: 0.40, // Slightly more lenient for API results
  });

  return fuzzySearch(index, query, limit);
}
