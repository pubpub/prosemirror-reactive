import { NodeType, Node } from "prosemirror-model";

import {
    ReactiveNodeSpec,
    ReactiveAttrsDefinition,
    NodeId,
    ReactiveNodeUpdate,
    Hooks,
    AttrKey,
} from "./types";
import { ReactiveMap } from "./reactiveMap";
import { NodeStore } from "./nodeStore";
import { DeferredResult } from "./deferredResult";
import { assertCanCreateReactiveNodeStore } from "./util";

type Range = [number, number];
type RangeMap = Record<NodeId, Range>;
type InvalidateNode = (node: Node) => void;

interface ConstructorArgs {
    nodeSpecs: Record<string, NodeType>;
    idAttrKey?: string;
    invalidateNode?: InvalidateNode;
    availableNodes?: Record<NodeId, Node>;
}

export class DocumentStore {
    private reactiveAttrsDefinitions: Record<AttrKey, ReactiveAttrsDefinition> = {};
    private nodeStores: Record<NodeId, NodeStore> = {};
    private availableNodes: Record<NodeId, Node>;
    private documentState: ReactiveMap = new ReactiveMap();
    private transactionState: ReactiveMap;
    private idAttrKey: AttrKey;
    private invalidateNode: InvalidateNode;

    private hooks = {
        useDocumentState: (...args) => this.documentState.get(...args),
        useTransactionState: (...args) => this.transactionState.get(...args),
        useDeferredNode: (nodeIds, callback) =>
            new DeferredResult(nodeIds, (nodesById: Record<NodeId, Node>) => {
                const resolvedNodes = [];
                if (Array.isArray(nodeIds)) {
                    nodeIds.forEach(id => resolvedNodes.push(nodesById[id]));
                } else {
                    resolvedNodes.push(nodesById[nodeIds]);
                }
                return callback(...resolvedNodes);
            }),
    };

    constructor({
        nodeSpecs,
        idAttrKey = "id",
        invalidateNode,
        availableNodes = {},
    }: ConstructorArgs) {
        this.invalidateNode = invalidateNode;
        this.availableNodes = availableNodes;
        this.onInvalidateNode = this.onInvalidateNode.bind(this);
        this.idAttrKey = idAttrKey;
        this.createReactiveAttrDefinitions(nodeSpecs);
    }

    private createReactiveAttrDefinitions(nodeSpecs: Record<string, NodeType>) {
        // For every reactive node, extract its reactive attribute definitions into a template
        // object for quick and easy instantiation of NodeStore objects.
        Object.values(nodeSpecs).forEach(type => {
            const { name, spec } = type;
            if (spec.reactive) {
                const reactiveSpec = spec as ReactiveNodeSpec;
                assertCanCreateReactiveNodeStore(name, reactiveSpec, this.idAttrKey);
                this.reactiveAttrsDefinitions[name] = reactiveSpec.reactiveAttrs;
            }
        });
    }

    private getStoreForNode(node: Node): NodeStore {
        const {
            type: { name, spec },
            attrs: { [this.idAttrKey]: id },
        } = node;
        if (id && spec.reactive) {
            const existingStore = this.nodeStores[id];
            if (existingStore) {
                return existingStore;
            }
            const reactiveDefinition = this.reactiveAttrsDefinitions[name];
            const createdStore = new NodeStore(reactiveDefinition, this);
            this.nodeStores[id] = createdStore;
            return createdStore;
        }
        return null;
    }

    /**
     * Tell the caller that a node has invalidated, and needs to be redrawn. This is typically
     * called outside the Prosemirror transaction lifecycle when an attr updates from within via a
     * `useState` update.
     * @param node
     */
    onInvalidateNode(node: Node) {
        if (this.onInvalidateNode) {
            this.invalidateNode(node);
        }
    }

    /**
     * Get an object mapping IDs to `Node` object for every node the store knows about.
     * @param nodeId
     */
    getAvailableNodes() {
        return this.availableNodes;
    }

    /**
     * Get a reacted copy of a given node. If `run` has not been called, or the node in question
     * does not exist or is not reactive, this will return `null`.
     * @param nodeId
     */
    getReactedCopy(node: Node) {
        if (node.attrs) {
            const { [this.idAttrKey]: nodeId } = node.attrs;
            if (this.nodeStores[nodeId]) {
                return this.availableNodes[nodeId];
            }
        }
        return null;
    }

    /**
     * Get the hooks provided by the reactive store.
     */
    getHooks(): Hooks {
        return this.hooks;
    }

