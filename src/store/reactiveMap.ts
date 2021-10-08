type State = Record<any, any>;
type Key = string | symbol;

export class ReactiveMap {
    state: Record<any, any>;
    private childMaps: Map<Key, ReactiveMap>;

    constructor(initialState?: State) {
        this.state = initialState || {};
        this.childMaps = new Map();
    }

    private getOrCreateChildMap(key: Key, initialState?: State): ReactiveMap {
        const existing = this.childMaps.get(key);
        if (existing) {
            return existing;
        }
        const created = new ReactiveMap(initialState);
        this.childMaps.set(key, created);
        return created;
    }

    get(path: Key[] = [], initialState: State = {}): State {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let target: ReactiveMap = this as ReactiveMap;
        for (let i = 0; i < path.length; i++) {
            const possibleInitialState = i === path.length - 1 && initialState;
            target = target.getOrCreateChildMap(path[i], possibleInitialState);
        }
        return target.state;
    }
}
