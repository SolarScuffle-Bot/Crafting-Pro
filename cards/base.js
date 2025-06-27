// src/cards/base.js

import * as Image from '../image.js';
import * as Theme from '../theme.js';

/** Header lightness (0–1) */
export const HEADER_L = 0.90;
/** Body lightness (0–1) */
export const BODY_L = 0.94;

/**
 * Apply a hue/saturation tint to header & body, preserving lightness.
 * @param {string} src
 * @param {HTMLElement} headerEl
 * @param {HTMLElement} bodyEl
 */
export const applyTint = (src, headerEl, bodyEl) => {
	const headerL = Theme.getTheme() == 'light' ? HEADER_L : 1 - 0.8 * HEADER_L;
	const bodyL = Theme.getTheme() == 'light' ? BODY_L : 1 - 0.8 * BODY_L;
	const sat = Theme.getTheme() == 'light' ? 1 : 0.5

	Image.getAverageColor(src)
		.then(({ h, s }) => {
			headerEl.style.backgroundColor = `hsl(${h}, ${s * sat}%, ${headerL * 100}%)`;
			bodyEl.style.backgroundColor = `hsl(${h}, ${s * sat}%, ${bodyL * 100}%)`;
		})
		.catch(() => {/* ignore */ });
};

/**
 * Show a confirm‐delete dialog when an item is used in recipes.
 * @param {string} itemName
 * @param {number} usageCount
 * @returns {Promise<'removeReferences'|'deleteRecipes'|'cancel'>}
 */
export const confirmItemDeletion = (itemName, usageCount) =>
	new Promise(resolve => {
		const overlay = document.createElement('div');
		Object.assign(overlay.style, {
			position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
			background: 'rgba(0,0,0,0.5)', display: 'flex',
			alignItems: 'center', justifyContent: 'center', zIndex: 9999
		});

		const dialog = document.createElement('div');
		Object.assign(dialog.style, {
			background: '#fff', padding: '20px',
			borderRadius: '6px', textAlign: 'center',
			maxWidth: '300px'
		});

		const msg = document.createElement('p');
		msg.textContent = `“${itemName}” is used in ${usageCount} recipe(s).`;
		dialog.appendChild(msg);

		const makeBtn = (text, action) => {
			const btn = document.createElement('button');
			btn.textContent = text;
			btn.style.margin = '0 5px';
			btn.addEventListener('click', () => {
				resolve(action);
				document.body.removeChild(overlay);
			});
			return btn;
		};

		dialog.appendChild(makeBtn('Remove from Recipes', 'removeReferences'));
		dialog.appendChild(makeBtn('Delete Recipes', 'deleteRecipes'));
		dialog.appendChild(makeBtn('Cancel', 'cancel'));

		overlay.appendChild(dialog);
		document.body.appendChild(overlay);
	});

import * as Utils from '../utils.js';  // for duplicate‐checking

/**
 * Bump “Foo” → “Foo 2” → “Foo 3”… avoiding name collisions.
 * @param {string} originalName
 * @returns {string}
 */
export const getUniqueCloneName = originalName => {
	const [, base, num] = originalName.match(/^(.*?)(?: (\d+))?$/) || [];
	let version = num ? Number(num) + 1 : 2;
	let candidate = `${base} ${version}`;
	while (Utils.itemExistsAlready(candidate)) {
		candidate = `${base} ${++version}`;
	}
	return candidate;
};