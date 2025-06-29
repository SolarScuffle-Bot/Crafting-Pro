// src/cards/base.js

import * as Image from '../image.js';
import * as Theme from '../theme.js';
import * as Data from '../data.js';
import * as Utils from '../utils.js';  // for duplicate‐checking

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
 * @param {string} itemId
 * @param {number} usageCount
 * @returns {Promise<'removeReferences'|'deleteRecipes'|'cancel'>}
 */
export const confirmItemDeletion = (itemId, usageCount) => {
	const itemName = Data.getItem(itemId).name;

	return new Promise(resolve => {
		const overlay = document.createElement('div');
		Object.assign(overlay.style, {
			position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
			background: 'rgba(0,0,0,0.5)', display: 'flex',
			alignItems: 'center', justifyContent: 'center', zIndex: 9999
		});

		const dialog = document.createElement('div');
		Object.assign(dialog.style, {
			background: 'var(--bg-body)', padding: '20px',
			textAlign: 'center', color: 'var(--text-primary)',
			maxWidth: '300px'
		});

		const msg = document.createElement('p');
		msg.textContent = `“${itemName}” is used in ${usageCount} recipe(s).`;
		dialog.appendChild(msg);

		const makeBtn = (text, action, callback) => {
			const btn = document.createElement('button');
			btn.textContent = text;
			btn.style.margin = '5px 5px';
			btn.classList.add('header-button');
			btn.addEventListener('click', e => {
				callback(e);
				resolve(action);
				document.body.removeChild(overlay);
			});
			dialog.appendChild(btn);
			return btn;
		};

		const removeBtn = makeBtn('Remove from Recipes', 'removeReferences', e => {
			console.log(Data.recipes,'\n',itemId)
			for (const [recipeId, recipe] of Object.entries(Data.recipes)) {
				['inputs', 'outputs'].forEach(side => {
					recipe[side].forEach((io, idx) => {
						console.log(io.id)
						if (io.id === itemId) {
							Data.removeRecipeSlot(recipeId, side, idx);
						}
					})
				})

			}
		});

		//TODO: FIGURE OUT THIS RACE CONDITION AND FIX IT

		const deleteBtn = makeBtn('Delete Recipes', 'deleteRecipes', e => {
			console.log(Data.recipes)
			for (const [recipeId, recipe] of Object.entries(Data.recipes)) {
				['inputs', 'outputs'].forEach(side => {
					recipe[side].forEach((io, idx) => {
						if (io.id === itemId) {
							Data.deleteRecipe(recipeId);
							return;
						}
					})
				})

			}
		});

		const cancelBtn = makeBtn('Cancel', 'cancel', () => {});

		overlay.appendChild(dialog);
		document.body.appendChild(overlay);
	});
}

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