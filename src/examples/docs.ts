export const sheepDoc = {
    type: "doc",
    content: [
        {
            type: "paragraph",
            content: [{ type: "sheepNamer", attrs: { sheepId: "sheep-3" } }],
        },
        {
            type: "paragraph",
            content: [{ type: "sheep", attrs: { name: "Shaun", id: "sheep-1" } }],
        },
        {
            type: "paragraph",
            content: [{ type: "sheepNamer", attrs: { sheepId: "sheep-2" } }],
        },
        {
            type: "paragraph",
            content: [{ type: "sheepNamer", attrs: { sheepId: "sheep-4" } }],
        },
        {
            type: "paragraph",
            content: [{ type: "sheep", attrs: { name: "Seamus", id: "sheep-2" } }],
        },
        {
            type: "paragraph",
            content: [{ type: "sheep", attrs: { name: "Shelly", id: "sheep-3" } }],
        },
        {
            type: "paragraph",
            content: [{ type: "sheepNamer", attrs: { sheepId: "sheep-1" } }],
        },
    ],
};

export const counterAndHeaderDoc = {
    type: "doc",
    content: [
        { type: "header", content: [{ type: "text", text: "Welcome to my document" }] },
        {
            type: "paragraph",
            content: [
                { type: "text", text: "Here is a bunch of stuff that isn't true" },
                { type: "counter" },
                { type: "text", text: "But we do have citations for it!" },
                { type: "counter" },
            ],
        },
        { type: "header", content: [{ type: "text", text: "More stuff" }] },
        {
            type: "paragraph",
            content: [{ type: "text", text: "Here is some more stuff" }, { type: "counter" }],
        },
    ],
};
