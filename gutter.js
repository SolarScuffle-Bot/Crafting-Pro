// gutter.js
const gutter = document.getElementById('gutter');
const manage = document.getElementById('manage');

/**
 * Make the vertical gutter draggable to resize `.manage`’s grid columns.
 * @returns {void}
 */
export const initGutterDrag = () => {
	let dragging = false;
	gutter.addEventListener('mousedown', () => { dragging = true; });
	document.addEventListener('mouseup', () => { dragging = false; });
	document.addEventListener('mousemove', e => {
		if (!dragging) return;
		const { left, width } = manage.getBoundingClientRect();
		const pct = ((e.clientX - left) / width) * 100;
		manage.style.gridTemplateColumns =
			`minmax(250px, ${pct}%) 8px minmax(200px, ${100 - pct}%)`;
	});
};
