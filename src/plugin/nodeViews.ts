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
        const reactedNode = store.getReactedCopy(node);
        if (delegateView) {
            const delegate = delegateView(reactedNode, ...restArgs);
            const { update } = delegate;
            // Call the update function to make sure any expected side effects are run,
            // but throw away the result and return false so the node will definitely
            // continue to update reactively
            Object.assign(delegate, {
                update: (node, decorations) => {
                    if (typeof update === "function") {
                        update(node, decorations);
                    }
                    return false;
                },
            });
            return delegate;
        }
        const outputSpec = node.type.spec.toDOM(reactedNode || node);
        const { dom, contentDOM } = DOMSerializer.renderSpec(document, outputSpec);
        return {
            dom,
            contentDOM,
            update: () => false,
        };
    };
};

export const createReactiveNodeViews = (view: EditorView, schema: Schema, store: DocumentStore) => {
    const views = {};
    Object.values(schema.nodes).forEach(nodeType => {
        const { name, spec } = nodeType;
        if (spec.reactive) {
            const { nodeViews = {} } = view.props;
            const delegateView = nodeViews[name];
            views[name] = reactiveNodeView(store, delegateView);
        }
    });
    return views;
};
