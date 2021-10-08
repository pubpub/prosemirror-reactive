import { ReactiveNodeSpec, AttrKey } from "./types";

const prefix = `[prosemirror-reactive]`;

export const warn = (message: string) => {
    return `${prefix} ${message}`;
};

export const throwError = (message: string) => {
    throw new Error(`${prefix} ${message}`);
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
