import { Node } from "prosemirror-model";

import { setCurrentHooks } from "../../globalHooks";
import { Hooks, DocumentHooks, ReactiveAttrFn, ReactiveAttrUpdateResult } from "../types";
import { warn, throwError } from "../util";

import { bindHooksToStore } from "./hooks";
import { Cell, OnInvalidate } from "./types";
import { WeakAttrStore } from "./weakAttrStore";

const noopInvalidate = () => {
    warn(
        "An invalidate function was not provided to an attrStore, meaning state updates will not propagate to the document."
    );
};

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
    private cells: Cell[] = [];
    private cellPointer = 0;
    private hooks: Hooks;
    private destroyCallbacks: Set<Function> = new Set();
    private runCallbacks: Function[];
    private weakSelf: WeakAttrStore;

    /**
     * @param attr The name of the attribute represented
     * @param fn The function which will be run to determine the attribute's value
     * @param documentHooks A set of document-scoped hooks to provide to `fn`
     * @param onInvalidate Callback for when a hook (cough cough, `useState`)
     *  invalidates this store's value
     */
    constructor(
        attr: string,
        fn: ReactiveAttrFn,
        documentHooks: DocumentHooks,
        onInvalidate: OnInvalidate
    ) {
        this.attr = attr;
        this.fn = fn;
        this.onInvalidate = onInvalidate || noopInvalidate;
        this.weakSelf = new WeakAttrStore(this);
        this.hooks = { ...bindHooksToStore(this.weakSelf), ...documentHooks };
    }

    invalidate() {
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
        setCurrentHooks(this.hooks);
        const result = this.fn(node);
        if (this.cellPointer !== this.cells.length) {
            throwError("Hooks called conditionally");
        }
        this.runCallbacks.forEach(callback => callback());
        return result;
    }
}
