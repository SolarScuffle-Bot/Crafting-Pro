// src/cards/itemCards.js

import * as Data from '../data.js';
import * as Utils from '../utils.js';
import * as IDB from '../idb.js';
import * as Image from '../image.js';
import * as CardBase from './base.js';

/**
 * @typedef {CustomEvent<{ id: string, card: HTMLElement, changed: 'name' | 'description' | 'url' | 'create' } | { id: string, card: HTMLElement, changed: 'delete', choice: 'removeReferences' | 'deleteRecipes' }>} ItemChange
 */

/**
 * Create & persist a new item.
 * @param {string} name
 * @param {string} [icon]
 * @param {string} [desc]
 * @returns {Data.ItemData}
 */
export const addItem = (name, icon = '', desc = '') => {
	const id = Utils.generateId();
	const newItem = { id, name, icon, desc };
	Data.craftingData.items[id] = newItem;
	Data.saveData();
	return newItem;
};

/**
 * Render an item‐card and prepend it into #items-ul.
 * @param {Data.ItemData} item
 * @returns {HTMLDivElement}
 */
export const renderItemCard = item => {
	const html = `
    <div class="overlay-btn-holder">
      <button class="clone-btn">Clone</button>
      <button class="delete-btn">×</button>
    </div>
    <div class="card-header">
      <label class="icon-upload">
        <img class="icon" src="${Image.PLACEHOLDER}" alt="" title="">
        <input type="file" class="edit-icon-file" accept="image/*" hidden>
      </label>
      <input type="text" class="edit-name input-style" value="${item.name}">
    </div>
    <div class="card-body">
      <label>Icon URL:<br>
        <input type="url" class="edit-icon input-style"
          placeholder="https://example.com/icon.png" value="">
      </label><br>
      <label>Description:<br>
        <textarea class="edit-desc">${item.desc}</textarea>
      </label>
    </div>`.trim();

	const card = document.createElement('div');
	card.className = 'item-card minimized';
	card.dataset.id = item.id;
	card.innerHTML = html;
	document.getElementById('items-ul').prepend(card);
	setupItemCard(card);
	return card;
};

/**
 * Wire up all behaviors on an item‐card.
 * @param {HTMLDivElement} card
 */
