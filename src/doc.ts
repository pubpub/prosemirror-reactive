import { Node } from "prosemirror-model";

import { DEFAULT_ID_ATTR_KEY } from "./constants";
import { addTemporaryIdsToDoc, mapDoc } from "./util";
import { DocumentStore } from "./store/documentStore";

interface GetReactedDocOptions {
    missingIdGenerator?: () => string;
    idAttrKey?: string;
    documentState?: Record<any, any>;
}

/**
 * Get a new document with all of the reactive attrs of a source document computed in a single run.
 * @param doc
 * @param schema
 * @param options
 */
export const getReactedDoc = (doc: Node, options: GetReactedDocOptions = {}): Node => {
    const { idAttrKey = DEFAULT_ID_ATTR_KEY, missingIdGenerator, documentState = {} } = options;
    const docWithIds = addTemporaryIdsToDoc(doc, idAttrKey, missingIdGenerator);
    const store = new DocumentStore({
        nodeSpecs: doc.type.schema.nodes,
        invalidateNode: () => {},
        idAttrKey,
        documentState,
    });
    const invalidatedIds = Object.keys(store.run(docWithIds));
    return mapDoc(docWithIds, (node: Node) => {
        const id = node.attrs && node.attrs[idAttrKey];
        if (invalidatedIds.includes(id)) {
            const copy = store.getReactedCopy(node);
            if (copy) {
                return copy;
            }
        }
        return node;
    });
};
