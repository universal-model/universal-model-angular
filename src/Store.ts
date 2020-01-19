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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  startUsingState(componentInstance: any, subStateMap: object): void {
    this.stateStopWatches.set(componentInstance, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.entries(subStateMap).forEach(([stateName, subState]: [string, any]) => {
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
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stopUsingState(componentInstance: any): void {
    this.stateStopWatches.get(componentInstance).forEach((stopWatch: StopHandle) => stopWatch());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  startUsingSelectors(componentInstance: any, selectorMap: object): void {
    this.selectorStopWatches.set(componentInstance, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.entries(selectorMap).forEach(([selectorName, selector]: [string, any]) => {
      this.selectorStopWatches.get(componentInstance).push(
        watch(
          () => selector,
          () => (componentInstance[selectorName] = selector),
          {
            deep: true
          }
        )
      );
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stopUsingSelectors(componentInstance: any): void {
    this.selectorStopWatches.get(componentInstance).forEach((stopWatch: StopHandle) => stopWatch());
  }
}
