// src/data.js

// —————————————————————————————————————————————————————
// In‐memory store
// —————————————————————————————————————————————————————

/** @type {{ [id: string]: { id: string; name: string; icon: string; desc: string; lastMaximized: number } }} */
const items = {};

/** @type {{ [id: string]: { id: string; inputs: Array<{ id: string; qty: number }>; outputs: Array<{ id: string; qty: number }>; duration: number; reversible: boolean } }} */
const recipes = {};

// —————————————————————————————————————————————————————
// Simple event emitter
// —————————————————————————————————————————————————————

/** @type {{ [event: string]: Function[] }} */
const listeners = {};

/**
 * Subscribe to a data event.
 *
 * @param {'dataReset'|'itemAdded'|'itemChanged'|'itemDeleted'|
 *         'recipeAdded'|'recipeDeleted'|
 *         `recipe:${string}Changed`|'recipe:slotsStructureChanged'|
 *         'recipe:slotChanged'} event
 * @param {Function} fn Callback to invoke when the event fires.
 */
export function on(event, fn) {
	(listeners[event] ||= []).push(fn);
}

/**
 * Unsubscribe a callback from a data event.
 *
 * @param {string} event
 * @param {Function} fn The function to remove.
 */
export function off(event, fn) {
	if (!listeners[event]) return;
	listeners[event] = listeners[event].filter(x => x !== fn);
}

/**
 * Emit a data event to all registered listeners.
 *
 * @param {string} event
 * @param {...any} args Arguments passed through to each listener.
 * @private
 */
function emit(event, ...args) {
	(listeners[event] || []).forEach(fn => fn(...args));
}

// —————————————————————————————————————————————————————
// Persistence
// —————————————————————————————————————————————————————

/**
 * Load persisted items and recipes from localStorage into memory.
 * Fires the `'dataReset'` event when complete.
 */
export function loadData() {
	const raw = localStorage.getItem('craftingData');
	if (raw) {
		const parsed = JSON.parse(raw);
		// clear & repopulate items
		for (const k in items) delete items[k];
		for (const k in parsed.items || {}) items[k] = parsed.items[k];
		// clear & repopulate recipes
		for (const k in recipes) delete recipes[k];
		for (const k in parsed.recipes || {}) recipes[k] = parsed.recipes[k];
	}
	emit('dataReset');
}

/**
 * Clear all data from memory and localStorage.
 * Fires the `'dataReset'` event when complete.
 */
export function resetData() {
	localStorage.removeItem('craftingData');
	for (const k in items) delete items[k];
	for (const k in recipes) delete recipes[k];
	emit('dataReset');
}

/**
 * Save the current in-memory items and recipes to localStorage.
 * @private
 */
function saveData() {
	localStorage.setItem(
		'craftingData',
		JSON.stringify({ items, recipes })
	);
}

// —————————————————————————————————————————————————————
// Item API
// —————————————————————————————————————————————————————

/**
 * Create a new item.
 *
 * @param {string} name The item's display name.
 * @param {string} [icon=''] URL string or key for an icon.
 * @param {string} [desc=''] A description of the item.
 * @returns {string} The newly generated item ID.
 */
export function addItem(name, icon = '', desc = '') {
	const id = crypto.randomUUID();
	items[id] = { id, name, icon, desc, lastMaximized: 0 };
	saveData();
	emit('itemAdded', id);
	return id;
}

/**
 * Update a field on an existing item.
 *
 * @param {string} id The item ID.
 * @param {'name'|'icon'|'desc'|'lastMaximized'} field
 * @param {any} value The new value for that field.
 */
export function updateItem(id, field, value) {
	items[id][field] = value;
	saveData();
	emit('itemChanged', id);
}

/**
 * Delete an item by ID.
 * Also removes references from all recipes.
 *
 * @param {string} id The ID of the item to delete.
 */
export function deleteItem(id) {
	delete items[id];
	// purge from every recipe
	for (const rid in recipes) {
		['inputs', 'outputs'].forEach(side => {
			recipes[rid][side] = recipes[rid][side].filter(s => s.id !== id);
		});
		emit('recipeChanged', rid);
	}
	saveData();
	emit('itemDeleted', id);
}

/**
 * Retrieve an item object by ID.
 *
 * @param {string} id
 * @returns {{ id: string; name: string; icon: string; desc: string; lastMaximized: number }|undefined}
 */
