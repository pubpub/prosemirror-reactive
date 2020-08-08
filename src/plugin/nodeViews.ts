import { DOMSerializer, Schema, Node, NodeSpec } from "prosemirror-model";

import { DocumentStore } from "../store/documentStore";

class ReactiveNodeView {
    private store: DocumentStore;
    private spec: NodeSpec;
    dom: any;
    contentDOM: any;

    constructor(initialNode: Node, spec: NodeSpec, store: DocumentStore) {
        this.store = store;
        this.spec = spec;
        this.render(initialNode);
    }

    private render(node: Node) {
        const reactedNode = this.store.getReactedCopy(node);
        const outputSpec = this.spec.toDOM(reactedNode || node);
        const { dom, contentDOM } = DOMSerializer.renderSpec(document, outputSpec);
        this.dom = dom;
        this.contentDOM = contentDOM;
    }

    update(node: Node) {
        this.render(node);
        return false;
    }
}

export const createReactiveNodeViews = (schema: Schema, store: DocumentStore) => {
    const views = {};
    Object.values(schema.nodes).forEach(nodeType => {
        const { name, spec } = nodeType;
        if (spec.reactive) {
            views[name] = (node: Node) => new ReactiveNodeView(node, spec, store);
        }
    });
    return views;
};
