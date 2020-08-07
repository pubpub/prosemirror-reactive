import { Node } from "prosemirror-model";
import { NodeId } from "./types";

type ManyNodeIds = NodeId | NodeId[] | Set<NodeId>;
export type DeferredResultCallback<T> = (requestedNodesById: Record<NodeId, Node>) => T;

const getSetOfIds = (ids: ManyNodeIds) => {
    if (ids instanceof Set || Array.isArray(ids)) {
        return new Set(ids);
    }
    return new Set([ids]);
};

/**
 * Represents a set of node IDs that a store needs to ask its parent about in order to finish
 * resolving. The ultimate source of these results is the `useDeferredNode()` hook, which allows
 * attributes to ask for values from other nodes before resolving.
 */
export class DeferredResult<T> {
    callback: DeferredResultCallback<T>;
    requestedNodeIds: Set<NodeId>;

    constructor(requestedNodeIds: ManyNodeIds, callback: DeferredResultCallback<T>) {
        this.requestedNodeIds = getSetOfIds(requestedNodeIds);
        this.callback = callback;
    }
}
