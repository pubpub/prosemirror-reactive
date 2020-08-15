/* global describe, it, expect */
import { Node } from "prosemirror-model";

import { sheepDoc as sheepJson, counterAndHeaderDoc } from "../examples/docs";
import { createSchema, sheep, sheepNamer, counter, header } from "../examples/schemas";
import { getReactedDoc } from "../doc";

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

describe("getReactedDoc", () => {
    const idGenerator = getIdGenerator();

    it("computes a reacted doc", () => {
        const reactedDoc = getReactedDoc(sheepDoc, { missingIdGenerator: idGenerator });
        expect(reactedDoc).toMatchSnapshot();
    });

    it("computes another reacted doc", () => {
        const reactedDoc = getReactedDoc(doc, { missingIdGenerator: idGenerator });
        expect(reactedDoc).toMatchSnapshot();
    });
});
