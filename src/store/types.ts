import { Node, NodeSpec } from "prosemirror-model";

import { DeferredResult } from "./deferredResult";
import { AttrHooks } from "./attrStore";
import { DocumentHooks } from "./documentStore";

export type NodeId = string;
export type AttrKey = string;

export type Hooks = DocumentHooks & AttrHooks;

export type ReactiveChangeDispatcher = (nodeId: NodeId) => any;
export type ReactiveAttrsDefinition = Record<string, ReactiveAttrFn>;

export type ReactiveAttrValue = any;
export type ReactiveAttrFn = (node: Node, hooks?: Hooks) => ReactiveAttrValue;

export type ReactiveNodeUpdate = [boolean, Node];

export type ReactiveAttrUpdateResult = ReactiveAttrValue | DeferredResult<ReactiveAttrValue>;
export type ReactiveNodeUpdateResult = ReactiveNodeUpdate | DeferredResult<ReactiveNodeUpdate>;

export interface ReactiveNodeSpec extends NodeSpec {
    reactive?: true;
    reactiveAttrs?: Record<string, ReactiveAttrFn>;
}
