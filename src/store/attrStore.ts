import { Node } from "prosemirror-model";

import { ReactiveAttrFn, ReactiveAttrUpdateResult, Hooks } from "./types";
import { warn, throwError } from "./util";

type UninitializedCell = [];
type Cell = UninitializedCell | [number, any[]];
type State<T> = [T, StateUpdater<T>];
type Effect = [any[], () => any];
type Ref = { current: any };

type StateUpdater<T> = (arg: T | ((curr: T) => T)) => void;
type EffectCallback = () => () => any;
type OnInvalidate = (attr: string) => void;

const noopInvalidate = () => {
    warn(
        "An invalidate function was not provided to an attrStore, meaning state updates will not propagate to the document."
    );
};

const getDependenciesChanged = (from: any[], to: any[]) => {
    if (!to) {
        return true;
    }
    if (from === to) {
        return false;
    } else if (from.length !== to.length) {
        return true;
    }
    for (let i = 0; i < from.length; i++) {
        if (from[i] !== to[i]) {
            return true;
        }
    }
    return false;
};

const hookFactories = {
    useState: (store: WeakAttrStore) => {
        return function useState<T>(this: State<T>, initialValue: T): [T, StateUpdater<T>] {
            if (this) {
                return this;
            }
            const contents: [T, StateUpdater<T>] = [
                initialValue,
                arg => {
                    const currentValue = contents[0];
                    if (typeof arg === "function") {
                        contents[0] = (arg as Function)(currentValue);
                    } else {
                        contents[0] = arg;
                    }
                    if (currentValue !== contents[0]) {
                        store.invalidate();
                    }
                },
            ];
            return contents;
        };
    },
    useEffect: (store: WeakAttrStore) => {
        return function useEffect(this: Effect, callback: EffectCallback, dependencies?: any[]) {
            if (this) {
                const [previousDependencies, previousTeardown] = this;
                const shouldRerun = getDependenciesChanged(previousDependencies, dependencies);
                if (shouldRerun) {
                    store.registerRunCallback(() => {
                        if (previousTeardown) {
                            previousTeardown();
                            store.unregisterDestroyCallback(previousTeardown);
                        }
                        const teardown = callback();
                        if (teardown) {
                            store.registerDestroyCallback(teardown);
                        }
                        this[0] = dependencies;
                        this[1] = teardown;
                    });
                }
                return this;
            }
            const contents = [];
            store.registerRunCallback(() => {
                const teardown = callback();
                if (teardown) {
                    store.registerDestroyCallback(teardown);
                }
                contents[0] = dependencies;
                contents[1] = teardown;
            });
            return contents;
        };
    },
    useRef: () => {
        return function useRef(this: Ref, initialValue: any) {
            if (this) {
                return this;
            }
            return { current: initialValue };
        };
    },
};

const hookEntries: [string, Function][] = Object.entries(hookFactories);
const hookIds: Record<string, number> = {};

hookEntries.forEach(([name], index) => {
    hookIds[name] = index;
});

const bindHook = (store: WeakAttrStore, hookName: string, hookFactory: Function) => {
    const hook = hookFactory(store);
    return (...args) => {
        const cell = store.getCurrentCell();
        let result;
        if (cell && cell.length === 2) {
            // Cell has already been created
            const [foundHookId, contents] = cell;
            if (foundHookId !== hookIds[hookName]) {
                throwError("Hooks called out of order.");
            }
            result = hook.call(contents, ...args);
            cell[1] = result;
        } else {
            // Cell is newly created.
            result = hook.call(null, ...args);
            cell[0] = hookIds[hookName];
            cell[1] = result;
        }
        store.incrementPointer();
        return result;
    };
};

const getBoundHooks = (store: WeakAttrStore) => {
    const boundHooks: Record<string, Function> = {};
    for (let i = 0; i < hookEntries.length; i++) {
        const [hookName, hookFn] = hookEntries[i];
        boundHooks[hookName] = bindHook(store, hookName, hookFn);
    }
    return boundHooks;
};

/**
 * Holds a weak reference to an AttrStore so that long-lived callbacks floating around in hooks-land
 * don't accidentally retain a reference to this store when its parent node has disappeared and it
 * could otherwise be garbage collected.
 */
class WeakAttrStore {
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

/**
 * Stores state associated with a single attribute on a single Node instance in the document.
 * An AttrStore works a little like a React component with hooks -- it holds a reference to a
 * function, and allows that function to be run over and over again, while holding onto stateful
 * context that it shares with that function via a set of "hooks" bound to `this` within the
 * function body. However, it does not store any state about the return result of the function --
 * that responsibility is left to the `NodeStore` which instantiates this class.
 *
 * Most of the methods of this class are public because they are designed to be accessed from
 * hooks bound to the instance at runtime -- they are not actually intended to be used by callers.
 */
export class AttrStore {
    private attr: string;
    private onInvalidate: OnInvalidate;
    private fn: ReactiveAttrFn;
    private isRunning = false;
    private cells: Cell[] = [];
    private cellPointer = 0;
    private hooks: Hooks;
    private destroyCallbacks: Set<Function> = new Set();
    private runCallbacks: Function[];
    private weakSelf: WeakAttrStore;

    /**
     *
     * @param attr The name of the attribute represented
     * @param fn The function which will be run to determine the attribute's value
     * @param globalHooks A set of globally-scoped hooks to provide to `fn`
     * @param onInvalidate Callback for when a hook (cough cough, `useState`)
     *  invalidates this store's value
     */
    constructor(attr: string, fn: ReactiveAttrFn, globalHooks: Hooks, onInvalidate: OnInvalidate) {
        this.attr = attr;
        this.fn = fn;
        this.onInvalidate = onInvalidate || noopInvalidate;
        this.weakSelf = new WeakAttrStore(this);
        this.hooks = { ...getBoundHooks(this.weakSelf), ...globalHooks };
    }

    invalidate() {
        if (this.isRunning) {
            throwError(
                "Hook invalidated while running (probably by updating a setState hook in your hook body)"
            );
        }
        this.onInvalidate(this.attr);
    }

    incrementPointer() {
        this.cellPointer++;
    }

    getCurrentCell() {
        if (!this.cells[this.cellPointer]) {
            this.cells[this.cellPointer] = [];
        }
        return this.cells[this.cellPointer];
    }

    registerRunCallback(callback: Function) {
        this.runCallbacks.push(callback);
    }

    registerDestroyCallback(callback: Function) {
        this.destroyCallbacks.add(callback);
    }

    unregisterDestroyCallback(callback: Function) {
        this.destroyCallbacks.delete(callback);
    }

    destroy() {
        this.weakSelf.destroy();
        [...this.destroyCallbacks].forEach(callback => callback());
    }

    /**
     * Given a `Node` instance, run `this.fn` on the node and return whatever we got.
     * @param node
     * @throws if hooks were called conditionally or out of order.
     */
    run(node: Node): ReactiveAttrUpdateResult {
        this.runCallbacks = [];
        this.cellPointer = 0;
        this.isRunning = true;
        const result = this.fn.call(this.hooks, node);
        this.isRunning = false;
        if (this.cellPointer !== this.cells.length) {
            throwError("Hooks called conditionally");
        }
        this.runCallbacks.forEach(callback => callback());
        return result;
    }
}
