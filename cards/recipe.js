// src/cards/recipe.js

import * as Data from '../data.js';
import * as Base from './base.js';
import * as Utils from '../utils.js';
import * as Images from '../image.js';

/**
 * Render one recipe card into #recipes-ul:
 *   • Inputs on the left
 *   • Duration + Reversible in the middle
 *   • Outputs on the right
 */
export function renderRecipeCard(recipe) {
	const card = document.createElement('div');
	card.className = 'recipe-card';
	card.dataset.id = recipe.id;

	// HEADER
	card.innerHTML = `
	<div class="overlay-btn-holder">
		<button class="clone-btn">Clone</button>
		<button class="delete-btn" aria-label="Delete recipe">×</button>
	</div>
    <div class="recipe-body">
      <div class="recipe-inputs io-section"></div>
      <div class="recipe-middle">
        <div class="recipe-duration">
          <span class="arrow">↓</span>
          <input type="number" class="edit-duration" min="0" value="${recipe.duration}">
          <span class="duration-unit">s</span>
        </div>
        <label class="recipe-reversible">
          <input type="checkbox" class="edit-reversible" ${recipe.reversible ? 'checked' : ''}>
          Reversible
        </label>
      </div>
      <div class="recipe-outputs io-section"></div>
    </div>
  `;
	document.getElementById('recipes-ul').prepend(card);

	// Build the two grids
	buildGrid(card, recipe, 'inputs');
	buildGrid(card, recipe, 'outputs');

	setupRecipeCard(card);
	return card;
}

/**
 * Fill either the .recipe-inputs or .recipe-outputs section
 */
function buildGrid(card, recipe, side) {
	const container = card.querySelector(`.recipe-${side}`);
	const slots = recipe[side];

	// Clear & add each real slot
	container.innerHTML = '';
	slots.forEach((slot, idx) => {
		const found = Data.craftingData.items[slot.id];

		const div = document.createElement('div');
		div.className = `io-cell ${side}-cell`;
		div.dataset.index = idx;
		div.innerHTML = `
      <div class="item-wrapper">
        <img class="item-pic" width="32" height="32"
             src="${found?.icon || Images.PLACEHOLDER}"
             alt="${found?.name || 'Placeholder'}"
			 title = "${found?.desc || ''}">
		<div class="overlay-btn-holder">
			<button class="delete-btn" aria-label="Remove">×</button>
		</div>
		<div class="data-inputs">
			<input type="text" class="item-name input-style"
				placeholder="Name…" list="item-list" required
				value="${found?.name || ''}">
			<input type="number" class="item-qty input-style" min="1" required value="${slot.qty}" ria-label="Quantity (must be at least 1)">
		</div>
      </div>
    `;
		container.append(div);
	});

	// Add the ghost “+” cell
	const add = document.createElement('div');
	add.className = 'io-cell add-cell';
	add.innerHTML = `<button class="add-btn" aria-label="Add ${side.slice(0, -1)}">+</button>`;
	container.append(add);
}

/**
 * Wire up all the event handling in one sweep.
 */
function setupRecipeCard(card) {
	const id = card.dataset.id;
	const recipe = Data.craftingData.recipes[id];
	const arrow = card.querySelector('.arrow');

	// DURATION
	card.querySelector('.edit-duration').addEventListener('input', e => {
		recipe.duration = parseInt(e.target.value, 10) || 0;
		Data.saveData();
	});

	// REVERSIBLE
	card.querySelector('.edit-reversible').addEventListener('change', e => {
		recipe.reversible = e.target.checked;
		card.classList.toggle('reversible', e.target.checked);
		arrow.innerText = e.target.checked ? '↕' : '↓';
		Data.saveData();
	});

	// CLONE
	card.querySelector('.clone-btn').addEventListener('click', e => {
		const newId = Utils.generateId();
		const copy = { ...recipe, id: newId, name: recipe.name + ' Copy' };
		Data.craftingData.recipes[newId] = copy;
		Data.saveData();
		renderRecipeCard(copy);
	});

	// DELETE
	card.querySelector('.delete-btn').addEventListener('click', e => {
		delete Data.craftingData.recipes[id];
		Data.saveData();
		card.remove();
	});

	// I/O SECTION (inputs & outputs share identical behavior)
	card.querySelectorAll('.io-section').forEach(section => {
		const side = section.classList.contains('recipe-inputs') ? 'inputs' : 'outputs';

		// ADD / DELETE buttons
		section.addEventListener('click', e => {
			if (e.target.matches('.add-btn')) {
				e.stopPropagation();
				recipe[side].push({ id: '', qty: 1 });
				Data.saveData();
				buildGrid(card, recipe, side);
			}
			if (e.target.matches('.delete-btn')) {
				e.stopPropagation();
				const idx = +e.target.closest('.io-cell').dataset.index;
				recipe[side].splice(idx, 1);
				Data.saveData();
				buildGrid(card, recipe, side);
			}
		});

		// NAME / QTY inputs
		section.addEventListener('input', e => {
			const cell = e.target.closest('.io-cell');
			const pic = cell.querySelector('.item-pic');
			const idx = +cell.dataset.index;

			if (e.target.matches('.item-name')) {
				const name = e.target.value;
				const found = Object.values(Data.craftingData.items).find(i => i.name === name);
				if (found) {
					e.target.classList.remove('invalid');
					recipe[side][idx].id = found.id;
					pic.alt = found.name;
					pic.title = found.desc;
					Images.resolveIconSrc(found).then(src => {
						pic.src = src;
					});
				} else {
					e.target.classList.add('invalid');
					recipe[side][idx].id = null;
					// update icon immediately
					const pic = cell.querySelector('.item-pic');
					pic.src = Images.PLACEHOLDER;
					pic.alt = 'Placeholder';
					pic.title = undefined;
				}
			}

			if (e.target.matches('.item-qty')) {
				const val = parseInt(e.target.value, 10);
				const clamped = val <= 0 ? 1 : val;
				if (!val || val <= 0) {
					e.target.classList.add('invalid');
				} else {
					e.target.classList.remove('invalid');
					recipe[side][idx].qty = clamped;
				}
			}
			Data.saveData();
		});
	});
}
