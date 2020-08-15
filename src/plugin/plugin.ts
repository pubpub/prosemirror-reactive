import { Node } from "prosemirror-model";
import { Plugin, EditorState, Transaction } from "prosemirror-state";
import { EditorView, DecorationSet, Decoration } from "prosemirror-view";

import { DocumentStore } from "../store/documentStore";
import { warn } from "../store/util";

import { reactivePluginKey } from "./key";
import { PluginArgs, PluginState } from "./types";
import { createReactiveNodeViews } from "./nodeViews";

const createReactiveDecorationForNode = (from, to, cycleId, count) =>
    Decoration.node(from, to, {}, { "reactive-update": `${cycleId}-${count}` });

export const createReactivePlugin = ({ idAttrKey, schema, documentState = {} }: PluginArgs) => {
    let editorView: EditorView = null;

    const getInvalidatedNode = (transaction: Transaction): Node => {
        const reactiveTransaction = transaction.getMeta(reactivePluginKey);
        if (reactiveTransaction) {
            const { invalidatedNode } = reactiveTransaction;
            if (invalidatedNode) {
                return invalidatedNode;
            }
        }
        return null;
    };

    const invalidateNode = (node: Node) => {
        if (editorView) {
            const transaction = editorView.state.tr;
            transaction.setMeta(reactivePluginKey, { invalidatedNode: node });
            editorView.dispatch(transaction);
        } else {
            warn(
                `Dispatching an invalidation transaction for Node {nodeId} before the editor was initialized`
            );
        }
    };

    const store = new DocumentStore({
        nodeSpecs: schema.nodes,
        invalidateNode,
        idAttrKey,
        documentState,
    });

    const getDecorationSetForState = (editorState: EditorState, cycleId: any) => {
        const decorations = [];
        const invalidatedRanges = store.run(editorState.doc);
        for (const invalidatedId in invalidatedRanges) {
            const [from, to] = invalidatedRanges[invalidatedId];
            const decoration = createReactiveDecorationForNode(
                from,
                to,
                cycleId,
                decorations.length
            );
            decorations.push(decoration);
        }
        return DecorationSet.create(editorState.doc, decorations);
    };

    return new Plugin({
        key: reactivePluginKey,
        view: (view: EditorView) => {
            editorView = view;
            return {
                update: nextView => {
                    editorView = nextView;
                },
            };
        },
        props: {
            nodeViews: createReactiveNodeViews(schema, store),
            decorations: editorState => {
                return reactivePluginKey.getState(editorState).decorations;
            },
        },
        state: {
            init: (_, editorState): PluginState => {
                return {
                    store: store,
                    decorations: getDecorationSetForState(editorState, Date.now()),
                };
            },
            apply: (transaction, pluginState: PluginState, _, editorState) => {
                const cycleId = Date.now();
                const invalidatedNode = getInvalidatedNode(transaction);
                if (transaction.docChanged) {
                    return {
                        ...pluginState,
                        decorations: getDecorationSetForState(editorState, cycleId),
                    };
                } else if (invalidatedNode) {
                    let decoration;
                    editorState.doc.descendants((node, offset) => {
                        if (store.compareNodesById(invalidatedNode, node)) {
                            decoration = createReactiveDecorationForNode(
                                offset,
                                offset + node.nodeSize,
                                cycleId,
                                0
                            );
                        }
                    });
                    if (decoration) {
                        return {
                            ...pluginState,
                            decorations: DecorationSet.create(editorState.doc, [decoration]),
                        };
                    }
                }

                return pluginState;
            },
        },
    });
};

export const getReactedCopyOfNode = (node: Node, editorState: EditorState): Node => {
    const pluginState: PluginState = reactivePluginKey.getState(editorState);
    if (pluginState) {
        const { store } = pluginState;
        return store.getReactedCopy(node);
    }
    return null;
};