    /**
     * Returns `true` if the two nodes have the same value for `idAttrKey`.
     * @param a
     * @param b
     */
    compareNodesById(a: Node, b: Node) {
        return (
            a.attrs &&
            b.attrs &&
            a.attrs[this.idAttrKey] &&
            b.attrs[this.idAttrKey] &&
            a.attrs[this.idAttrKey] === b.attrs[this.idAttrKey]
        );
    }

    /**
     * React a document and return information about which nodes have been invalidated (and need to
     * be redrawn).
     * @param document A document to react.
     * @returns an object mapping invalidated node IDs to their flattened position in the document.
     *   This is a useful structure for immediately drawing a set of invalidation decorations.
     *   To actually find out what it's in a node, the caller will probably also want to use
     *   the store's `getReactedNode` method.
     */
    run(document: Node): RangeMap {
        // Create a new piece of state with the lifetime of this transaction for nodes to use.
        this.transactionState = new ReactiveMap();

        // Touch every node in the document and note the position we saw it at.
        const seenNodesById: Record<NodeId, Node> = {};
        const seenNodeRangesById: RangeMap = {};
        document.descendants((node: Node, pos: number) => {
            const { [this.idAttrKey]: id } = node.attrs;
            if (id) {
                seenNodesById[id] = node;
                seenNodeRangesById[id] = [pos, pos + node.nodeSize];
            }
        });

        // Check every node that we saw in the document. If it's a reactive node, update its store.
        // If the node changed, mark it as invalidated. If we got a DeferredResult back from the
        // node, that means it's asking for a result from _another_ node (which may be resolved
        // before or after it here). Hold onto that DeferredResult -- we'll resolve it shortly.
        const deferredResultsById: Record<NodeId, DeferredResult<ReactiveNodeUpdate>> = {};
        // Also hold on to every reacted node and every non-reactive node (these will be used to
        // resolve any DeferredResults we get)
        const availableNodesById: Record<NodeId, Node> = {};
        // Record all notes that are invalidated and need to be redrawn.
        const invalidatedNodeIds = [];
        for (const id in seenNodesById) {
            const node = seenNodesById[id];
            const store = this.getStoreForNode(node);
            if (store) {
                const nodeResult = store.run(node);
                if (nodeResult instanceof DeferredResult) {
                    deferredResultsById[id] = nodeResult;
                } else {
                    const [nodeChanged, reactedNode] = nodeResult;
                    availableNodesById[id] = reactedNode;
                    if (nodeChanged) {
                        invalidatedNodeIds.push(id);
                    }
                }
            } else {
                availableNodesById[id] = node;
            }
        }

        // Now try to resolve all of the DeferredResults by feeding them a Record<NodeId, Node>
        // containing all of the (possibly reacted) nodes we saw in this run. This loop should run
        // (depth of dependency tree) times -- so if C defers to B defers to A, we will have
        // resolved A in the previous section, we'll resolve B in the first do/while iteration, and
        // then C in the second and final iteration. This does mean that a dependency cycle will
        // put us in an infinite loop.
        do {
            for (const deferringNodeId in deferredResultsById) {
                const { callback, requestedNodeIds } = deferredResultsById[deferringNodeId];
                // We are ready to resolve this node if none of the node IDs it is requesting are
                // also currently deferring.
                const dependsOnDeferring = [...requestedNodeIds].some(id => !!deferringNodeId[id]);
                if (!dependsOnDeferring) {
                    // Give this a map containing every node (reactive or not) we've seen so far.
                    // Ultimately, these will end up getting passed into a useDeferredNode callback.
                    const [nodeChanged, reactedNode] = callback(availableNodesById);
                    // Now other deferring nodes can reference this one!
                    availableNodesById[deferringNodeId] = reactedNode;
                    if (nodeChanged) {
                        invalidatedNodeIds.push(deferringNodeId);
                    }
                    // Mark this as done so no other deferring nodes block on it.
                    delete deferredResultsById[deferringNodeId];
                }
            }
        } while (Object.keys(deferredResultsById).length > 0);

        // Hold onto this for callers to ask for later.
        this.availableNodes = availableNodesById;

        // Destroy the store for any reactive node that has disappeared from the doc.
        // for (const storeId in this.nodeStores) {
        //     if (!this.availableNodes[storeId]) {
        //         this.nodeStores[storeId].destroy();
        //         delete this.nodeStores[storeId];
        //     }
        // }

        // Finally, tell the caller about every invalidated node we saw.
        const invalidationMap: RangeMap = {};
        for (let i = 0; i < invalidatedNodeIds.length; i++) {
            const nodeId = invalidatedNodeIds[i];
            invalidationMap[nodeId] = seenNodeRangesById[nodeId];
        }
        return invalidationMap;
    }
}
