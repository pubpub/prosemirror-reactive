/* global it, expect, jest */
import { Node } from "prosemirror-model";

import { AttrStore } from "../attrStore";

jest.useFakeTimers();

const testNode = ({
    attrs: {
        greeting: "Good morning!",
    },
} as unknown) as Node;

const createTestStore = (fn, globalHooks = {}, onInvalidate?) =>
    new AttrStore("anything", fn, globalHooks, onInvalidate);

it("runs an attr that can access the current Node value", () => {
    const attr = createTestStore(function stateCell(node) {
        return node.attrs.greeting;
    });
    const result = attr.run(testNode);
    expect(result).toEqual("Good morning!");
});

it("runs an attr that can access the current global hooks", () => {
    const attr = createTestStore(
        function stateCell() {
            return this.use3();
        },
        { use3: () => 3 }
    );
    const result = attr.run(testNode);
    expect(result).toEqual(3);
});

it("runs an attr with a useState call", () => {
    const attr = createTestStore(function stateCell() {
        const { useState } = this;
        const [someState] = useState("hello!");
        return someState;
    });
    const result = attr.run(testNode);
    expect(result).toEqual("hello!");
});

it("runs an attr with a useState and a useEffect call", () => {
    const attr = createTestStore(function stateCell() {
        const { useState, useEffect } = this;
        const [count, setCount] = useState(0);

        // In a ReactiveStore this would trigger an infinite loop
        useEffect(() => setCount(oldCount => oldCount + 1));

        return count;
    });

    for (let i = 0; i < 10; i++) {
        const result = attr.run(testNode);
        expect(result).toEqual(i);
    }
});

it("runs another attr that uses both useState and useEffect", () => {
    const node = {} as Node;

    const attr = createTestStore(function() {
        const { useState, useEffect } = this;
        const [count, setCount] = useState(37);

        useEffect(() => {
            setTimeout(() => setCount(count => count + 1), 1000);
        }, []);

        return count;
    });

    expect(attr.run(node)).toEqual(37);
    jest.advanceTimersToNextTimer();
    expect(attr.run(node)).toEqual(38);
});

it("re-runs a useEffect hook only when its dependencies change", () => {
    const callbackFn = jest.fn();
    const teardownFn = jest.fn();
    const node = {} as Node;

    let a = 1;
    let b = 5;

    const attr = createTestStore(function() {
        const { useEffect } = this;
        useEffect(() => {
            callbackFn();
            return teardownFn;
        }, [a, b]);
        return "";
    });

    attr.run(node);
    expect(callbackFn).toHaveBeenCalledTimes(1);
    expect(teardownFn).toHaveBeenCalledTimes(0);

    attr.run(node);
    expect(callbackFn).toHaveBeenCalledTimes(1);
    expect(teardownFn).toHaveBeenCalledTimes(0);

    a = 2;
    attr.run(node);
    expect(callbackFn).toHaveBeenCalledTimes(2);
    expect(teardownFn).toHaveBeenCalledTimes(1);

    attr.run(node);
    expect(callbackFn).toHaveBeenCalledTimes(2);
    expect(teardownFn).toHaveBeenCalledTimes(1);

    b = 6;
    attr.run(node);
    expect(callbackFn).toHaveBeenCalledTimes(3);
    expect(teardownFn).toHaveBeenCalledTimes(2);
});

it("tears down a useEffect hook as expected", () => {
    const firstTeardown = jest.fn();
    const secondTeardown = jest.fn();

    let useFirstTeardown = true;

    const attr = createTestStore(function() {
        const { useEffect } = this;
        useEffect(() => {
            return useFirstTeardown ? firstTeardown : secondTeardown;
        });
        return "";
    });

    attr.run(testNode);
    expect(firstTeardown).toHaveBeenCalledTimes(0);

    attr.run(testNode);
    expect(firstTeardown).toHaveBeenCalledTimes(1);

    useFirstTeardown = false;
    attr.run(testNode);
    expect(firstTeardown).toHaveBeenCalledTimes(2);
    expect(secondTeardown).toHaveBeenCalledTimes(0);

    attr.destroy();
    expect(firstTeardown).toHaveBeenCalledTimes(2);
    expect(secondTeardown).toHaveBeenCalledTimes(1);
});

it("invalidates when its state changes", () => {
    const invalidator = jest.fn();

    const attr = createTestStore(
        function() {
            const { useEffect, useState } = this;
            const [ready, setReady] = useState(false);

            useEffect(() => {
                setTimeout(() => setReady(true), 1000);
            });

            return ready;
        },
        {},
        invalidator
    );

    attr.run(testNode);
    jest.advanceTimersToNextTimer();
    expect(invalidator).toHaveBeenCalled();
});

it("does not invalidate when setState is called, but does not change the state", () => {
    const invalidator = jest.fn();

    const attr = createTestStore(
        function() {
            const { useEffect, useState } = this;
            const [ready, setReady] = useState(false);

            useEffect(() => {
                setTimeout(() => setReady(false), 1000);
            });

            return ready;
        },
        {},
        invalidator
    );

    attr.run(testNode);
    jest.advanceTimersToNextTimer();
    expect(invalidator).not.toHaveBeenCalled();
});

it("does not invalidate after it has been destroyed", () => {
    const invalidator = jest.fn();

    const attr = createTestStore(
        function() {
            const { useEffect, useState } = this;
            const [ready, setReady] = useState(false);

            useEffect(() => {
                setTimeout(() => setReady(true), 1000);
            });

            return ready;
        },
        {},
        invalidator
    );

    attr.run(testNode);
    attr.destroy();

    jest.advanceTimersToNextTimer();
    expect(invalidator).not.toHaveBeenCalled();
});
