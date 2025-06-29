// src/app.js

import * as Data from './data.js';
import * as ItemCards from './cards/item.js';
import * as RecipeCards from './cards/recipe.js';
import * as Controls from './controls.js';
import * as Theme from './theme.js';
import * as Tabs from './tabs.js';
import * as Gutter from './gutter.js';

document.addEventListener('DOMContentLoaded', () => {
	Theme.initThemeToggle();
	Tabs.initTabSwitching();
	Gutter.initGutterDrag();
	Controls.initItemControls();
	Controls.initSorting();
	Controls.initRecipeControls();
	Controls.initImportExport();

	// full rerender on load/reset
	Data.on('dataReset', () => {
		document.querySelectorAll('.item-card, .recipe-card').forEach(n => n.remove());
		Object.keys(Data.items).forEach(id => ItemCards.renderItemCard(Data.getItem(id)));
		Object.keys(Data.recipes).forEach(id => RecipeCards.renderRecipeCard(Data.getRecipe(id)));
	});

	// item events
	Data.on('itemAdded', id => ItemCards.renderItemCard(Data.getItem(id)));
	Data.on('itemChanged', id => ItemCards.updateItemCard(id));
	Data.on('itemDeleted', id => ItemCards.removeItemCard(id));

	// recipe events
	Data.on('recipeAdded', id => RecipeCards.renderRecipeCard(Data.getRecipe(id)));
	Data.on('recipe:durationChanged', id => RecipeCards.updateRecipeCard(id));
	Data.on('recipe:reversibleChanged', id => RecipeCards.updateRecipeCard(id));
	Data.on('recipe:slotsStructureChanged', id => RecipeCards.updateRecipeCard(id));
	Data.on('recipe:slotChanged', (id, side, idx, field, value) =>
		RecipeCards.updateRecipeSlot(id, side, idx, field, value)
	);
	Data.on('recipeDeleted', id => RecipeCards.removeRecipeCard(id));

	// When a recipe is created or removed, structure changes, slots change, or core fields change:
	Data.on('recipeAdded', RecipeCards.refreshAddRecipeButton);
	Data.on('recipeDeleted', RecipeCards.refreshAddRecipeButton);
	Data.on('recipe:slotsStructureChanged', RecipeCards.refreshAddRecipeButton);
	Data.on('recipe:slotChanged', RecipeCards.refreshAddRecipeButton);
	Data.on('recipe:durationChanged', RecipeCards.refreshAddRecipeButton);
	Data.on('recipe:reversibleChanged', RecipeCards.refreshAddRecipeButton);

	Data.loadData();

	// run once at startup to set the initial state
	RecipeCards.refreshAddRecipeButton();

	// Global Enter → blur & shrink item-card, but allow Shift+Enter in <textarea> for newline
	document.addEventListener('keydown', e => {
		if (e.key !== 'Enter') return;

		const target = e.target;
		const isInput = target.matches('input');
		const isTextarea = target.matches('textarea');
		if (!isInput && !isTextarea) return;

		// If it's a textarea and Shift+Enter, let it insert a newline
		if (isTextarea && e.shiftKey) {
			return;
		}

		// Otherwise, blur and shrink
		e.preventDefault();
		target.blur();

		const card = target.closest('.item-card');
		if (card && card.classList.contains('expanded')) {
			card.classList.replace('expanded', 'minimized');
		}
	});

	document.addEventListener('mousedown', e => {
		if (e.target.tagName === 'BUTTON') {
			const active = document.activeElement;
			if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
				active.blur();
			}
		}
	}, true);
});
