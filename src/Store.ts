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

export default class Store<
  T extends State,
  U extends SelectorsBase<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  V extends new (...args: any[]) => any
> {
  private readonly reactiveState: ReactiveState<T>;
  private readonly reactiveSelectors: ComputedSelectors<T, U>;
  private readonly stateStopWatches = new Map<InstanceType<V>, StopHandle[]>();
  private readonly selectorStopWatches = new Map<InstanceType<V>, StopHandle[]>();
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

  getStateStopWatches(): Readonly<Map<InstanceType<V>, StopHandle[]>> {
    return this.stateStopWatches;
  }

  getSelectorStopWatches(): Readonly<Map<InstanceType<V>, StopHandle[]>> {
    return this.stateStopWatches;
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
    componentInstance: InstanceType<V>,
    subStateMap: { [key: string]: SubState },
    selectorMap: { [key: string]: ComputedRef }
  ): void {
    this.useState(componentInstance, subStateMap);
    this.useSelectors(componentInstance, selectorMap);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useState(componentInstance: InstanceType<V>, subStateMap: { [key: string]: SubState }): void {
    this.stateStopWatches.set(componentInstance, []);

    Object.entries(subStateMap).forEach(([stateName, subState]: [string, SubState]) => {
      if (!subState.__isSubState__) {
        throw new Error('useState: One of given subStates is not subState');
      }

      componentInstance[stateName] = subState;

      this.stateStopWatches.get(componentInstance)?.push(
        watch(
          () => subState,
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
              [stateName]: subState
            });
          },
          {
            deep: true,
            flush: 'sync'
          }
        )
      );
    });

    const originalOnDestroy = componentInstance.ngOnDestroy;
    componentInstance.ngOnDestroy = () => {
      this.stateStopWatches.get(componentInstance)?.forEach((stopWatch: StopHandle) => stopWatch());
      if (originalOnDestroy) {
        originalOnDestroy();
      }
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useSelectors(componentInstance: InstanceType<V>, selectorMap: { [key: string]: ComputedRef }): void {
    this.selectorStopWatches.set(componentInstance, []);

    Object.entries(selectorMap).forEach(([selectorName, selector]: [string, ComputedRef]) => {
      componentInstance[selectorName] = selector.value;

      this.selectorStopWatches.get(componentInstance)?.push(
        watch(
          () => selector,
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
              [selectorName]: selector.value
            });
          },
          {
            deep: true,
            flush: 'sync'
          }
        )
      );
    });

    const originalOnDestroy = componentInstance.ngOnDestroy;
    componentInstance.ngOnDestroy = () => {
      this.selectorStopWatches.get(componentInstance)?.forEach((stopWatch: StopHandle) => stopWatch());
      if (originalOnDestroy) {
        originalOnDestroy();
      }
    };
  }
}
