import { ReactiveNodeSpec, AttrKey } from "./types";

const prefix = `[prosemirror-reactive]`;

export const warn = (message: string) => {
    return `${prefix} ${message}`;
};

export const throwError = (message: string) => {
    throw new Error(`${prefix} ${message}`);
};

const isValidReactiveFn = fn => {
    // Arrow functions have no prototype, and we need non-arrows so we can bind `this` to them.
    // eslint-disable-next-line no-prototype-builtins
    return typeof fn === "function" && fn.hasOwnProperty("prototype");
};

export const assertCanCreateReactiveNodeStore = (
    nodeType: string,
    spec: ReactiveNodeSpec,
    idAttrKey: AttrKey
) => {
    const { attrs, reactiveAttrs } = spec;
    const hasIdAttr = attrs && attrs[idAttrKey];
    if (hasIdAttr) {
        const hasReactiveAttrs = reactiveAttrs && Object.keys(reactiveAttrs).length > 0;
        if (hasReactiveAttrs) {
            const attrWithWrongType = Object.entries(reactiveAttrs).find(
                entry => !isValidReactiveFn(entry[1])
            );
            if (attrWithWrongType) {
                throwError(
                    `Reactive attr ${attrWithWrongType} on ${nodeType} must be a (non-arrow) function`
                );
            }
            const reactiveAttrShadowingAttr = Object.keys(reactiveAttrs).find(
                attr => !!attrs[attr]
            );
            if (reactiveAttrShadowingAttr) {
                throwError(
                    `Reactive attr ${reactiveAttrShadowingAttr} cannot be defined in both 'attrs' and 'reactiveAttrs'`
                );
            }
        } else {
            throwError(
                `Reactive node definition for ${nodeType} must have one or more 'reactiveAttrs'`
            );
        }
    } else {
        throwError(
            `Reactive node definition for ${nodeType} must have an ID attr called ${idAttrKey}`
        );
    }
};
