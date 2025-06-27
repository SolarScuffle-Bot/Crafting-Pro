// src/app.js

import * as Tabs        from './tabs.js';
import * as Gutter      from './gutter.js';
import * as Data        from './data.js';
import * as ItemCards   from './cards/item.js';
import * as RecipeCards from './cards/recipe.js';
import * as Controls    from './controls.js';
import * as Theme       from './theme.js';

document.addEventListener('DOMContentLoaded', () => {
  Theme.initThemeToggle();
  Tabs.initTabSwitching();
  Gutter.initGutterDrag();

  // Item & Recipe controls
  Controls.initItemControls();
  Controls.initSorting();
  Controls.initRecipeControls();

  // Load and render data
  Data.loadData();

  Object.values(Data.craftingData.items)
    .forEach(item => ItemCards.renderItemCard(item));

  Object.values(Data.craftingData.recipes)
    .forEach(recipe => RecipeCards.renderRecipeCard(recipe));

  // Global Enter→blur for any <input>
  document.addEventListener('keydown', e => {
    if (e.target.matches('input') && e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
  });
});
