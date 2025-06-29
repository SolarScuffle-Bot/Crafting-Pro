export const initThemeToggle = () => {
	// theme-toggle.js
	const toggleBtn = document.getElementById('theme-toggle');
	const bodyEl = document.body;

	function applyTheme(name) {
		bodyEl.setAttribute('data-theme', name);
		localStorage.setItem('theme', name);
		toggleBtn.textContent = name === 'light' ? '🌞' : '🌙';

		// ← dispatch a global event everyone else can listen to
		window.dispatchEvent(
			new CustomEvent('themeChange', { detail: { theme: name } })
		);
	}

	// on load, read stored theme
	const saved = localStorage.getItem('theme');
	applyTheme(saved === 'dark' ? 'dark' : 'light');

	// on click, toggle
	toggleBtn.addEventListener('click', () => {
		applyTheme(bodyEl.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
	});
};

/**
 * @returns {'light' | 'dark'}
 */
export const getTheme = () => {
	const bodyEl = document.body;
	return bodyEl.getAttribute('data-theme');
}