export function getItem(id) {
	return items[id];
}

/** Expose the full in-memory items map. */
export { items };

// —————————————————————————————————————————————————————
// Recipe API
// —————————————————————————————————————————————————————

/**
 * Create a new recipe, seeded with one empty input and one empty output.
 *
 * @returns {string} The newly generated recipe ID.
 */
export function addRecipe() {
	const id = crypto.randomUUID();
	recipes[id] = {
		id,
		inputs: [{ id: '', qty: 1 }],
		outputs: [{ id: '', qty: 1 }],
		duration: 0,
		reversible: false,
	};
	saveData();
	emit('recipeAdded', id);
	return id;
}

/**
 * Update a field on an existing recipe.
 *
 * @param {string} id The recipe ID.
 * @param {'duration'|'reversible'} field
 * @param {any} value The new value for that field.
 */
export function updateRecipe(id, field, value) {
	recipes[id][field] = value;
	saveData();
	emit(`recipe:${field}Changed`, id, value);
}

/**
 * Delete a recipe by ID.
 *
 * @param {string} id The recipe to delete.
 */
export function deleteRecipe(id) {
	delete recipes[id];
	saveData();
	emit('recipeDeleted', id);
}

/**
 * Add a new empty slot to a recipe's inputs or outputs.
 *
 * @param {string} id The recipe ID.
 * @param {'inputs'|'outputs'} side
 */
export function addRecipeSlot(id, side) {
	recipes[id][side].push({ id: '', qty: 1 });
	saveData();
	emit('recipe:slotsStructureChanged', id);
}

/**
 * Remove a slot at index `idx` from a recipe's inputs or outputs.
 *
 * @param {string} id The recipe ID.
 * @param {'inputs'|'outputs'} side
 * @param {number} idx Zero-based index of the slot to remove.
 */
export function removeRecipeSlot(id, side, idx) {
	const slots = recipes[id][side];
	slots.splice(idx, 1);
	// if we just removed the last slot, re-add a blank one
	if (slots.length === 0) {
		slots.push({ id: '', qty: 1 });
	}

	saveData();
	emit('recipe:slotsStructureChanged', id);
}

/**
 * Update a specific slot's field in a recipe.
 *
 * @param {string} id The recipe ID.
 * @param {'inputs'|'outputs'} side
 * @param {number} idx Zero-based slot index.
 * @param {'id'|'qty'} field
 * @param {any} value New value for that slot field.
 */
export function updateRecipeSlot(id, side, idx, field, value) {
	recipes[id][side][idx][field] = value;
	saveData();
	emit('recipe:slotChanged', id, side, idx, field, value);
}

/**
 * Retrieve a recipe object by ID.
 *
 * @param {string} id
 * @returns {{ id: string; inputs: Array<{ id: string; qty: number }>; outputs: Array<{ id: string; qty: number }>; duration: number; reversible: boolean }|undefined}
 */
export function getRecipe(id) {
	return recipes[id];
}

/** @constant {number} Current on-disk format version */
const DATA_VERSION = 1;

/**
 * Dump the entire store as a versioned JSON object.
 * @returns {{ version: number; items: Record<string, any>; recipes: Record<string, any> }}
 */
export function exportData() {
	// shallow‐copy so consumers can mutate the result without side‐effects
	return {
		version: DATA_VERSION,
		items: { ...items },
		recipes: { ...recipes },
	};
}

/**
 * Import from a versioned JSON object, replacing all current data.
 * Supports future migrations by branching on `data.version`.
 *
 * @param {{ version?: number; items: Record<string, any>; recipes: Record<string, any> }} data
 */
export function importData(data) {
	if (!data.items || !data.recipes) {
		alert('Import JSON must include both `items` and `recipes`');
		return;
	}

	const ver = data.version || 1;

	if (ver === 1) {
		// clear & repopulate items
		for (const k in items) delete items[k];
		for (const [id, obj] of Object.entries(data.items || {})) {
			items[id] = obj;
		}

		// clear & repopulate recipes
		for (const k in recipes) delete recipes[k];
		for (const [id, obj] of Object.entries(data.recipes || {})) {
			recipes[id] = obj;
		}

	} else {
		throw new Error(`Unsupported data version: ${ver}`);
	}

	// persist & notify listeners
	saveData();
	emit('dataReset');
}

/** Expose the full in-memory recipes map. */
export { recipes };
