import '@testing-library/jest-dom/vitest';

const localStorageValues = new Map<string, string>();
const localStorageMock: Storage = {
	get length() {
		return localStorageValues.size;
	},
	clear() {
		localStorageValues.clear();
	},
	getItem(key) {
		return localStorageValues.get(key) ?? null;
	},
	key(index) {
		return [...localStorageValues.keys()][index] ?? null;
	},
	removeItem(key) {
		localStorageValues.delete(key);
	},
	setItem(key, value) {
		localStorageValues.set(key, value);
	},
};

Object.defineProperty(globalThis, 'localStorage', {
	configurable: true,
	value: localStorageMock,
	writable: true,
});

if (typeof window !== 'undefined') {
	Object.defineProperty(window, 'localStorage', {
		configurable: true,
		value: localStorageMock,
		writable: true,
	});
}
