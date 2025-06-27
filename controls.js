// src/controls.js

import * as Data from './data.js';
import * as Utils from './utils.js';
import * as ItemCards from './cards/item.js';
import * as RecipeCards from './cards/recipe.js';

var searchInput = document.getElementById('search-items');
var addItemBtn = document.getElementById('add-item');
var addRecipeBtn = document.getElementById('add-recipe');
var resetBtn = document.getElementById('reset');
var itemsUl = document.getElementById('items-ul');
var recipesUl = document.getElementById('recipes-ul');
var datalist = document.getElementById('item-list');

var sortButtons = {
	name: document.getElementById('sort-name'),
	az: document.getElementById('sort-az'),
	za: document.getElementById('sort-za'),
	recent: document.getElementById('sort-recent'),
};

/**
 * @typedef {'name'|'az'|'za'|'recent'} SortCriteria
 */

/**
 * Populate the <datalist> with current item names.
 */
function refreshItemDatalist() {
	datalist.innerHTML = '';
	Object.values(Data.craftingData.items).forEach(function (item) {
		var opt = document.createElement('option');
		opt.value = item.name;
		datalist.append(opt);
	});
}

/**
 * Wire up “+ Item” and reset controls, and keep the datalist in sync.
 */
function initItemControls() {
	// initial load of datalist
	Data.loadData();
	refreshItemDatalist();

	// Enable/disable +Item button
	searchInput.addEventListener('input', function () {
		var name = searchInput.value.trim();
		addItemBtn.disabled = !name || Utils.itemExistsAlready(name);
	});

	// +Item
	addItemBtn.addEventListener('click', function () {
		var name = searchInput.value.trim();
		if (!name || Utils.itemExistsAlready(name)) {
			return;
		}
		var newItem = ItemCards.addItem(name);
		ItemCards.renderItemCard(newItem);
		// update datalist
		refreshItemDatalist();
		searchInput.value = '';
		addItemBtn.disabled = true;
	});

	// Reset all data and re-render
	resetBtn.addEventListener('click', function () {
		Data.resetData();
		Utils.deleteCards();
		Data.loadData();

		// re-render items
		Object.values(Data.craftingData.items)
			.forEach(ItemCards.renderItemCard);

		// re-render recipes
		Object.values(Data.craftingData.recipes)
			.forEach(RecipeCards.renderRecipeCard);

		// refresh datalist
		refreshItemDatalist();
	});
}

/**
 * Wire up the four sort buttons for items.
 */
function initSorting() {
	function clearActive() {
		Object.values(sortButtons).forEach(function (btn) {
			btn.classList.remove('active');
		});
	}

	function reorderCardsBy(idList) {
		idList.forEach(function (id) {
			var card = itemsUl.querySelector('.item-card[data-id="' + id + '"]');
			if (card) {
				itemsUl.appendChild(card);
			}
		});
	}

	function sortItemsBy(criteria) {
		var cards = Array.from(itemsUl.children);
		var query = searchInput.value.trim().toLowerCase();

		var keyed = cards.map(function (card) {
			var id = card.dataset.id;
			var name = Data.craftingData.items[id].name.toLowerCase();
			var key;
			switch (criteria) {
				case 'name':
					key = query ? Utils.levenshtein(name, query) : 0;
					break;
				case 'az':
				case 'za':
					key = name;
					break;
				case 'recent':
					key = Data.craftingData.items[id].lastMaximized || 0;
					break;
				default:
					key = 0;
			}
			return { id: id, key: key };
		});

		keyed.sort(function (a, b) {
			switch (criteria) {
				case 'za':
					return String(b.key).localeCompare(String(a.key));
				case 'az':
					return String(a.key).localeCompare(String(b.key));
				case 'recent':
					return Number(b.key) - Number(a.key);
				case 'name':
				default:
					return Number(a.key) - Number(b.key);
			}
		});

		reorderCardsBy(keyed.map(function (x) { return x.id; }));
	}

	var currentSort = 'name';
	clearActive();
	sortButtons.name.classList.add('active');
	sortItemsBy(currentSort);

	Object.keys(sortButtons).forEach(function (crit) {
		var btn = sortButtons[crit];
		btn.addEventListener('click', function () {
			clearActive();
			btn.classList.add('active');
			currentSort = crit;
			sortItemsBy(currentSort);
		});
	});

	var debounceTimer = null;
	searchInput.addEventListener('input', function () {
		clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(function () {
			sortItemsBy(currentSort);
		}, 300);
	});
}

/**
 * Wire up “+ Recipe” button to create a blank recipe.
 */
function initRecipeControls() {
	addRecipeBtn.addEventListener('click', function () {
		var id = Utils.generateId();
		var blankRecipe = {
			id: id,
			name: '',
			inputs: [],
			outputs: [],
			duration: 0,
			reversible: false
		};
		Data.craftingData.recipes[id] = blankRecipe;
		Data.saveData();
		RecipeCards.renderRecipeCard(blankRecipe);
	});
}

// Export as named functions
export {
	initItemControls,
	initSorting,
	initRecipeControls
};
