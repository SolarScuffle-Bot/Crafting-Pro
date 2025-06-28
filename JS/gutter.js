// gutter.js
const gutter = document.getElementById('manage-gutter');
const manage = document.getElementById('manage-section');

/**
 * Make the vertical gutter draggable to resize `.manage`’s grid columns.
 * @returns {void}
 */
export const init = () => {
	const style = getComputedStyle(document.documentElement);
	const minItemSectionSize = style.getPropertyValue('--min-item-section-width');
	const minRecipeSectionSize = style.getPropertyValue('--min-recipe-section-width');
	const gutterSize = style.getPropertyValue('--gutter-width');

	let dragging = false;
	gutter.addEventListener('mousedown', () => { dragging = true; });
	document.addEventListener('mouseup', () => { dragging = false; });
	document.addEventListener('mousemove', e => {
		if (!dragging) return;
		const { left, width } = manage.getBoundingClientRect();
		const pct = ((e.clientX - left) / width) * 100;
		manage.style.gridTemplateColumns =
			`minmax(${minItemSectionSize}, ${pct}%) ${gutterSize} minmax(${minRecipeSectionSize}, ${100 - pct}%)`;
	});
};
