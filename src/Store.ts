import { Ref, UnwrapRef, reactive, watch, StopHandle, ComputedRef, computed } from 'vue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type State = { [key: string]: any };

export type SelectorsBase<T extends State> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (state: T) => any;
};

export type Selectors<T extends State, U extends SelectorsBase<T>> = {
  [K in keyof U]: (state: T) => ReturnType<U[K]>;
};

type ComputedSelectors<T extends State, U extends SelectorsBase<T>> = {
  [K in keyof U]: ComputedRef<ReturnType<U[K]>>;
};

type ReactiveState<T> = T extends Ref ? T : UnwrapRef<T>;

export default class Store<T extends State, U extends SelectorsBase<T>> {
  private readonly reactiveState: ReactiveState<T>;
  private readonly reactiveSelectors: ComputedSelectors<T, U>;
  private readonly stateStopWatches = new Map();
  private readonly selectorStopWatches = new Map();

  constructor(initialState: T, selectors?: Selectors<T, U>) {
    this.reactiveState = reactive(initialState);
    this.reactiveSelectors = {} as ComputedSelectors<T, U>;
    if (selectors) {
      Object.keys(selectors).forEach(
        (key: keyof U) =>
          (this.reactiveSelectors[key] = computed(() =>
            // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
            // @ts-ignore
            selectors[key](this.reactiveState)
          ))
      );
    }
  }

  getState(): ReactiveState<T> {
    return this.reactiveState;
  }

  getSelectors(): ComputedSelectors<T, U> {
    return this.reactiveSelectors;
  }

  getStateAndSelectors(): [ReactiveState<T>, ComputedSelectors<T, U>] {
    return [this.reactiveState, this.reactiveSelectors];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useStateAndSelectors(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    componentInstance: { [ key: string ]: any },
    subStateMap: { [key: string]: object },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectorMap: { [key: string]: ComputedRef<any> }
  ): void {
    this.useState(componentInstance, subStateMap);
    this.useSelectors(componentInstance, selectorMap);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useState(componentInstance: { [ key: string ]: any }, subStateMap: { [key: string]: object }): void {
    this.stateStopWatches.set(componentInstance, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.entries(subStateMap).forEach(([stateName, subState]: [string, object]) => {
      if (!Object.getOwnPropertySymbols(subState)[0]) {
        throw new Error('useState: One of given subStates is not subState');
      }

      this.stateStopWatches.get(componentInstance).push(
        watch(
          () => subState,
          () => (componentInstance[stateName] = subState),
          {
            deep: true
          }
        )
      );
    });

    const originalOnDestroy = componentInstance.ngOnDestroy;
    componentInstance.ngOnDestroy = () => {
      this.stateStopWatches.get(componentInstance).forEach((stopWatch: StopHandle) => stopWatch());
      if (originalOnDestroy) {
        originalOnDestroy();
      }
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useSelectors(componentInstance: any, selectorMap: { [key: string]: ComputedRef<any> }): void {
    this.selectorStopWatches.set(componentInstance, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.entries(selectorMap).forEach(([selectorName, selector]: [string, ComputedRef<any>]) => {
      this.selectorStopWatches.get(componentInstance).push(
        watch(
          () => selector,
          () => (componentInstance[selectorName] = selector.value),
          {
            deep: true
          }
        )
      );
    });

    const originalOnDestroy = componentInstance.ngOnDestroy;
    componentInstance.ngOnDestroy = () => {
      this.selectorStopWatches.get(componentInstance).forEach((stopWatch: StopHandle) => stopWatch());
      if (originalOnDestroy) {
        originalOnDestroy();
      }
    };
  }
}
