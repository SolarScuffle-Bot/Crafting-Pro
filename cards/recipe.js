// src/cards/recipe.js

import * as Data from '../data.js';
import * as Image from '../image.js';
import * as IDB from '../idb.js';
import * as Base from "./base.js";
import * as Controls from "../controls.js";
import * as Utils from '../utils.js';

// Grab the “+ Recipe” button once
const addRecipeBtn = document.getElementById('add-recipe');

// Returns true if this recipe meets all your “no‐invalid‐field” rules.
function isRecipeValid(recipe) {
	// 1) Every slot must have a non‐empty item‐id…
	for (const side of ['inputs', 'outputs']) {
		for (const slot of recipe[side]) {
			if (!slot.id) return false;
			if (typeof slot.qty !== 'number' || slot.qty < 1) return false;
		}
	}

	// 2) Duration must be a non‐negative number
	if (typeof recipe.duration !== 'number' || recipe.duration < 0) {
		return false;
	}

	return true;
}

export function refreshAddRecipeButton() {
	// scan every recipe in the model
	const anyInvalid = Object.values(Data.recipes).some(r => !isRecipeValid(r));
	addRecipeBtn.disabled = anyInvalid;
}

export function renderRecipeCard(recipe) {
	const html = `
    <div class="overlay-btn-holder">
      <button data-action="clone">Clone</button>
      <button class="delete-btn" data-action="delete" aria-label="Delete recipe">×</button>
    </div>
    <div class="recipe-body">
      <div class="recipe-inputs io-section"></div>
      <div class="recipe-middle">
        <div class="recipe-reversible">
          <label class="recipe-label">Direction</label>
          <button type="button" class="reversible-btn">${recipe.reversible ? '↕' : '↓'}</button>
        </div>
        <div class="recipe-duration">
          <input type="text" class="edit-duration input-style" data-field="duration"
                 placeholder="e.g. 90m, 1h30m"
                 value="${Utils.formatDuration(recipe.duration)}">
          <label>Duration</label>
        </div>
      </div>
      <div class="recipe-outputs io-section"></div>
    </div>
  `.trim();

	const card = document.createElement('div');
	card.className = 'recipe-card';
	card.dataset.id = recipe.id;
	card.innerHTML = html;
	document.getElementById('recipes-ul').prepend(card);

	buildGrid(card, recipe, 'inputs');
	buildGrid(card, recipe, 'outputs');
	setup(card);
}

export function removeRecipeCard(id) {
	const c = document.querySelector(`.recipe-card[data-id="${id}"]`);
	if (c) c.remove();
}

export function updateRecipeCard(id) {
	const recipe = Data.getRecipe(id);
	const card = document.querySelector(`.recipe-card[data-id="${id}"]`);
	if (!card) return;

	// 1) normalize the duration text
	const durIn = card.querySelector('.edit-duration');
	durIn.value = Utils.formatDuration(recipe.duration);

	// 2) reversible button + class
	const revBtn = card.querySelector('.reversible-btn');
	revBtn.innerText = recipe.reversible ? '↕' : '↓';
	card.classList.toggle('reversible', recipe.reversible);

	// 3) rebuild I/O only on structural/global changes
	buildGrid(card, recipe, 'inputs');
	buildGrid(card, recipe, 'outputs');

	Controls.applyRecipeSort();
}

// helper to update a single slot without losing focus
export function updateRecipeSlot(id, side, idx, field, value) {
	const card = document.querySelector(`.recipe-card[data-id="${id}"]`);
	if (!card) return;
	const cell = card.querySelector(`.recipe-${side} .io-cell[data-index="${idx}"]`);
	if (!cell) return;

	if (field === 'slot-id') {
		const input = cell.querySelector('.item-name');
		input.value = Data.getItem(value)?.name || '';
		const imgEl = cell.querySelector('.item-pic');
		const item = value ? Data.getItem(value) : undefined;
		applyIconUpdate(imgEl, item, cell);
	}

	if (field === 'slot-qty') {
		const input = cell.querySelector('.item-qty');
		input.value = value;
	}
}

