import { Node, NodeSpec } from "prosemirror-model";

import { AttrHooks } from "./attrStore";
import { DeferredResult } from "./deferredResult";
import { ReactiveMap } from "./reactiveMap";

export type NodeId = string;
export type AttrKey = string;

export type ReactiveChangeDispatcher = (nodeId: NodeId) => any;
export type ReactiveAttrsDefinition = Record<string, ReactiveAttrFn>;

export type ReactiveAttrValue = number | string;
export type ReactiveAttrFn = (node: Node) => ReactiveAttrValue | DeferredResult<ReactiveAttrValue>;

export type ReactiveNodeUpdate = [boolean, Node];

export type ReactiveAttrUpdateResult = ReactiveAttrValue | DeferredResult<ReactiveAttrValue>;
export type ReactiveNodeUpdateResult = ReactiveNodeUpdate | DeferredResult<ReactiveNodeUpdate>;

export type UseReactiveMap = ReactiveMap["get"];
export type UseDeferredNode = <T>(
    nodeIds: string | string[],
    callback: (...nodes: Node[]) => T
) => DeferredResult<T>;

export type DocumentHooks = {
    useDocumentState: UseReactiveMap;
    useTransactionState: UseReactiveMap;
    useDeferredNode: UseDeferredNode;
};

export type Hooks = DocumentHooks & AttrHooks;

export interface ReactiveNodeSpec extends NodeSpec {
    reactive?: true;
    reactiveAttrs?: Record<string, ReactiveAttrFn>;
}
