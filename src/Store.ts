import { computed, ComputedRef, reactive, Ref, StopHandle, UnwrapRef, watch } from '@pksilen/reactive-js';
import { SubStateFlagWrapper } from './createSubState';

export type SubState = object & SubStateFlagWrapper;
export type State = { [key: string]: SubState };

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

type ReactiveState<T extends State> = T extends Ref ? T : UnwrapRef<T>;

export default class Store<T extends State, U extends SelectorsBase<T>> {
  private readonly reactiveState: ReactiveState<T>;
  private readonly reactiveSelectors: ComputedSelectors<T, U>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly stateStopWatches = new Map<InstanceType<any>, StopHandle[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly selectorStopWatches = new Map<InstanceType<any>, StopHandle[]>();
  private readonly componentInstanceToUpdatesMap = new Map();

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getStateStopWatches<V extends new (...args: any[]) => any>(
    componentInstace: InstanceType<V>
  ): Readonly<StopHandle[]> | undefined {
    return this.stateStopWatches.get(componentInstace);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSelectorStopWatches<V extends new (...args: any[]) => any>(
    componentInstace: InstanceType<V>
  ): Readonly<StopHandle[]> | undefined {
    return this.selectorStopWatches.get(componentInstace);
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
  useStateAndSelectors<V extends new (...args: any[]) => any>(
    componentInstance: InstanceType<V>,
    subStateMap: { [key: string]: SubState },
    selectorMap: { [key: string]: ComputedRef }
  ): void {
    this.useState(componentInstance, subStateMap);
    this.useSelectors(componentInstance, selectorMap);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useState<V extends new (...args: any[]) => any>(
    componentInstance: InstanceType<V>,
    subStateMap: { [key: string]: SubState }
  ): void {
    this.stateStopWatches.set(componentInstance, []);

    Object.entries(subStateMap).forEach(([stateName, subState]: [string, SubState]) => {
      if (!subState.__isSubState__) {
        throw new Error('useState: One of given subStates is not subState');
      }

      componentInstance[stateName] = subState;

      this.stateStopWatches.get(componentInstance)?.push(this.watch(componentInstance, stateName, subState));
    });

    const originalOnDestroy = componentInstance.ngOnDestroy;
    componentInstance.ngOnDestroy = () => {
      this.stateStopWatches.get(componentInstance)?.forEach((stopWatch: StopHandle) => stopWatch());
      this.stateStopWatches.delete(componentInstance);
      if (originalOnDestroy) {
        originalOnDestroy();
      }
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useSelectors<V extends new (...args: any[]) => any>(
    componentInstance: InstanceType<V>,
    selectorMap: { [key: string]: ComputedRef }
  ): void {
    this.selectorStopWatches.set(componentInstance, []);

    Object.entries(selectorMap).forEach(([selectorName, selector]: [string, ComputedRef]) => {
      componentInstance[selectorName] = selector.value;

      this.selectorStopWatches
        .get(componentInstance)
        ?.push(this.watch(componentInstance, selectorName, selector));
    });

    const originalOnDestroy = componentInstance.ngOnDestroy;
    componentInstance.ngOnDestroy = () => {
      this.selectorStopWatches.get(componentInstance)?.forEach((stopWatch: StopHandle) => stopWatch());
      this.selectorStopWatches.delete(componentInstance);
      if (originalOnDestroy) {
        originalOnDestroy();
      }
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch<V extends new (...args: any[]) => any>(
    componentInstance: InstanceType<V>,
    name: string,
    subStateOrSelector: SubState | ComputedRef
  ): StopHandle {
    return watch(
      () => subStateOrSelector,
      () => {
        if (!this.componentInstanceToUpdatesMap.get(componentInstance)) {
          setTimeout(() => {
            Object.entries(this.componentInstanceToUpdatesMap.get(componentInstance)).forEach(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ([key, value]: [string, any]) => {
                componentInstance[key] = value;
              }
            );

            this.componentInstanceToUpdatesMap.delete(componentInstance);
          }, 0);
        }

        this.componentInstanceToUpdatesMap.set(componentInstance, {
          ...this.componentInstanceToUpdatesMap.get(componentInstance),
          [name]: 'effect' in subStateOrSelector ? subStateOrSelector.value : subStateOrSelector
        });
      },
      {
        deep: true,
        flush: 'sync'
      }
    );
  }
}
