/* global describe, it, expect */
import { Node } from "prosemirror-model";

import { addTemporaryIdsToDoc } from "../util";
import { sheepDoc as sheepJson, counterAndHeaderDoc } from "../examples/docs";
import { createSchema, sheep, sheepNamer, counter, header } from "../examples/schemas";

const schema = createSchema({ counter, header });
const doc = Node.fromJSON(schema, counterAndHeaderDoc);

const sheepSchema = createSchema({ sheep, sheepNamer });
const sheepDoc = Node.fromJSON(sheepSchema, sheepJson);

const getIdGenerator = () => {
    let id = 0;
    return () => {
        id++;
        return id.toString();
    };
};

describe("addTemporaryIdsToDoc", () => {
    const idGenerator = getIdGenerator();

    it("adds IDs to a doc where they are missing", () => {
        const docWithIds = addTemporaryIdsToDoc(sheepDoc, "id", idGenerator);
        expect(docWithIds).toMatchSnapshot();
    });

    it("adds IDs to a somewhat more realistic doc", () => {
        const docWithIds = addTemporaryIdsToDoc(doc, "id", idGenerator);
        expect(docWithIds).toMatchSnapshot();
    });
});
