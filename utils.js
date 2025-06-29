// src/utils.js
import * as Data from './data.js';

/**
 * Remove all item- and recipe-cards from the DOM.
 */
export function deleteCards() {
	document
		.querySelectorAll('.item-card, .recipe-card')
		.forEach(el => el.remove());
}

/**
 * Check whether an item name is already used (case-insensitive).
 * @param {string} name
 * @returns {boolean}  true if name is non-empty and not already used
 */
export function itemExistsAlready(name) {
	const n = name.trim().toLowerCase();
	if (!n) return true;
	return Object.values(Data.items)
		.some(i => i.name.toLowerCase() === n);
}

/**
 * Rough check: is this string parseable as an HTTP(S) URL?
 * @param {string} s
 * @returns {boolean}
 */
export function isValidHttpUrl(s) {
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
export function isLikelyReadyUrl(s) {
	try {
		const u = new URL(s);
		if (!['http:', 'https:'].includes(u.protocol)) return false;
		const h = u.hostname;
		return h.includes('.') && !h.startsWith('.') && !h.endsWith('.');
	} catch {
		return false;
	}
}

/**
 * Generate a RFC-4122 v4 UUID.
 * Uses crypto.randomUUID if available.
 *
 * @returns {string}
 */
export function generateId() {
	return typeof crypto?.randomUUID === 'function'
		? crypto.randomUUID()
		: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
			const r = Math.random() * 16 | 0;
			const v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
}

/**
 * Replacement ranking function:
 *   0. exact match
 *   1. name startsWith(query)
 *   2. name includes(query)
 *   3. fuzzy (Jaro–Winkler)
 *
 * @param {string} name
 * @param {string} query
 * @returns {number} lower = better match
 */
export function levenshtein(name, query) {
	const a = name.toLowerCase(), b = query.toLowerCase();
	if (a === b) return 0;
	if (a.startsWith(b)) return 1;
	if (a.includes(b)) return 2;
	const sim = jaroWinkler(a, b);
	return 3 + (1 - sim);
}

// ——— Internal Jaro / Jaro–Winkler ——————————————————

function jaro(s1, s2) {
	if (s1 === s2) return 1;
	const l1 = s1.length, l2 = s2.length;
	if (!l1 || !l2) return 0;
	const matchDist = Math.floor(Math.max(l1, l2) / 2) - 1;
	const s1m = Array(l1).fill(false), s2m = Array(l2).fill(false);
	let matches = 0;
	for (let i = 0; i < l1; i++) {
		const start = Math.max(0, i - matchDist),
			end = Math.min(i + matchDist + 1, l2);
		for (let j = start; j < end; j++) {
			if (!s2m[j] && s1[i] === s2[j]) {
				s1m[i] = s2m[j] = true;
				matches++;
				break;
			}
		}
	}
	if (!matches) return 0;
	let t = 0, k = 0;
	for (let i = 0; i < l1; i++) {
		if (!s1m[i]) continue;
		while (!s2m[k]) k++;
		if (s1[i] !== s2[k]) t++;
		k++;
	}
	t /= 2;
	return ((matches / l1) + (matches / l2) + ((matches - t) / matches)) / 3;
}

function jaroWinkler(s1, s2, p = 0.1) {
	const j = jaro(s1, s2);
	let pref = 0, maxPref = 4;
	while (pref < maxPref && s1[pref] === s2[pref]) pref++;
	return j + pref * p * (1 - j);
}

/**
 * Parse a duration string like "1h30m", "90m", "1.5h", "2d 3h", etc.
 * Supported units:
 *   w = weeks (7d)
 *   d = days
 *   h = hours
 *   m = minutes
 *   s = seconds
 *
 * Returns total seconds (integer), or NaN if invalid.
 */
export function parseDuration(str) {
	const s = str.trim().toLowerCase().replace(/\s+/g, '');

	// bare number → seconds
	if (/^\d+(?:\.\d+)?$/.test(s)) {
		return Math.round(parseFloat(s));
	}

	if (!s) return NaN;
	const regex = /(\d+(?:\.\d+)?)([wdhms])/g;
	let match, total = 0, consumed = 0;
	while ((match = regex.exec(s)) !== null) {
		const [chunk, numStr, unit] = match;
		const num = parseFloat(numStr);
		if (isNaN(num)) return NaN;
		consumed += chunk.length;
		switch (unit) {
			case 'w': total += num * 7 * 24 * 3600; break;
			case 'd': total += num * 24 * 3600; break;
			case 'h': total += num * 3600; break;
			case 'm': total += num * 60; break;
			case 's': total += num; break;
			default: return NaN;
		}
	}
	return consumed === s.length ? Math.round(total) : NaN;
}

/**
 * Format an integer number of seconds into a compact shorthand:
 * e.g. 90061 → "1d1h1m1s", or "90m" if only minutes.
 */
export function formatDuration(seconds) {
	let s = Number(seconds) || 0;
	const parts = [];
	const units = [
		['w', 7 * 24 * 3600],
		['d', 24 * 3600],
		['h', 3600],
		['m', 60],
		['s', 1],
	];
	for (const [suffix, count] of units) {
		const v = Math.floor(s / count);
		if (v > 0) {
			parts.push(v + suffix);
			s -= v * count;
		}
	}
	return parts.length ? parts.join('') : '0s';
}
