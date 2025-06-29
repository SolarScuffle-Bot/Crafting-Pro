// src/cards/item.js

import * as Data from '../data.js';
import * as Image from '../image.js';
import * as IDB from '../idb.js';
import * as Base from './base.js';
import * as Utils from '../utils.js';

export function renderItemCard(item) {
	const html = `
    <div class="overlay-btn-holder">
      <button data-action="clone">Clone</button>
      <button class="delete-btn" data-action="delete">×</button>
    </div>
    <div class="card-header">
      <label class="icon-upload">
        <img class="icon" src="${Image.PLACEHOLDER}" alt="" title="">
        <input type="file" class="edit-icon-file input-style" accept="image/*" hidden>
      </label>
      <input type="text" class="edit-name input-style" value="${item.name}">
    </div>
    <div class="card-body">
      <label>Icon URL:<br>
        <input type="url" class="edit-icon input-style" data-field="icon"
               placeholder="https://example.com/icon.png"
               value="${item.icon || ''}">
      </label><br>
      <label>Description:<br>
        <textarea class="edit-desc input-style" data-field="desc">${item.desc}</textarea>
      </label>
    </div>
  `.trim();

	const card = document.createElement('div');
	card.className = 'item-card minimized';
	card.dataset.id = item.id;
	card.innerHTML = html;
	document.getElementById('items-ul').prepend(card);
	setup(card);
}

export function removeItemCard(id) {
	const c = document.querySelector(`.item-card[data-id="${id}"]`);
	if (c) c.remove();
}

export function updateItemCard(id) {
	const item = Data.getItem(id);
	const card = document.querySelector(`.item-card[data-id="${id}"]`);
	if (!card) return;

	card.querySelector('.edit-name').value = item.name;
	card.querySelector('.edit-desc').value = item.desc;

	const urlIn = card.querySelector('.edit-icon');
	if (item.iconKey) {
		// file mode
		urlIn.value = 'FILE';
		urlIn.readOnly = true;
		urlIn.classList.add('file-mode');
	} else {
		// URL or empty
		urlIn.value = item.icon || '';
		urlIn.readOnly = false;
		urlIn.classList.remove('file-mode');
	}

	Image.resolveIconSrc(item, IDB.getBlobURL).then(src => {
		const img = card.querySelector('.icon');
		img.src = src;
		img.title = item.desc;
		Base.applyTint(src,
			card.querySelector('.card-header'),
			card.querySelector('.card-body'));
	});
}

// debounce helper
function debounce(fn, wait) {
	let h;
	return (...args) => {
		clearTimeout(h);
		h = setTimeout(() => fn(...args), wait);
	};
}

