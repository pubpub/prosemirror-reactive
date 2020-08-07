/* global it, expect */
import { ReactiveMap } from "../reactiveMap";

it("stores shallowly nested values", () => {
    const rm = new ReactiveMap({ hello: "hey" });
    const state = rm.get();
    expect(state.hello).toEqual("hey");
    state.goodbye = "bye";
    expect(rm.get().goodbye).toEqual("bye");
});

it("automatically creates state objects for deeply nested keys", () => {
    const eat = Symbol();
    const rm = new ReactiveMap();
    const newState = rm.get(["we", eat, "bees"], { one: 1 });
    newState.two = 2;
    expect(newState.one).toEqual(1);
    expect(newState.two).toEqual(2);
    expect(rm.get(["we"]).one).toBeUndefined();
    expect(rm.get(["we", eat]).one).toBeUndefined();
    expect(rm.get(["we", eat, "bees"]).two).toEqual(2);
});