export const setupItemCard = card => {
	const id = card.dataset.id;
	const itemData = Data.craftingData.items[id];

	const nameIn = /**@type {HTMLInputElement}*/(card.querySelector('.edit-name'));
	const descIn = /**@type {HTMLTextAreaElement}*/(card.querySelector('.edit-desc'));
	const urlIn = /**@type {HTMLInputElement}*/(card.querySelector('.edit-icon'));
	const fileIn = /**@type {HTMLInputElement}*/card.querySelector('.edit-icon-file');
	const cloneBtn = card.querySelector('.clone-btn');
	const deleteBtn = card.querySelector('.delete-btn');
	const headerEl = card.querySelector('.card-header');
	const bodyEl = card.querySelector('.card-body');
	const iconEl = card.querySelector('.icon');
	const key = `icon-${id}`;

	[headerEl, bodyEl].forEach(el =>
		el.addEventListener('click', e => {
			if (e.target.closest('input,textarea,label')) return;
			card.classList.toggle('minimized');
			const nowExpanding = card.classList.toggle('expanded');
			if (nowExpanding) {
				itemData.lastMaximized = Date.now();
				Data.saveData();
			};
		})
	);

	card.querySelectorAll('input').forEach(input =>
		input.addEventListener('keydown', e => {
			if (e.key === 'Enter') {
				e.preventDefault();
				input.blur();
				card.classList.replace('expanded', 'minimized');
			}
		})
	);

	// initial icon + tint
	Image.resolveIconSrc(itemData, IDB.getBlobURL).then(src => {
		iconEl.src = src;
		iconEl.title = itemData.desc;
		if (itemData.iconKey) {
			urlIn.value = 'FILE';
			urlIn.readOnly = true;
			urlIn.classList.add('file-mode');
		} else {
			urlIn.value = src === Image.PLACEHOLDER ? '' : src;
		}
		CardBase.applyTint(src, headerEl, bodyEl);
	});

	window.addEventListener('themeChange', e => {
		CardBase.applyTint(iconEl.src, headerEl, bodyEl);
	});

	// name editing (no duplicates)
	nameIn.addEventListener('input', () => {
		const v = nameIn.value.trim();
		if (
			(v !== itemData.name && Utils.itemExistsAlready(v)) ||
			v.includes(',')
		) {
			nameIn.classList.add('invalid');
		} else {
			nameIn.classList.remove('invalid');
			if (v !== itemData.name) {
				itemData.name = v;
				Data.saveData();

				window.dispatchEvent(
					new CustomEvent('itemChange', { detail: { id: itemData.id, card, changed: 'name' } })
				);
			}
		}
	});
	nameIn.addEventListener('blur', () => {
		if (nameIn.classList.contains('invalid')) {
			nameIn.value = itemData.name;
			nameIn.classList.remove('invalid');
		}
	});

	// description
	descIn.addEventListener('input', () => {
		itemData.desc = descIn.value.trim();
		iconEl.title = itemData.desc;
		Data.saveData();

		window.dispatchEvent(
			new CustomEvent('itemChange', { detail: { id: itemData.id, card, changed: 'description' } })
		);
	});

	descIn.addEventListener('pointerdown', e => {
		descIn.setPointerCapture(e.pointerId);
	});

	// 2) Release capture on pointerup (cleanup)
	descIn.addEventListener('pointerup', e => {
		if (descIn.hasPointerCapture(e.pointerId)) {
			descIn.releasePointerCapture(e.pointerId);
		}
	});

	// URL input (debounced, validated, tinted)
	let urlTimer;
	urlIn.addEventListener('input', () => {
		const v = urlIn.value.trim();
		if (itemData.iconKey) {
			IDB.deleteKey(itemData.iconKey).catch(console.warn);
			delete itemData.iconKey;
			urlIn.readOnly = false;
			urlIn.classList.remove('file-mode');
		}
		itemData.icon = v;
		Data.saveData();

		if (!v) {
			iconEl.src = Image.PLACEHOLDER;
			urlIn.classList.remove('invalid');
			CardBase.applyTint(iconEl.src, headerEl, bodyEl);

			window.dispatchEvent(
				new CustomEvent('itemChange', { detail: { id: itemData.id, card, changed: 'url' } })
			);

			return;
		}

		if (!Image.isLikelyReadyUrl(v)) {
			urlIn.classList.remove('invalid');

			window.dispatchEvent(
				new CustomEvent('itemChange', { detail: { id: itemData.id, card, changed: 'url' } })
			);

			return;
		}

		clearTimeout(urlTimer);
		urlTimer = setTimeout(() => {
			Image.preloadImage(v)
				.then(() => {
					iconEl.src = v;
					urlIn.classList.remove('invalid');
					CardBase.applyTint(v, headerEl, bodyEl);
				})
				.catch(() => {
					delete itemData.icon;
					Data.saveData();
					urlIn.classList.add('invalid');

					window.dispatchEvent(
						new CustomEvent('itemChange', { detail: { id: itemData.id, card, changed: 'url' } })
					);
				});
		}, 300);
	});

	urlIn.addEventListener('focus', () => {
		if (!urlIn.readOnly) return;
		urlIn.readOnly = false;
		urlIn.classList.remove('file-mode');
		urlIn.placeholder = 'https://example.com/icon.png';
		delete itemData.iconKey;
		Data.saveData();
		iconEl.src = Image.PLACEHOLDER;
		urlIn.value = '';
		CardBase.applyTint(Image.PLACEHOLDER, headerEl, bodyEl);
	});
	urlIn.addEventListener('click', () => {
		if (urlIn.readOnly) urlIn.dispatchEvent(new Event('focus'));
	});

	// file upload (resize → save → preview → tint)
	fileIn.addEventListener('click', e => e.stopPropagation());
	fileIn.addEventListener('change', async () => {
		const f = fileIn.files?.[0];
		if (!f) return;
		try {
			const tiny = await Image.resizeImage(f);
			await IDB.saveBlob(key, tiny);
			const blobUrl = URL.createObjectURL(tiny);

			iconEl.src = blobUrl;
			urlIn.value = 'FILE';
			urlIn.readOnly = true;
			urlIn.classList.add('file-mode');

			delete itemData.icon;
			itemData.iconKey = key;
			Data.saveData();

			CardBase.applyTint(blobUrl, headerEl, bodyEl);

			window.dispatchEvent(
				new CustomEvent('itemChange', { detail: { id: itemData.id, card, changed: 'url' } })
			);
		} catch (err) {
			console.error('Image resize/store failed', err);
		}
	});

	// delete (with recipe‐cross-ref confirm)
	deleteBtn.addEventListener('click', async () => {
		const used = Object.values(Data.craftingData.recipes)
			.filter(r => (r.inputs || []).includes(id)
				|| (r.outputs || []).includes(id));

		let choice;
		if (used.length) {
			choice = await CardBase.confirmItemDeletion(itemData.name, used.length);
			if (choice === 'cancel') return;
			// TODO: re-render recipes
		}

		if (itemData.iconKey) {
			IDB.deleteKey(itemData.iconKey).catch(console.warn);
			delete itemData.iconKey;
		}
		delete Data.craftingData.items[id];
		Data.saveData();
		card.remove();

		window.dispatchEvent(
			new CustomEvent('itemChange', { detail: { id: itemData.id, card, changed: 'delete', choice } })
		);
	});

	// clone
	cloneBtn.addEventListener('click', () => {
		card.classList.replace('expanded', 'minimized');
		const newName = CardBase.getUniqueCloneName(itemData.name);
		const newItem = addItem(newName, itemData.icon, itemData.desc);
		const newCard = renderItemCard(newItem);
		newCard.classList.replace('minimized', 'expanded');
		newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
		const ni = newCard.querySelector('.edit-name');
		ni.focus();
		ni.setSelectionRange(ni.value.length, ni.value.length);
	});

	window.dispatchEvent(
		new CustomEvent('itemChange', { detail: { id: itemData.id, card, changed: 'create' } })
	);
};

// TODO:
// window.addEventListener('itemChange', /** @type { (e: ItemChange) => () } */(e => {
// 	const detail = e.detail;
// 	if (detail.changed !== 'url') return;

// 	detail.id
// }))