function setup(card) {
	const id = card.dataset.id;
	const item = Data.getItem(id);
	const header = card.querySelector('.card-header');
	const body = card.querySelector('.card-body');
	const iconEl = card.querySelector('.icon');

	// ——— 1) name field: bespoke validation & blur-revert ———
	const nameIn = card.querySelector('.edit-name');
	nameIn.addEventListener('input', () => {
		const v = nameIn.value.trim();
		if (!v || Utils.itemExistsAlready(v) || v.includes(',')) {
			nameIn.classList.add('invalid');
		} else {
			nameIn.classList.remove('invalid');
		}
	});
	nameIn.addEventListener('blur', () => {
		const v = nameIn.value.trim();
		if (!v || Utils.itemExistsAlready(v) || v.includes(',')) {
			// revert
			nameIn.value = Data.getItem(id).name;
			nameIn.classList.remove('invalid');
		} else {
			Data.updateItem(id, 'name', v);
			nameIn.classList.remove('invalid');
		}
	});

	const descEl = card.querySelector('.edit-desc');


	// 1) initial icon + tint
	Image.resolveIconSrc(item, IDB.getBlobURL).then(src => {
		iconEl.src = src;
		iconEl.title = item.desc;
		Base.applyTint(src, header, body);
	});

	// 2) re-tint on theme change
	window.addEventListener('themeChange', () => {
		Base.applyTint(iconEl.src, header, body);
	});

	// 3) expand/collapse
	let downPos = null;

	// Capture the start of a potential click
	card.addEventListener('pointerdown', e => {
		// Ignore any pointerdown on form controls
		if (e.target.closest('input,textarea,label,button')) return;
		downPos = { x: e.clientX, y: e.clientY };
	}, true);

	// On pointerup, if we started inside the card and didn't move far, toggle
	card.addEventListener('pointerup', e => {
		if (!downPos) return;
		// If pointerup on a form control, bail out
		if (e.target.closest('input,textarea,label,button')) {
			downPos = null;
			return;
		}
		const dx = e.clientX - downPos.x;
		const dy = e.clientY - downPos.y;
		downPos = null;

		// only treat it as a click if movement was small
		if (Math.hypot(dx, dy) < 5) {
			card.classList.toggle('minimized');
			const exp = card.classList.toggle('expanded');
			if (exp) Data.updateItem(id, 'lastMaximized', Date.now());
		}
	});
	// card.addEventListener('click', e => {
	// 	if (e.detail === 0) return;
	// 	if (e.target.closest('input,textarea,label,button')) return;
	// 	card.classList.toggle('minimized');
	// 	const exp = card.classList.toggle('expanded');
	// 	if (exp) Data.updateItem(id, 'lastMaximized', Date.now());
	// });

	// 4) field edits → Data.updateItem, but via focusout
	card.querySelectorAll('[data-field]').forEach(el => {
		const fld = el.dataset.field;
		// debounce to avoid hammering Data.updateItem on every keystroke
		const save = debounce(() => {
			const v = el.value.trim();
			// your existing name-uniqueness + comma check can stay here if you like
			Data.updateItem(card.dataset.id, fld, v);
		}, 200);

		// fire on every input
		// el.addEventListener('input', save);

		// (optional) also save immediately on Enter
		el.addEventListener('keydown', e => {
			if (e.key !== 'Enter') return;

			const target = e.target;
			const isInput = target.matches('input');
			const isTextarea = target.matches('textarea');
			if (!isInput && !isTextarea) return;

			// If it's a textarea and Shift+Enter, let it insert a newline
			if (isTextarea && e.shiftKey) {
				return;
			}

			e.preventDefault(); // avoid newline in <textarea>, if that matters
			save();             // flush immediately
			// el.blur();          // move focus so user sees it saved
		});
	});

	// 5) file upload — no other click handlers needed
	const fileIn = card.querySelector('.edit-icon-file');
	fileIn.addEventListener('change', async e => {
		const f = e.target.files[0];
		if (!f) return;
		const tiny = await Image.resizeImage(f);
		const key = `icon-${card.dataset.id}`;
		await IDB.saveBlob(key, tiny);
		Data.updateItem(card.dataset.id, 'iconKey', key);
		Data.updateItem(card.dataset.id, 'icon', undefined);
		updateItemCard(card.dataset.id);
	});

	// helper: immediate outline toggle
	const urlIn = card.querySelector('.edit-icon');
	urlIn.addEventListener('input', () => {
		const v = urlIn.value.trim();
		if (v === '' || Utils.isLikelyReadyUrl(v)) {
			urlIn.classList.remove('invalid');
		} else {
			urlIn.classList.add('invalid');
		}
	});

	// save only when empty or valid
	const saveUrl = () => {
		const v = urlIn.value.trim();
		if (v !== '' && !Utils.isLikelyReadyUrl(v)) {
			// invalid → do not save (and keep focus in the field)
			return;
		}
		Data.updateItem(id, 'icon', v || undefined);
		Base.applyTint(iconEl.src, header, body);
	};

	// immediate on blur (in case they finish typing and tab away)
	urlIn.addEventListener('blur', saveUrl);

	urlIn.addEventListener('focus', () => {
		if (!urlIn.readOnly) return;
		// switch back to URL mode
		urlIn.readOnly = false;
		urlIn.classList.remove('file-mode');
		// clear out the file-mode data to reset to placeholder
		Data.updateItem(id, 'iconKey', undefined);
		Data.updateItem(id, 'icon', '');

		urlIn.focus();
		const len = urlIn.value.length;
		urlIn.setSelectionRange(len, len);
	});
	urlIn.addEventListener('click', () => {
		if (urlIn.readOnly) urlIn.focus();
	});

	// 6) delete
	card.querySelector('[data-action="delete"]').addEventListener('click', async e => {
		e.stopPropagation();
		const used = Object.values(Data.recipes).filter(r =>
			r.inputs.some(s => s.id === id) || r.outputs.some(s => s.id === id)
		);
		let choice = 'cancel';
		if (used.length) {
			choice = await Base.confirmItemDeletion(id, used.length);
			if (choice === 'cancel') return;
		}
		Data.deleteItem(id);
	});

	// clone (carry over URL or file‐blob icon)
	card.querySelector('[data-action="clone"]').addEventListener('click', async e => {
		e.stopPropagation();
		const newName = Base.getUniqueCloneName(item.name);
		// 1) create the new item (URL‐mode if item.icon is set)
		const newId = Data.addItem(newName, item.icon, item.desc);

		// 2) if original used a file-blob, clone that too
		if (item.iconKey) {
			try {
				// read the old blob
				const blob = await IDB.getBlob(item.iconKey);
				if (blob) {
					const newKey = `icon-${newId}`;
					// save under new key
					await IDB.saveBlob(newKey, blob);
					// update the cloned item to use this file-mode icon
					Data.updateItem(newId, 'iconKey', newKey);
					Data.updateItem(newId, 'icon', undefined);
				}
			} catch (err) {
				console.warn('Failed to clone icon blob', err);
			}
		}

		const newCard = document.querySelector(`.item-card[data-id="${newId}"]`);
		if (!newCard) return;

		const nameIn = newCard.querySelector('.edit-name');
		if (!nameIn) return;

		nameIn.focus();
		const len = nameIn.value.length;
		nameIn.setSelectionRange(len, len);
	});

	updateItemCard(id);
}
