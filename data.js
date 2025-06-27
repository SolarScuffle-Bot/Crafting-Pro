// src/data.js

/**
 * @typedef {Object} ItemData
 * @property {string} id
 * @property {string} name
 * @property {string} [icon]
 * @property {string} [iconKey]
 * @property {number} lastMaximized
 * @property {string} desc
 */

/**
 * @typedef {Object} RecipeIO
 * @property {string} id      Unique ItemData id (empty string if not yet selected)
 * @property {number} qty     Quantity of that item (integer ≥ 1)
 */

/**
 * @typedef {Object} RecipeData
 * @property {string}       id           Unique recipe identifier
 * @property {RecipeIO[]}   inputs       Array of input slots for this recipe
 * @property {RecipeIO[]}   outputs      Array of output slots for this recipe
 * @property {number}       duration     Processing time in seconds
 * @property {boolean}      reversible   If true, recipe can run in reverse (double‐headed arrow)
 */

/**
 * @typedef {Object} CraftingData
 * @property {Record<string, ItemData>}   items
 * @property {Record<string, RecipeData>} recipes
 */

/** @type {CraftingData} */
export let craftingData = {
	items: {},
	recipes: {}
};

/**
 * Load `craftingData` from localStorage or initialize fresh.
 * @returns {void}
 */
export const loadData = () => {
	const raw = localStorage.getItem('craftingData')
		|| JSON.stringify(craftingData);
	craftingData = /** @type {CraftingData} */ (
		JSON.parse(raw)
	);
};

/**
 * Persist current `craftingData` to localStorage.
 * @returns {void}
 */
export const saveData = () => {
	localStorage.setItem(
		'craftingData',
		JSON.stringify(craftingData)
	);
};

/**
 * Reset everything: clear storage and re-init in-memory.
 * @returns {void}
 */
export const resetData = () => {
	localStorage.removeItem('craftingData');
	craftingData = {
		items: {},
		recipes: {}
	};
};

// TODO: wire up fuzzy search and graph render.
