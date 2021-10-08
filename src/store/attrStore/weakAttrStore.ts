import { AttrStore } from "./attrStore";

/**
 * Holds a weak reference to an AttrStore so that long-lived callbacks floating around in hooks-land
 * don't accidentally retain a reference to this store when its parent node has disappeared and it
 * could otherwise be garbage collected.
 */
export class WeakAttrStore {
    private attrStore: AttrStore;

    constructor(attrStore: AttrStore) {
        this.attrStore = attrStore;
    }

    registerRunCallback(callback: Function) {
        return this.attrStore && this.attrStore.registerRunCallback(callback);
    }

    registerDestroyCallback(callback: Function) {
        return this.attrStore && this.attrStore.registerDestroyCallback(callback);
    }

    unregisterDestroyCallback(callback: Function) {
        return this.attrStore && this.attrStore.unregisterDestroyCallback(callback);
    }

    getCurrentCell() {
        return this.attrStore && this.attrStore.getCurrentCell();
    }

    incrementPointer() {
        return this.attrStore && this.attrStore.incrementPointer();
    }

    invalidate() {
        return this.attrStore && this.attrStore.invalidate();
    }

    destroy() {
        this.attrStore = null;
    }
}
