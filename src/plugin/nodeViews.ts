import { DOMSerializer, Schema, Node } from "prosemirror-model";
import { EditorView, Decoration, NodeView } from "prosemirror-view";

import { DocumentStore } from "../store/documentStore";

type NodeViewArgs = [Node, EditorView, boolean | (() => number), Decoration[]];

const reactiveNodeView = (
    store: DocumentStore,
    delegateView: (...args: NodeViewArgs) => NodeView
) => {
    return (...args: NodeViewArgs) => {
        const [node, ...restArgs] = args;
        const possiblyReactedNode = store.getReactedCopy(node) || node;
        if (delegateView) {
            const delegate = delegateView(possiblyReactedNode, ...restArgs);
            const { update } = delegate;
            const boundUpdate = update && update.bind(delegate);
            Object.assign(delegate, {
                update: (node, decorations) => {
                    if (typeof boundUpdate === "function") {
                        const latestReactiveCopy = store.getReactedCopy(node) || node;
                        return boundUpdate(latestReactiveCopy, decorations);
                    }
                    return false;
                },
            });
            return delegate;
        }
        const outputSpec = node.type.spec.toDOM(possiblyReactedNode);
        const { dom, contentDOM } = DOMSerializer.renderSpec(document, outputSpec);
        return {
            dom,
            contentDOM,
            update: () => false,
        };
    };
};

const collectNodeViews = (view: EditorView) => {
    const result: Record<string, any> = {};
    view.someProp("nodeViews", obj => {
        for (const prop in obj) {
            if (!Object.prototype.hasOwnProperty.call(result, prop)) {
                result[prop] = obj[prop];
            }
        }
    });
    return result;
};

export const createReactiveNodeViews = (view: EditorView, schema: Schema, store: DocumentStore) => {
    const reactiveViews = {};
    const existingViews = collectNodeViews(view);
    Object.values(schema.nodes).forEach(nodeType => {
        const { name, spec } = nodeType;
        if (spec.reactive) {
            const delegateView = existingViews[name];
            reactiveViews[name] = reactiveNodeView(store, delegateView);
        }
    });
    return reactiveViews;
};
