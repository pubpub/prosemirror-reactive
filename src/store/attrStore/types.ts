export type UninitializedCell = [];
export type Cell = UninitializedCell | [number, any[]];
export type State<T> = [T, StateUpdater<T>];
export type Effect = [any[], () => any];
export type Ref<T> = { current: undefined | T };

export type StateUpdater<T> = (arg: T | ((curr: T) => T)) => void;
export type EffectCallback = () => () => any;
export type OnInvalidate = (attr: string) => void;

export type UseState = <T>(initialValue: T) => State<T>;
export type UseEffect = (fn: () => any, dependencies?: any[]) => unknown;
export type UseRef = <T>(initialValue?: T) => Ref<T>;

export type AttrHooks = {
    useState: UseState;
    useEffect: UseEffect;
    useRef: UseRef;
};
