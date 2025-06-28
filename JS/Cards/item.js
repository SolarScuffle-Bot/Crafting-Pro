const cardTemplate = document.getElementById('item-card-template');
if (cardTemplate === null) throw Error('Couldn\'t get item-card-template');

export const newCard = () => {
	const clone = cardTemplate.content.cloneNode(true);
	return clone;
}

export const init = () => {

}