function buildGrid(card, recipe, side) {
	const container = card.querySelector(`.recipe-${side}`);
	const placeholder = Image.PLACEHOLDER;
	container.innerHTML = '';

	// Render each slot…
	recipe[side].forEach((slot, idx) => {
		const cell = document.createElement('div');
		cell.className = `io-cell ${side}-cell`;
		cell.dataset.index = idx;

		// 1) item-wrapper
		const wrapper = document.createElement('div');
		wrapper.className = 'item-wrapper';

		// a) the icon
		const imgEl = document.createElement('img');
		imgEl.className = 'item-pic';
		imgEl.width = 32;
		imgEl.height = 32;
		imgEl.src = placeholder;
		imgEl.alt = '';
		imgEl.title = '';
		wrapper.appendChild(imgEl);

		// b) only show delete overlay if there's more than one slot
		if (recipe[side].length > 1) {
			const overlay = document.createElement('div');
			overlay.className = 'overlay-btn-holder';
			overlay.innerHTML = `<button class="delete-btn" data-action="del-slot">×</button>`;
			wrapper.appendChild(overlay);
		}

		// c) the inputs
		const inputsDiv = document.createElement('div');
		inputsDiv.className = 'data-inputs';
		inputsDiv.innerHTML = `
      <input type="text" class="item-name input-style" data-field="slot-id"
             placeholder="Name…" list="item-list"
             value="${slot.id ? (Data.getItem(slot.id)?.name || '') : ''}">
      <input type="number" class="item-qty input-style" data-field="slot-qty"
             min="1" value="${slot.qty}">
    `.trim();
		wrapper.appendChild(inputsDiv);

		cell.appendChild(wrapper);
		container.append(cell);

		// flag empty IDs immediately
		const nameIn = wrapper.querySelector('.item-name');
		if (!slot.id) {
			nameIn.classList.add('invalid');
		}

		// load icon if slot.id exists
		if (slot.id) {
			const item = Data.getItem(slot.id);
			applyIconUpdate(imgEl, item, cell);
		} else {
			applyIconUpdate(imgEl, undefined, cell)
		}
	});

	// The “+” add-cell
	const add = document.createElement('div');
	add.className = 'io-cell add-cell';
	add.innerHTML = `<button data-action="add-slot">+</button>`;
	container.append(add);

	// Only show “+” when every real slot has a valid ID
	const realSlots = recipe[side];
	if (realSlots.length > 0 && realSlots.every(s => s.id)) {
		add.style.display = '';
	} else {
		add.style.display = 'none';
	}
}

