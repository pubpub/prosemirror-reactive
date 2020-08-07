/* global it, expect, jest */
import { DeferredResult } from "../deferredResult";

const noop = () => {};

it("accepts a single nodeId", () => {
    const dr = new DeferredResult("a", noop);
    expect(dr.requestedNodeIds).toEqual(new Set("a"));
});

it("accepts an array of nodeIds", () => {
    const dr = new DeferredResult(["a", "c", "b"], noop);
    expect(dr.requestedNodeIds).toEqual(new Set(["a", "b", "c"]));
});

it("accepts a Set of nodeIds", () => {
    const dr = new DeferredResult(new Set(["a", "c", "b"]), noop);
    expect(dr.requestedNodeIds).toEqual(new Set(["a", "b", "c"]));
});

it("has a callback", () => {
    const fn = jest.fn();
    const dr = new DeferredResult([], fn);
    dr.callback({});
    expect(fn).toHaveBeenCalled();
});
