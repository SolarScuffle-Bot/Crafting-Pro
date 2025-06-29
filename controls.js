// src/controls.js

import * as Data from './data.js';
import * as Utils from './utils.js';

export const confirmResettingData = () => {
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
		msg.textContent = `You are about to lose all of your data.`;
		dialog.appendChild(msg);

		const makeBtn = (text, answer) => {
			const btn = document.createElement('button');
			btn.textContent = text;
			btn.style.margin = '5px 5px';
			btn.classList.add('header-button');
			btn.addEventListener('click', e => {
				resolve(answer)
				document.body.removeChild(overlay);
			});
			dialog.appendChild(btn);
			return btn;
		};

		const confirmBtn = makeBtn('Reset Data', 'reset');
		const cancelBtn = makeBtn('Cancel', 'cancel');

		overlay.appendChild(dialog);
		document.body.appendChild(overlay);
	});
}

const searchInput = document.getElementById('search-items');
const addItemBtn = document.getElementById('add-item');
const resetBtn = document.getElementById('reset');
const itemsUl = document.getElementById('items-ul');
const datalist = document.getElementById('item-list');
const sortButtons = {
	name: document.getElementById('sort-name'),
	az: document.getElementById('sort-az'),
	za: document.getElementById('sort-za'),
	recent: document.getElementById('sort-recent'),
};

export function initItemControls() {
	refreshItemDatalist();

	searchInput.addEventListener('input', () => {
		const nm = searchInput.value.trim();
		addItemBtn.disabled = !nm || Utils.itemExistsAlready(nm);
	});

	addItemBtn.addEventListener('click', () => {
		const nm = searchInput.value.trim();
		if (nm && !Utils.itemExistsAlready(nm)) {
			Data.addItem(nm);
			searchInput.value = '';
			addItemBtn.disabled = true;
			searchInput.focus();
		}
	});

	resetBtn.addEventListener('click', async e => {
		const answer = await confirmResettingData();
		if (answer === 'cancel') return;
		Data.resetData();
		Utils.deleteCards();
	});

	Data.on('itemAdded', refreshItemDatalist);
	Data.on('itemDeleted', refreshItemDatalist);
	Data.on('itemChanged', refreshItemDatalist);
	Data.on('dataReset', refreshItemDatalist);
}

function refreshItemDatalist() {
	datalist.innerHTML = '';
	Object.values(Data.items).forEach(item => {
		const opt = document.createElement('option');
		opt.value = item.name;
		datalist.append(opt);
	});
}

export function initSorting() {
	let currentSort = 'name';

	function clearActive() {
		Object.values(sortButtons).forEach(btn => btn.classList.remove('active'));
	}

	function sortItems() {
		const q = searchInput.value.trim().toLowerCase();
		const cards = Array.from(itemsUl.children);

		const keyed = cards.map(card => {
			const id = card.dataset.id;
			const it = Data.items[id];
			if (!it) return null;
			const name = it.name.toLowerCase();
			let key;
			switch (currentSort) {
				case 'name': key = q ? Utils.levenshtein(name, q) : 0; break;
				case 'az': key = name; break;
				case 'za': key = name; break;
				case 'recent': key = it.lastMaximized || 0; break;
				default: key = 0;
			}
			return { id, key };
		})
			.filter(x => x !== null);

		keyed.sort((a, b) => {
			switch (currentSort) {
				case 'za': return String(b.key).localeCompare(String(a.key));
				case 'az': return String(a.key).localeCompare(String(b.key));
				case 'recent': return Number(b.key) - Number(a.key);
				case 'name':
				default: return Number(a.key) - Number(b.key);
			}
		});

		keyed.forEach(x => {
			const c = itemsUl.querySelector(`.item-card[data-id="${x.id}"]`);
			if (c) itemsUl.appendChild(c);
		});
	}

	clearActive();
	sortButtons.name.classList.add('active');
	sortItems();

	Object.entries(sortButtons).forEach(([crit, btn]) => {
		btn.addEventListener('click', () => {
			clearActive();
			btn.classList.add('active');
			currentSort = crit;
			sortItems();
		});
	});

	let timer;
	searchInput.addEventListener('input', () => {
		clearTimeout(timer);
		timer = setTimeout(sortItems, 100);
	});

	Data.on('itemAdded', sortItems);
	Data.on('itemDeleted', sortItems);
	Data.on('itemChanged', sortItems);
}

//
// Recipe controls & sorting
//

