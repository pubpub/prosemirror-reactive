/* global it, expect, jest */

import {
    calculator,
    concatenator,
    createSchema,
    feedMe,
    feedMeMore,
    food,
    box,
    boxOpener,
    sheep,
    sheepCounter,
    sheepNamer,
} from "../../examples/schemas";
import { Node } from "prosemirror-model";
import { DocumentStore } from "../documentStore";
import { NodeStore } from "../nodeStore";
import { ReactiveNodeUpdate } from "../types";
import { DeferredResult } from "../deferredResult";

const schema = createSchema({
    calculator,
    concatenator,
    feedMe,
    feedMeMore,
    food,
    box,
    boxOpener,
    sheep,
    sheepCounter,
    sheepNamer,
});

const documentStore = new DocumentStore({ nodeSpecs: schema.nodes });

const createStore = (node, parentStore = documentStore) =>
    new NodeStore(node.attrs.id || "whatever", node.type.spec.reactiveAttrs, parentStore);

jest.useFakeTimers();

it("computes reactive attrs for a node", () => {
    const node = Node.fromJSON(schema, { type: "calculator", attrs: { x: 3, y: 6 } });
    const store = createStore(node);
    const [changed, reactedNode] = store.run(node) as ReactiveNodeUpdate;
    expect(changed).toEqual(true);
    expect(reactedNode.attrs.product).toEqual(18);
    expect(reactedNode.attrs.sum).toEqual(9);
});

it("reports changes only when any reactive attrs have changed", () => {
    let node = Node.fromJSON(schema, { type: "concatenator", attrs: { a: "a", b: "b" } });
    const store = createStore(node);

    let result = store.run(node) as ReactiveNodeUpdate;
    expect(result[0]).toEqual(true);

    node = Node.fromJSON(schema, { type: "concatenator", attrs: { a: "ab", b: "" } });
    result = store.run(node) as ReactiveNodeUpdate;
    expect(result[0]).toEqual(true);

    node = Node.fromJSON(schema, { type: "concatenator", attrs: { a: "", b: "ab" } });
    result = store.run(node) as ReactiveNodeUpdate;
    expect(result[0]).toEqual(false);
});

it("computes a reactive node involving a useDeferredNode call", () => {
    const apple = Node.fromJSON(schema, { type: "food", attrs: { id: "apple", color: "red" } });
    const hungryForApple = Node.fromJSON(schema, {
        type: "feedMe",
        attrs: { wantsToEatId: "apple" },
    });
    const store = createStore(hungryForApple);
    const result = store.run(hungryForApple) as DeferredResult<ReactiveNodeUpdate>;
    expect(result).toBeInstanceOf(DeferredResult);
    expect(result.requestedNodeIds).toEqual(new Set(["apple"]));

    const [changed, reactedNode] = result.callback({ apple }) as ReactiveNodeUpdate;
    expect(changed).toEqual(true);
    expect(reactedNode.attrs.report).toEqual("yum, red!");
});

it("computes a reactive node involving a useDeferredNode call for multiple nodes", () => {
    const apple = Node.fromJSON(schema, { type: "food", attrs: { id: "apple", color: "red" } });
    const pear = Node.fromJSON(schema, { type: "food", attrs: { id: "pear", color: "green" } });
    const banana = Node.fromJSON(schema, {
        type: "food",
        attrs: { id: "banana", color: "yellow" },
    });

    const veryHungry = Node.fromJSON(schema, {
        type: "feedMeMore",
        attrs: { wantsToEatIds: ["apple", "pear"] },
    });

    const store = createStore(veryHungry);
    const result = store.run(veryHungry) as DeferredResult<ReactiveNodeUpdate>;
    expect(result).toBeInstanceOf(DeferredResult);
    expect(result.requestedNodeIds).toEqual(new Set(["apple", "pear"]));

    // A well-written callback would check for the existence of the nodes it requested, but this
    // one doesn't, so it will throw an error.
    expect(() => result.callback({ apple, banana })).toThrow();

    const [changed, reactedNode] = result.callback({ apple, pear }) as ReactiveNodeUpdate;
    expect(changed).toEqual(true);
    expect(reactedNode.attrs.report).toEqual("yum, red and green!");
});