function setup(card) {
	const recipeId = card.dataset.id;
	const recipe = Data.getRecipe(recipeId);

	// DURATION
	const durIn = card.querySelector('.edit-duration');
	durIn.addEventListener('input', e => {
		const secs = Utils.parseDuration(e.target.value);
		e.target.classList.toggle('invalid', isNaN(secs) || secs < 0);
	});
	durIn.addEventListener('blur', e => {
		let secs = Utils.parseDuration(e.target.value);
		if (isNaN(secs) || secs < 0) secs = 0;
		Data.updateRecipe(recipeId, 'duration', secs);
		e.target.classList.remove('invalid');
		e.target.value = Utils.formatDuration(secs);
	});

	// Sync icons when items change
	const onAnyItem = changedItemId => {
		const item = Data.getItem(changedItemId);
		['inputs', 'outputs'].forEach(side => {
			recipe[side].forEach((slot, idx) => {
				const cell = card.querySelector(
					`.recipe-${side} .io-cell[data-index="${idx}"]`
				);
				if (!cell) return;

				const nameIn = cell.querySelector('.item-name');
				const imgEl = cell.querySelector('.item-pic');
				const raw = nameIn.value.trim();

				// 1) If this slot already pointed at that item, just refresh its UI:
				if (slot.id === changedItemId) {
					// update the name (in case it was renamed)
					nameIn.value = item.name;
					// update the icon + tooltip
					applyIconUpdate(imgEl, item, cell);
				}
				// 2) Else if slot.id is empty but the user-typed name now matches,
				//    promote this slot to that item:
				else if (!slot.id && raw === item.name) {
					// update the model
					Data.updateRecipeSlot(recipeId, side, idx, 'id', changedItemId);
					// clear the “invalid” outline
					nameIn.classList.remove('invalid');
					// render the icon
					applyIconUpdate(imgEl, item, cell);
				}
			});
		});
	};

	// subscribe for both new items and renames
	Data.on('itemAdded', onAnyItem);
	Data.on('itemChanged', onAnyItem);
	window.addEventListener("themeChange", e => {
		updateRecipeCard(recipeId);
	})

	// reversible toggle
	card.querySelector('.reversible-btn').addEventListener('click', () => {
		Data.updateRecipe(recipeId, 'reversible', !recipe.reversible);
	});

	// delete & clone
	card.querySelector('[data-action="delete"]').addEventListener('click', e => {
		e.stopPropagation();
		Data.deleteRecipe(recipeId);
	});
	card.querySelector('[data-action="clone"]').addEventListener('click', e => {
		e.stopPropagation();
		const newId = Data.addRecipe();
		const src = Data.getRecipe(recipeId);
		Object.assign(Data.getRecipe(newId), {
			inputs: new Array(src.inputs),
			outputs: new Array(src.outputs),
			duration: src.duration,
			reversible: src.reversible
		});
		Data.updateRecipe(newId, 'duration', src.duration);
	});

	// I/O delegation
	['inputs', 'outputs'].forEach(side => {
		const section = card.querySelector(`.recipe-${side}`);
		section.addEventListener('click', e => {
			const action = e.target.dataset.action;
			if (!action) return;

			e.stopPropagation();
			const idx = +e.target.closest('.io-cell').dataset.index;

			if (action === 'add-slot') {
				Data.addRecipeSlot(recipeId, side);
			}
			if (action === 'del-slot') {
				Data.removeRecipeSlot(recipeId, side, idx);
			}
		});

		section.addEventListener('input', e => {
			const cell = e.target.closest('.io-cell');
			const idx = +cell.dataset.index;
			const field = e.target.dataset.field;

			// slot-id
			if (field === 'slot-id') {
				const nm = e.target.value.trim();
				const found = Object.values(Data.items).find(i => i.name === nm);
				e.target.classList.toggle('invalid', !nm || !found);
				Data.updateRecipeSlot(recipeId, side, idx, 'id', found?.id || '');
				// update icon…
				const imgEl = cell.querySelector('.item-pic');
				applyIconUpdate(imgEl, found, cell);
			}

			// re-show or hide the “+”
			const addCell = section.querySelector('.add-cell');
			const slots = Data.getRecipe(recipeId)[side];
			addCell.style.display = slots.every(s => s.id) ? '' : 'none';

			// slot-qty
			if (field === 'slot-qty') {
				let v = parseFloat(e.target.value, 10);
				if (isNaN(v) || v < 1 || v !== Math.floor(v)) {
					e.target.classList.add('invalid');
				} else {
					e.target.classList.remove('invalid');
					Data.updateRecipeSlot(recipeId, side, idx, 'qty', v);
				}
			}
		});

		section.querySelectorAll('.item-qty').forEach(input => {
			input.addEventListener('blur', e => {
				if (input === e.target) {
					const cell = e.target.closest('.io-cell');
					const idx = +cell.dataset.index;

					e.target.classList.remove('invalid');

					let v = parseFloat(e.target.value, 10);
					if (isNaN(v) || v < 1 || v !== Math.floor(v)) {
						e.target.value = Data.getRecipe(recipeId)[side][idx].qty;
					}
				}
			})
		})
	});
}

function applyIconUpdate(imgEl, item, cell) {
	if (item) {
		Image.resolveIconSrc(item, IDB.getBlobURL)
			.then(src => {
				imgEl.src = src;
				imgEl.alt = item.name;
				imgEl.title = item.desc || '';
				Base.applyTint(src, cell, cell);
			})
			.catch(() => {
				imgEl.src = Image.PLACEHOLDER;
				Base.applyTint(Image.PLACEHOLDER, cell, cell);
			});
	} else {
		imgEl.src = Image.PLACEHOLDER;
		imgEl.alt = '';
		imgEl.title = '';
		Base.applyTint(Image.PLACEHOLDER, cell, cell);
	}
}