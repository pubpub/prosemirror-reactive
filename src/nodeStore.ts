import { Node } from "prosemirror-model";

import {
    AttrKey,
    NodeId,
    ReactiveAttrValue,
    ReactiveAttrsDefinition,
    ReactiveNodeUpdateResult,
    ReactiveAttrUpdateResult,
    ReactiveNodeUpdate,
} from "./types";
import { AttrStore } from "./attrStore";
import { DeferredResult, DeferredResultCallback } from "./deferredResult";
import { ReactiveStore } from "./reactiveStore";

type DeferredAttrResults = Record<AttrKey, DeferredResult<ReactiveAttrValue>>;

/**
 * A NodeStore contains stateful information about a Prosemirror node. It keeps no reference to
 * any `Node` object found in a document (which are transient and disposable anyway) and is intended
 * intended to be mapped by its caller to a stable node ID. This class is intended to be
 * instantiated by `ReactiveStore`.
 */
export class NodeStore {
    private parentStore: ReactiveStore;
    private nodeId: NodeId;
    private reactiveShadow: Node;
    private attrStores: Record<AttrKey, AttrStore> = {};
    private attrStates: Record<AttrKey, ReactiveAttrValue> = {};

    /**
     * Create a NodeStore
     * @param definition a set of `Node` attributes associated with hooks that will be used to
     *   derive their values.
     */
    constructor(nodeId: NodeId, definition: ReactiveAttrsDefinition, parentStore: ReactiveStore) {
        this.nodeId = nodeId;
        this.parentStore = parentStore;
        this.invalidateAttr = this.invalidateAttr.bind(this);
        const entries = Object.entries(definition);
        for (let i = 0; i < entries.length; i++) {
            const [attrName, attrFn] = entries[i];
            this.attrStores[attrName] = new AttrStore(
                attrName,
                attrFn,
                parentStore.getHooks(),
                this.invalidateAttr
            );
        }
    }

    private invalidateAttr(attr: AttrKey) {
        const possiblyDeferredResult = this.attrStores[attr].run(this.reactiveShadow);
        const result =
            possiblyDeferredResult instanceof DeferredResult
                ? possiblyDeferredResult.callback(this.parentStore.getAvailableNodes())
                : possiblyDeferredResult;
        const attrChanged = this.updateAttrState(attr, result);
        if (attrChanged) {
            this.parentStore.onInvalidateNode(this.nodeId);
        }
    }

    private updateReactiveClone(node: Node) {
        this.reactiveShadow = node.copy();
        this.reactiveShadow.attrs = { ...this.reactiveShadow.attrs, ...this.attrStates };
    }

    private updateAttrState(attr: AttrKey, value: ReactiveAttrValue): boolean {
        const previous = this.attrStates[attr];
        const attrChanged = value !== previous;
        this.attrStates[attr] = value;
        this.reactiveShadow.attrs[attr] = value;
        return attrChanged;
    }

    private getDeferredResult(
        partialHasNodeChanged: boolean,
        deferredAttrResults: DeferredAttrResults
    ): DeferredResult<ReactiveNodeUpdate> {
        const entries = Object.entries(deferredAttrResults);
        const requestedNodeIds = new Set<NodeId>();
        const callbacks: DeferredResultCallback<ReactiveAttrValue>[] = [];
        for (let i = 0; i < entries.length; i++) {
            const [_, deferredResult] = entries[i];
            deferredResult.requestedNodeIds.forEach(id => requestedNodeIds.add(id));
            callbacks.push(deferredResult.callback);
        }
        return new DeferredResult(requestedNodeIds, requestedNodes => {
            let hasNodeChanged = partialHasNodeChanged;
            for (let i = 0; i < callbacks.length; i++) {
                const attr = entries[i][0];
                const nextValue = callbacks[i](requestedNodes);
                const hasAttrChanged = this.updateAttrState(attr, nextValue);
                hasNodeChanged = hasNodeChanged || hasAttrChanged;
            }
            return [hasNodeChanged, this.reactiveShadow];
        });
    }

    destroy() {
        Object.values(this.attrStores).forEach(store => store.destroy());
    }

    /**
     * Updates the reactive store for every reactive attribute associated with this `Node`.
     * Returns a boolean indicating whether this run changed the attributes associated with this
     * Node, or a `DeferredResult` requesting a reference to some other `Node` instances.
     * @param node The node to update against.
     * @param documentState Global, mutable state for the document
     * @param transactionState Global, mutable state for the current transaction
     */
    run(node: Node): ReactiveNodeUpdateResult {
        this.updateReactiveClone(node);
        const results: Record<AttrKey, ReactiveAttrUpdateResult> = {};
        for (const key in this.attrStores) {
            const store = this.attrStores[key];
            results[key] = store.run(node);
        }
        let hasNodeChanged = false;
        const deferredResults: DeferredAttrResults = {};
        for (const attr in results) {
            const result = results[attr];
            if (result instanceof DeferredResult) {
                deferredResults[attr] = result;
            } else {
                const hasAttrChanged = this.updateAttrState(attr, result);
                hasNodeChanged = hasNodeChanged || hasAttrChanged;
            }
        }
        if (Object.keys(deferredResults).length > 0) {
            return this.getDeferredResult(hasNodeChanged, deferredResults);
        } else {
            return [hasNodeChanged, this.reactiveShadow];
        }
    }
}
