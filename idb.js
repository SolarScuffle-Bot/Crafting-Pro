/** @returns {Promise<IDBDatabase>} */
export function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open('CraftingProIDB', 1);
		req.onupgradeneeded = () => {
			req.result.createObjectStore('images');
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/**
 * Store a Blob under a given key.
 * @param {string} key
 * @param {Blob} blob
 * @returns {Promise<void>}
 */
export async function saveBlob(key, blob) {
	const database = await openDB();
	const transaction = database.transaction('images', 'readwrite');
	transaction.objectStore('images').put(blob, key);
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
	});
}

/**
 * Delete a key.
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function deleteKey(key) {
	const database = await openDB();
	const transaction = database.transaction('images', 'readwrite');
	transaction.objectStore('images').delete(key);
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
	})
}

/**
 * Retrieve Blob by key and return a temporary object URL.
 * @param {string} key
 * @returns {Promise<string | null>}  A URL you can assign to an \<img\>
 */
export async function getBlobURL(key) {
	const database = await openDB();
	const transaction = database.transaction('images', 'readonly');
	const request = transaction.objectStore('images').get(key);
	return new Promise((resolve, reject) => {
		request.onsuccess = () => {
			const blob = request.result;
			if (!blob) return resolve(null); // no image stored
			resolve(URL.createObjectURL(blob));
		};
		request.onerror = () => reject(request.error);
	});
}

/**
 * Retrieve a Blob from the 'images' object store by its key.
 *
 * @param {string} key
 *   The unique key under which the Blob was saved in IndexedDB.
 * @returns {Promise<Blob|undefined>}
 *   A promise that resolves to the stored Blob if it exists,
 *   or `undefined` if no record is found for that key.
 * @throws {DOMException}
 *   If an IndexedDB error occurs during the transaction.
 *
 * @example
 * try {
 *   const blob = await getBlob('icon-foo');
 *   if (blob) {
 *     const url = URL.createObjectURL(blob);
 *     myImage.src = url;
 *   } else {
 *     console.log('No image stored under icon-foo');
 *   }
 * } catch (err) {
 *   console.error('Failed to read blob:', err);
 * }
 */
export async function getBlob(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', 'readonly');
    const store = tx.objectStore('images');
    const req = store.get(key);

    req.onsuccess = () => {
      resolve(req.result);
    };

    req.onerror = () => {
      reject(req.error);
    };
  });
}
