import { UseEffect, UseRef, UseState } from "./store/attrStore";
import { Hooks, UseDeferredNode, UseReactiveMap } from "./store/types";

let currentHooks: null | Hooks = null;

export const setCurrentHooks = (hooks: Hooks) => {
    currentHooks = hooks;
};

export const useDeferredNode: UseDeferredNode = (nodeIds, callback) =>
    currentHooks.useDeferredNode(nodeIds, callback);

export const useDocumentState: UseReactiveMap = (path, initialState) =>
    currentHooks.useDocumentState(path, initialState);

export const useTransactionState: UseReactiveMap = (path, initialState) =>
    currentHooks.useTransactionState(path, initialState);

export const useState: UseState = initialValue => currentHooks.useState(initialValue);
export const useEffect: UseEffect = (fn, dependencies) => currentHooks.useEffect(fn, dependencies);
export const useRef: UseRef = initialValue => currentHooks.useRef(initialValue);
