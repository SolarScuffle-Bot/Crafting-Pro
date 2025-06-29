const tabs = {
	manage: document.getElementById('tab-manage'),
	visualize: document.getElementById('tab-visualize'),
};
const sections = {
	manage: document.getElementById('manage'),
	visualize: document.getElementById('visualize'),
};

export const activateTab = name => {
	Object.keys(tabs).forEach(k =>
		tabs[k].classList.toggle('active', k === name)
	);
	Object.keys(sections).forEach(k => {
		const disp = (k === name)
			? (k === 'manage' ? 'grid' : 'flex')
			: 'none';
		sections[k].style.display = disp;
	});
};

export const initTabSwitching = () => {
	tabs.manage.addEventListener('click', () => activateTab('manage'));
	tabs.visualize.addEventListener('click', () => activateTab('visualize'));
	activateTab('manage');
};