it("computes change values correctly across DeferredValue boundaries", () => {
    const boxA = Node.fromJSON(schema, { type: "box", attrs: { id: "boxA", value: "yes" } });
    const boxB = Node.fromJSON(schema, { type: "box", attrs: { id: "boxB", value: "yes" } });
    const boxC = Node.fromJSON(schema, { type: "box", attrs: { id: "boxB", value: "no" } });
    const boxes = { boxA, boxB, boxC };

    [
        {
            before: { value: "yes", lookForBoxId: "boxA" },
            after: { value: "no", lookForBoxId: "boxA" },
            expectChanged: true,
        },
        {
            before: { value: "yes", lookForBoxId: "boxA" },
            after: { value: "yes", lookForBoxId: "boxB" },
            expectChanged: false,
        },
        {
            before: { value: "no", lookForBoxId: "boxA" },
            after: { value: "no", lookForBoxId: "boxC" },
            expectChanged: true,
        },
        {
            before: { value: "yes", lookForBoxId: "boxA" },
            after: { value: "no", lookForBoxId: "boxC" },
            expectChanged: true,
        },
    ].forEach(({ before, after, expectChanged }) => {
        const nodeBefore = Node.fromJSON(schema, { type: "boxOpener", attrs: before });
        const nodeAfter = Node.fromJSON(schema, { type: "boxOpener", attrs: after });
        const store = createStore(nodeBefore);

        // Populate the store
        (store.run(nodeBefore) as DeferredResult<ReactiveNodeUpdate>).callback(boxes);

        // Run the store again and look for changes
        const dr = store.run(nodeAfter) as DeferredResult<ReactiveNodeUpdate>;
        const [changed] = dr.callback(boxes);
        expect(changed).toEqual(expectChanged);
    });
});

it("correctly invalidates nodes when their values change", () => {
    const invalidate = jest.fn();

    const rs = new DocumentStore({
        nodeSpecs: schema.nodes,
        invalidateNodeId: invalidate,
    });

    const awake = Node.fromJSON(schema, { type: "sheepCounter", attrs: { skip: 1, id: "awake" } });
    const sleepy = Node.fromJSON(schema, {
        type: "sheepCounter",
        attrs: { skip: 2, id: "sleepy" },
    });

    const awakeStore = createStore(awake, rs);
    const sleepyStore = createStore(sleepy, rs);

    expect(awakeStore.run(awake)[1].attrs.report).toEqual("I have counted 0 sheep");
    expect(sleepyStore.run(sleepy)[1].attrs.report).toEqual("I have counted 0 sheep");

    jest.advanceTimersByTime(1000);
    expect(invalidate).toHaveBeenNthCalledWith(1, "awake");

    jest.advanceTimersByTime(1000);
    expect(invalidate).toHaveBeenNthCalledWith(2, "awake");
    expect(invalidate).toHaveBeenNthCalledWith(3, "sleepy");

    jest.advanceTimersByTime(1000);
    expect(invalidate).toHaveBeenNthCalledWith(4, "awake");

    jest.advanceTimersByTime(1000);
    expect(invalidate).toHaveBeenNthCalledWith(5, "awake");
    expect(invalidate).toHaveBeenNthCalledWith(6, "sleepy");

    expect(awakeStore.getReactiveCopy().attrs.report).toEqual("I have counted 4 sheep");
    expect(sleepyStore.getReactiveCopy().attrs.report).toEqual("I have counted 2 sheep");
});

it("correctly invalidates nodes when their values change across a DeferredValue boundary", () => {
    const invalidate = jest.fn();

    const sheep = {
        "sheep-0": Node.fromJSON(schema, {
            type: "sheep",
            attrs: { id: `sheep-0`, name: "Shaun" },
        }),
        "sheep-1": Node.fromJSON(schema, {
            type: "sheep",
            attrs: { id: `sheep-1`, name: "Shelly" },
        }),
        "sheep-2": Node.fromJSON(schema, {
            type: "sheep",
            attrs: { id: `sheep-2`, name: "Sharon" },
        }),
    };

    const rs = new DocumentStore({
        nodeSpecs: schema.nodes,
        invalidateNodeId: invalidate,
        availableNodes: { ...sheep },
    });

    const namer = Node.fromJSON(schema, { type: "sheepNamer" });
    const store = createStore(namer, rs);

    const dr = store.run(namer) as DeferredResult<ReactiveNodeUpdate>;
    const [_, result] = dr.callback(sheep);
    expect(result.attrs.report).toEqual("Sheep 0 is named Shaun");

    jest.advanceTimersToNextTimer();
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(store.getReactiveCopy().attrs.report).toEqual("Sheep 1 is named Shelly");

    jest.advanceTimersToNextTimer();
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(store.getReactiveCopy().attrs.report).toEqual("Sheep 2 is named Sharon");

    jest.advanceTimersToNextTimer();
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(store.getReactiveCopy().attrs.report).toEqual("I don't see any more sheep");
});
