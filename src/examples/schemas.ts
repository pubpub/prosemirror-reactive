import { ReactiveNodeSpec } from "../store/types";
import { Schema } from "prosemirror-model";

const doc: ReactiveNodeSpec = {
    content: "block+",
};

const text = {
    inline: true,
    group: "inline",
};

const paragraph: ReactiveNodeSpec = {
    content: "inline*",
    group: "block",
};

export const greeter: ReactiveNodeSpec = {
    attrs: {
        name: {},
    },
    reactiveAttrs: {
        greeting: function(node) {
            return `Hello, ${node.attrs.name}!`;
        },
    },
};

export const calculator: ReactiveNodeSpec = {
    attrs: {
        x: {},
        y: {},
    },
    reactiveAttrs: {
        sum: function({ attrs }) {
            return attrs.x + attrs.y;
        },
        product: function({ attrs }) {
            return attrs.x * attrs.y;
        },
    },
};

export const concatenator: ReactiveNodeSpec = {
    attrs: {
        a: {},
        b: {},
    },
    reactiveAttrs: {
        ab: function({ attrs }) {
            return attrs.a + attrs.b;
        },
        ba: function({ attrs }) {
            return attrs.b + attrs.a;
        },
    },
};

export const food: ReactiveNodeSpec = {
    attrs: {
        id: {},
        color: {},
    },
};

export const feedMe: ReactiveNodeSpec = {
    attrs: {
        wantsToEatId: {},
    },

    reactiveAttrs: {
        report: function({ attrs }) {
            const { useDeferredNode } = this;
            return useDeferredNode(attrs.wantsToEatId, food => `yum, ${food.attrs.color}!`);
        },
    },
};

export const feedMeMore: ReactiveNodeSpec = {
    attrs: {
        wantsToEatIds: {},
    },

    reactiveAttrs: {
        report: function({ attrs }) {
            const { useDeferredNode } = this;
            return useDeferredNode(
                attrs.wantsToEatIds,
                (first, second) => `yum, ${first.attrs.color} and ${second.attrs.color}!`
            );
        },
    },
};

export const box: ReactiveNodeSpec = {
    attrs: {
        id: {},
        value: {},
    },
};

export const boxOpener: ReactiveNodeSpec = {
    attrs: {
        value: {},
        lookForBoxId: {},
    },
    reactiveAttrs: {
        myValue: function(node) {
            return node.attrs.value;
        },
        boxValue: function(node) {
            const { useDeferredNode } = this;
            return useDeferredNode(node.attrs.lookForBoxId, box => box.attrs.value);
        },
    },
};

export const sheep: ReactiveNodeSpec = {
    attrs: {
        id: {},
        name: {},
    },
};

export const sheepCounter: ReactiveNodeSpec = {
    attrs: {
        id: {},
        skip: { default: 1 },
    },

    reactiveAttrs: {
        report: function(node) {
            const { useState, useEffect } = this;
            const [sheepCount, setSheepCount] = useState(0);

            useEffect(() => {
                const interval = setInterval(() => setSheepCount(c => c + 1), 1000);
                return () => clearInterval(interval);
            }, []);

            return `I have counted ${Math.floor(sheepCount / node.attrs.skip)} sheep`;
        },
    },
};

export const sheepNamer: ReactiveNodeSpec = {
    reactiveAttrs: {
        report: function() {
            const { useState, useEffect, useDeferredNode } = this;
            const [sheepIndex, setSheepIndex] = useState(0);

            useEffect(() => {
                const interval = setInterval(() => setSheepIndex(i => i + 1), 1000);
                return () => clearInterval(interval);
            }, []);

            return useDeferredNode(`sheep-${sheepIndex}`, sheepNode => {
                if (sheepNode) {
                    return `Sheep ${sheepIndex} is named ${sheepNode.attrs.name}`;
                }
                return "I don't see any more sheep";
            });
        },
    },
};

export const createSchema = (nodes: Record<string, ReactiveNodeSpec>): Schema => {
    return new Schema({ nodes: { doc, text, paragraph, ...nodes }, topNode: "doc" });
};
