/**
 * Shared search query normalization and parsing.
 * Used by both API routes (global search) and client-side views (collection, watchlist).
 */

/* ═══════════════════════════════════════
   NORMALIZATION
   ═══════════════════════════════════════ */

/**
 * Normalize a raw user query for searching.
 * Handles: #105 → 105, 4/102 → 4, "  Char  " → "Char"
 */
export function normalizeQuery(raw: string): string {
  return raw
    .trim()
    .replace(/^#/, '')           // "#105" → "105"
    .replace(/\/\d+$/, '');      // "4/102" → "4"
}

/* ═══════════════════════════════════════
   PATTERN DETECTION (API search)
   ═══════════════════════════════════════ */

export interface ParsedSearchQuery {
  type: 'name' | 'number' | 'name_number' | 'raw';
  name?: string;
  number?: string;
  raw: string;
  apiQuery: string; // formatted for pokemontcg.io API
}

/**
 * Parse a raw user query into structured components for API search.
 * Supports: card numbers (#105, 4/102), name+number combos (Charizard ex 105),
 * special prefixes (TG01, SVP001, SWSH001, RC24), and plain names.
 */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const q = raw.trim();
  if (!q || q.length < 2) return { type: 'raw', raw: q, apiQuery: q };

  // Pattern 1: "4/102" or "4 / 102" → extract number part
  const slashNumberMatch = q.match(/^(\d+)\s*\/\s*\d+$/);
  if (slashNumberMatch) {
    return {
      type: 'number',
      number: slashNumberMatch[1],
      raw: q,
      apiQuery: `number:${slashNumberMatch[1]}`,
    };
  }

  // Pattern 2: "#105" → extract number
  const hashNumberMatch = q.match(/^#(\d+)$/);
  if (hashNumberMatch) {
    return {
      type: 'number',
      number: hashNumberMatch[1],
      raw: q,
      apiQuery: `number:${hashNumberMatch[1]}`,
    };
  }

  // Pattern 3: Special prefixes — TG01, SVP001, SWSH001, RC24
  // These are literal card numbers, not quantities. Search as-is.
  const specialPrefixMatch = q.match(/^(TG|SVP|SWSH|RC)\d+$/i);
  if (specialPrefixMatch) {
    return {
      type: 'number',
      number: q,
      raw: q,
      apiQuery: `number:"${q}"`,
    };
  }

  // Pattern 4: "Charizard ex 105" or "Pikachu V 25" → name + number suffix
  // Must end with digits, optionally preceded by variant keywords
  const nameNumberMatch = q.match(/^(.+?)\s+(?:ex|V|VMAX|VSTAR)?\s*(\d+)$/i);
  if (nameNumberMatch) {
    const namePart = nameNumberMatch[1].trim();
    const numberPart = nameNumberMatch[2];
    // Guard: don't split if "name" is just the variant keyword itself
    if (!namePart.match(/^(ex|V|VMAX|VSTAR)$/i)) {
      return {
        type: 'name_number',
        name: namePart,
        number: numberPart,
        raw: q,
        apiQuery: `name:"${namePart}" number:${numberPart}`,
      };
    }
  }

  // Pattern 5: Pure number string (2+ digits, nothing else) → treat as card number
  const pureNumberMatch = q.match(/^\d{2,}$/);
  if (pureNumberMatch) {
    return {
      type: 'number',
      number: q,
      raw: q,
      apiQuery: `number:${q}`,
    };
  }

  // Fallback: plain name search
  return {
    type: 'name',
    name: q,
    raw: q,
    apiQuery: q,
  };
}

/* ═══════════════════════════════════════
   CLIENT-SIDE COLLECTION FILTERING
   ═══════════════════════════════════════ */

export interface SearchableItem {
  name: string;
  setName?: string;
  number?: string;
  rarity?: string;
  condition?: string;
}

/**
 * Filter a local collection/watchlist array using normalized number-aware search.
 * Handles: #105, 4/102, TG01, SVP001, and plain names.
 */
export function filterCollectionByQuery<T extends SearchableItem>(
  items: T[],
  rawQuery: string
): T[] {
  const q = rawQuery.trim();
  if (!q) return items;

  const parsed = parseSearchQuery(q);
  const normalized = normalizeQuery(q).toLowerCase();

  return items.filter((item) => {
    const name = item.name.toLowerCase();
    const setName = (item.setName || '').toLowerCase();
    const number = (item.number || '').toLowerCase();
    const rarity = (item.rarity || '').toLowerCase();
    const condition = (item.condition || '').toLowerCase();

    // If parsed as pure number search, match number field exactly or partially
    if (parsed.type === 'number' && parsed.number) {
      const searchNum = parsed.number.toLowerCase();
      // Exact match: "105" matches "105" or "105/195"
      // Partial match: "TG" matches "TG01", "TG02"...
      if (number === searchNum) return true;
      if (number.startsWith(searchNum)) return true;
      // Fallback: also match name/set in case user typed wrong
      return name.includes(normalized) || setName.includes(normalized);
    }

    // If parsed as name+number, match both or fall through to name
    if (parsed.type === 'name_number') {
      const nameMatch = parsed.name ? name.includes(parsed.name.toLowerCase()) : false;
      const numMatch = parsed.number ? number.includes(parsed.number.toLowerCase()) : false;
      // Require name match AND (number match OR no number stored)
      if (nameMatch && (numMatch || !item.number)) return true;
    }

    // Default: fuzzy-ish substring match across all fields
    return (
      name.includes(normalized) ||
      setName.includes(normalized) ||
      number.includes(normalized) ||
      rarity.includes(normalized) ||
      condition.includes(normalized)
    );
  });
}
