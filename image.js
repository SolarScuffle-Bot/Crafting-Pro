// src/image.js

/**
 * Default placeholder for missing or invalid icons.
 * @type {string}
 */
export const PLACEHOLDER = 'placeholder.webp';

/**
 * Rough check: is this string a finished HTTP(S) URL?
 * Must parse, use http(s), and have at least one non-leading/trailing dot in the host.
 * @param {string} s
 * @returns {boolean}
 */
export function isLikelyReadyUrl(s) {
	try {
		const u = new URL(s);
		if (!['http:', 'https:'].includes(u.protocol)) return false;
		const host = u.hostname;
		return host.includes('.') && !host.startsWith('.') && !host.endsWith('.');
	} catch {
		return false;
	}
}

/**
 * Try to load an image off-screen.
 * Resolves on load, rejects on error.
 * @param {string} url
 * @returns {Promise<void>}
 */
export function preloadImage(url) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve();
		img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
		img.src = url;
	});
}

/**
 * Load a File into an HTMLImageElement via ObjectURL.
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(file) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Image load failed'));
		};
		img.src = url;
	});
}

/**
 * Draw an HTMLImageElement into a 32×32 canvas and return a PNG Blob.
 * @param {HTMLImageElement} img
 * @returns {Promise<Blob>}
 */
export function resizeTo32(img) {
	const canvas = document.createElement('canvas');
	canvas.width = 32;
	canvas.height = 32;
	const ctx = canvas.getContext('2d');
	ctx.drawImage(img, 0, 0, 32, 32);
	return new Promise((resolve, reject) => {
		canvas.toBlob(blob => {
			if (blob) resolve(blob);
			else reject(new Error('Canvas toBlob failed'));
		}, 'image/png');
	});
}

/**
 * Given a File, load it, down-scale to 32×32, and return a PNG Blob.
 * @param {File} file
 * @returns {Promise<Blob>}
 */
export async function resizeImage(file) {
	const img = await loadImage(file);
	return await resizeTo32(img);
}

/**
 * Given an item with optional `.icon` URL and optional `.iconKey`,
 * resolve to an actual image URL string:
 *   • if `item.icon` is present and preloads, return it
 *   • else if `item.iconKey` is present, call `getBlobURL(key)` and
 *     if that preloads, return it
 *   • else return the `PLACEHOLDER`
 *
 * **Does not** mutate the item—purely returns a string.
 *
 * @param {{ icon?: string, iconKey?: string }} item
 * @param {(key: string) => Promise<string>} getBlobURL
 * @returns {Promise<string>}
 */
export async function resolveIconSrc(item, getBlobURL) {
	if (item.icon) {
		try {
			await preloadImage(item.icon);
			return item.icon;
		} catch {
			// just fall through to blobKey or placeholder
		}
	}

	if (item.iconKey) {
		try {
			const blobUrl = await getBlobURL(item.iconKey);
			await preloadImage(blobUrl);
			return blobUrl;
		} catch {
			// fall through
		}
	}

	return PLACEHOLDER;
}

/**
 * Load an image URL into an off-screen canvas and compute its average RGB + HSL.
 * @param {string} src – URL or data-URL of the image.
 * @returns {Promise<{r:number, g:number, b:number, h:number, s:number, l:number}>}
 */
export const getAverageColor = src =>
	new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {
			const size = 32;
			const canvas = document.createElement('canvas');
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0, size, size);

			const data = ctx.getImageData(0, 0, size, size).data;
			let r = 0, g = 0, b = 0, count = 0;
			for (let i = 0; i < data.length; i += 4) {
				r += data[i];
				g += data[i + 1];
				b += data[i + 2];
				count++;
			}
			r /= count; g /= count; b /= count;

			const [h, s, l] = rgbToHsl(r, g, b);
			resolve({ r, g, b, h, s: s * 100, l });
		};
		img.onerror = () => reject(new Error(`Failed to load image for color sampling: ${src}`));
		img.src = src;
	});

/**
 * Convert RGB [0–255] to HSL [h:0–360, s:0–1, l:0–1].
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {[number, number, number]}
 */
export const rgbToHsl = (r, g, b) => {
	r /= 255; g /= 255; b /= 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	let h = 0, s = 0, l = (max + min) / 2;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}
		h *= 60;
	}
	return [h, s, l];
};