// grab the three recipe search bars
const searchRecipeInputs = document.getElementById('search-recipe-inputs');
const searchRecipeDuration = document.getElementById('search-recipe-duration');
const searchRecipeOutputs = document.getElementById('search-recipe-outputs');
const addRecipeBtn = document.getElementById('add-recipe');
const recipesUl = document.getElementById('recipes-ul');

// parse comma-separated list into non-empty strings
function parseCommaList(str) {
	return str.split(',')
		.map(s => s.trim())
		.filter(Boolean);
}

// compute a [0…1] similarity for recipeNames vs queryNames
function computeNameScore(recipeNames, queryNames) {
	if (queryNames.length === 0) return 1;
	let total = 0;
	for (const q of queryNames) {
		let bestSim = 0;
		for (const nm of recipeNames) {
			const dist = Utils.levenshtein(nm, q);
			const sim = 1 / (1 + dist);
			bestSim = Math.max(bestSim, sim);
		}
		total += bestSim;
	}
	return total / queryNames.length;
}

// main sort routine
export function applyRecipeSort() {
	const inQ = parseCommaList(searchRecipeInputs.value);
	const outQ = parseCommaList(searchRecipeOutputs.value);
	const dVal = Utils.parseDuration(searchRecipeDuration.value);
	const hasD = !Number.isNaN(dVal);

	const wI = 0.4, wO = 0.4, wD = 0.2;
	const maxDiff = 7 * 24 * 3600;  // one week in seconds

	// build and score
	const scored = Object.values(Data.recipes).map(r => {
		const inNames = r.inputs.map(s => Data.getItem(s.id)?.name).filter(Boolean);
		const outNames = r.outputs.map(s => Data.getItem(s.id)?.name).filter(Boolean);

		const iScore = computeNameScore(inNames, inQ);
		const oScore = computeNameScore(outNames, outQ);
		const dScore = hasD
			? Math.max(0, 1 - Math.abs(r.duration - dVal) / maxDiff)
			: 1;

		const relevance =
			Math.pow(iScore, wI) *
			Math.pow(oScore, wO) *
			Math.pow(dScore, wD);

		return { id: r.id, relevance };
	});

	// sort descending
	scored.sort((a, b) => b.relevance - a.relevance);

	// re-append in order
	scored.forEach(({ id }) => {
		const card = recipesUl.querySelector(`.recipe-card[data-id="${id}"]`);
		if (card) recipesUl.appendChild(card);
	});
}

/**
 * Initialize recipe controls: +Recipe button and live sort by inputs/duration/outputs.
 */
export function initRecipeControls() {
	// 2) the button just drives the one Data.addRecipe() call
	addRecipeBtn.addEventListener('click', () => {
		Data.addRecipe();
	});

	searchRecipeDuration.addEventListener('input', e => {
		const secs = Utils.parseDuration(e.target.value);
		const isInvalid = isNaN(secs) || secs < 0;
		e.target.classList.toggle('invalid', isInvalid);
		if (!isInvalid) {
			applyRecipeSort();
		}
	});
	searchRecipeDuration.addEventListener('blur', e => {
		let secs = Utils.parseDuration(e.target.value);
		if (isNaN(secs) || secs < 0) secs = 0;
		e.target.classList.remove('invalid');
		e.target.value = Utils.formatDuration(secs);
		applyRecipeSort();
	});

	// live-sort whenever any bar changes
	[searchRecipeInputs, searchRecipeOutputs].forEach(el => el.addEventListener('input', e => {
		if (e.target.value === '') {
			e.target.classList.remove('invalid');
			return;
		};

		const names = parseCommaList(e.target.value);
		for (const name of names) {
			const found = Object.values(Data.items).find(i => i.name === name);
			e.target.classList.toggle('invalid', !found);
			if (!found) return;
		}

		applyRecipeSort();
	}));

	// initial render of existing recipes + initial sort
	applyRecipeSort();
}

export function initImportExport() {
	const importBtn = document.getElementById('import');
	const exportBtn = document.getElementById('export');

	// — Export —
	exportBtn.addEventListener('click', () => {
		const dump = Data.exportData();
		const json = JSON.stringify(dump, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');

		a.href = url;
		a.download = `CraftingProData_v${dump.version}.json`;
		a.click();

		// cleanup
		URL.revokeObjectURL(url);
	});

	// — Import —
	importBtn.addEventListener('click', async () => {
		const answer = await confirmResettingData();
		if (answer === 'cancel') return;

		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json';
		input.onchange = e => {
			const file = e.target.files[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = ev => {
				try {
					const data = JSON.parse(ev.target.result);
					Data.importData(data);
				} catch (err) {
					alert('Import failed: invalid JSON format.');
				}
			};
			reader.readAsText(file);
		};
		input.click();
	});
}