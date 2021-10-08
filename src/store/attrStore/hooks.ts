import { throwError } from "../util";

import { WeakAttrStore } from "./weakAttrStore";
import { AttrHooks, Effect, EffectCallback, Ref, State, StateUpdater } from "./types";

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

export const bindHooksToStore = (store: WeakAttrStore) => {
    const boundHooks: Partial<AttrHooks> = {};
    for (let i = 0; i < hookEntries.length; i++) {
        const [hookName, hookFn] = hookEntries[i];
        boundHooks[hookName] = bindHook(store, hookName, hookFn);
    }
    return boundHooks as AttrHooks;
};

const hookFactories = {
    useState: (store: WeakAttrStore) => {
        return function useState<T>(this: State<T>, initialValue: T): [T, StateUpdater<T>] {
            if (this) {
                return this;
            }
            const contents: [T, StateUpdater<T>] = [
                typeof initialValue === "function" ? initialValue() : initialValue,
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
        return function useRef<T>(this: Ref<T>, initialValue: any) {
            if (this) {
                return this;
            }
            return { current: initialValue };
        };
    },
};

export type HookFactories = typeof hookFactories;

const hookEntries: [string, Function][] = Object.entries(hookFactories);
const hookIds: Record<string, number> = {};

hookEntries.forEach(([name], index) => {
    hookIds[name] = index;
});
