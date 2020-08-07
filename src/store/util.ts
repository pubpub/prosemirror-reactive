const prefix = `[prosemirror-reactive]`;

export const warn = (message: string) => {
    return `${prefix} ${message}`;
};

export const throwError = (message: string) => {
    throw new Error(`${prefix} ${message}`);
};
