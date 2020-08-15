import { DecorationSet } from "prosemirror-view";
import { Schema } from "prosemirror-model";

import { DocumentStore } from "../store/documentStore";

export interface PluginArgs {
    schema: Schema;
    idAttrKey?: string;
    documentState?: Record<any, any>;
}

export interface PluginState {
    store: DocumentStore;
    decorations: DecorationSet;
}
