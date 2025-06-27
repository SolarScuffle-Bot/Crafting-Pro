// utils.js
import { craftingData } from './data.js';

/**
 * Remove all item- and recipe-cards from the DOM.
 * @returns {void}
 */
export const deleteCards = () => {
	document
		.querySelectorAll('.item-card, .recipe-card')
		.forEach(el => el.remove());
};

/**
 * Check whether an item name is already used (case-insensitive).
 * @param {string} name
 * @returns {boolean}
 */
export const itemExistsAlready = name => {
	const exists = Object.values(craftingData.items)
		.some(i => i.name.toLowerCase() === name.toLowerCase());
	return !(name && !exists);
}

/**
 * Rough check: is this string parseable as an HTTP(S) URL?
 * @param {string} s
 * @returns {boolean}
 */
export const isValidHttpUrl = s => {
	try {
		const u = new URL(s);
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * Very basic sanity check: must
 *   • parse as a URL,
 *   • be http(s),
 *   • have a hostname containing at least one dot “.”,
 *   • not start or end with a dot.
 *
 * @param {string} s
 * @returns {boolean}
 */
export const isLikelyReadyUrl = s => {
	try {
		const u = new URL(s);
		if (!['http:', 'https:'].includes(u.protocol)) return false;

		const host = u.hostname;
		// require at least one dot, not leading/trailing
		if (!host.includes('.')
			|| host.startsWith('.')
			|| host.endsWith('.')
		) return false;

		return true;
	} catch {
		return false;
	}
}

/**
 * Generate a RFC-4122 v4 UUID for a new record ID.
 * Uses the browser’s native crypto.randomUUID if available,
 * otherwise falls back to a simple random-hex implementation.
 *
 * @returns {string}
 */
export function generateId() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// fallback: 32 hex chars in 8-4-4-4-12 form
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

/**
 * Replacement for your levenshtein() that ranks:
 *   0. exact == query
 *   1. name startsWith(query)
 *   2. name includes(query)
 *   3. fuzzy match (Jaro–Winkler)
 *
 * @param {string} name
 * @param {string} query
 * @returns {number}  lower = better match
 */
export function levenshtein(name, query) {
	const a = name.toLowerCase();
	const b = query.toLowerCase();

	// 0) Exact match → best possible
	if (a === b) return 0;

	// 1) Prefix match → next best
	if (a.startsWith(b)) {
	  return 1 + 0;    // +0 so all prefix‐matches sort before substring
	}

	// 2) Substring match → still very good
	if (a.includes(b)) {
	  return 2 + 0;    // +0 so all “contains” sort before fuzzy
	}

	// 3) Fuzzy: compute Jaro–Winkler similarity, convert to distance
	const sim = jaroWinkler(a, b);
	const simDist = 1 - sim;     // 0 = identical, 1 = totally different

	// Put fuzzy matches into group “3” but ordered by how similar they are
	return 3 + simDist;
  }


  /**
   * Jaro similarity (0…1)
   */
  function jaro(s1, s2) {
	if (s1 === s2) return 1;
	const len1 = s1.length, len2 = s2.length;
	if (!len1 || !len2) return 0;

	// match window
	const matchDist = Math.floor(Math.max(len1, len2) / 2) - 1;
	const s1m = Array(len1).fill(false);
	const s2m = Array(len2).fill(false);

	// count matches
	let matches = 0;
	for (let i = 0; i < len1; i++) {
	  const start = Math.max(0, i - matchDist),
			end   = Math.min(i + matchDist + 1, len2);
	  for (let j = start; j < end; j++) {
		if (!s2m[j] && s1[i] === s2[j]) {
		  s1m[i] = s2m[j] = true;
		  matches++;
		  break;
		}
	  }
	}
	if (matches === 0) return 0;

	// count transpositions
	let t = 0, k = 0;
	for (let i = 0; i < len1; i++) {
	  if (!s1m[i]) continue;
	  while (!s2m[k]) k++;
	  if (s1[i] !== s2[k]) t++;
	  k++;
	}
	t = t / 2;

	return (
	  (matches / len1) +
	  (matches / len2) +
	  ((matches - t) / matches)
	) / 3;
  }

  /**
   * Jaro–Winkler similarity (0…1), boosting common prefix
   */
  function jaroWinkler(s1, s2, prefixScale = 0.1) {
	const j = jaro(s1, s2);
	// length of common prefix up to 4 chars
	let pref = 0;
	const maxPref = 4;
	for (; pref < maxPref && pref < s1.length && s1[pref] === s2[pref]; pref++);
	return j + pref * prefixScale * (1 - j);
  }