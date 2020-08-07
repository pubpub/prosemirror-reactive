import { Node, NodeSpec } from "prosemirror-model";

import { DeferredResult } from "./deferredResult";

export type NodeId = string;
export type AttrKey = string;

export type ReactiveChangeDispatcher = (nodeId: NodeId) => any;
export type ReactiveAttrsDefinition = Record<string, ReactiveAttrFn>;

export type ReactiveAttrValue = number | string;
export type ReactiveAttrFn = (node: Node) => ReactiveAttrValue;

export type ReactiveNodeUpdate = [boolean, Node];

export type ReactiveAttrUpdateResult = ReactiveAttrValue | DeferredResult<ReactiveAttrValue>;
export type ReactiveNodeUpdateResult = ReactiveNodeUpdate | DeferredResult<ReactiveNodeUpdate>;

export type Hooks = Record<string, Function>;

export interface ReactiveNodeSpec extends NodeSpec {
    reactive?: true;
    reactiveAttrs?: Record<string, ReactiveAttrFn>;
}
