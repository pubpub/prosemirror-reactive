import { Node, Schema } from "prosemirror-model";

import { DEFAULT_ID_ATTR_KEY } from "./constants";

type OnNode = (node: Node) => Node;

export const mapDoc = (doc: Node, onNode: OnNode): Node => {
    const schema: Schema = doc.type.schema;
    const innerMap = (node: Node): Node => {
        if (node.type.name === "text") {
            const copy = schema.text(node.text, node.marks);
            return copy;
        }
        const content: Node[] = [];
        if (node.childCount) {
            for (let i = 0; i < node.childCount; i++) {
                const child = innerMap(node.child(i));
                content.push(child);
            }
        }
        const copy = node.type.create(node.attrs, content);
        return onNode(copy);
    };

    return innerMap(doc);
};

const defaultIdGenerator = () => Math.round(Math.random() * 1e10).toString();

export const addTemporaryIdsToDoc = (
    doc: Node,
    idAttrKey: string = DEFAULT_ID_ATTR_KEY,
    idGenerator: () => string = defaultIdGenerator
): Node =>
    mapDoc(doc, (node: Node) => {
        const { spec } = node.type;
        if (spec.attrs && spec.attrs[idAttrKey] && node.attrs && !node.attrs[idAttrKey]) {
            node.attrs = { ...node.attrs, [idAttrKey]: idGenerator() };
        }
        return node;
    });
