import { Ref, UnwrapRef, reactive, watch, StopHandle, ComputedRef, computed } from 'vue';
import { SubStateFlagWrapper } from './createSubState';

export type SubState = Omit<object, '__isSubState__'> & SubStateFlagWrapper;
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

type ReactiveState<T> = T extends Ref ? T : UnwrapRef<T>;

export default class Store<T extends State, U extends SelectorsBase<T>> {
  private readonly reactiveState: ReactiveState<T>;
  private readonly reactiveSelectors: ComputedSelectors<T, U>;
  private readonly stateStopWatches = new Map();
  private readonly selectorStopWatches = new Map();
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectorMap: { [key: string]: ComputedRef<any> }
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

      this.stateStopWatches.get(componentInstance).push(
        watch(
          () => subState,
          () => {
            if (!this.componentInstanceToUpdatesMap.get(componentInstance)) {
              setTimeout(() => {
                Object.entries(this.componentInstanceToUpdatesMap.get(componentInstance)).forEach(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ([key, value]: [string, any]) => {
                    console.log(key, value);
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
      this.stateStopWatches.get(componentInstance).forEach((stopWatch: StopHandle) => stopWatch());
      if (originalOnDestroy) {
        originalOnDestroy();
      }
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useSelectors<V extends new (...args: any) => any>(
    componentInstance: InstanceType<V>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectorMap: { [key: string]: ComputedRef<any> }
  ): void {
    this.selectorStopWatches.set(componentInstance, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.entries(selectorMap).forEach(([selectorName, selector]: [string, ComputedRef<any>]) => {
      componentInstance[selectorName] = selector.value;

      this.selectorStopWatches.get(componentInstance).push(
        watch(
          () => selector,
          () => {
            if (!this.componentInstanceToUpdatesMap.get(componentInstance)) {
              setTimeout(() => {
                Object.entries(this.componentInstanceToUpdatesMap.get(componentInstance)).forEach(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ([key, value]: [string, any]) => {
                    console.log(key, value);
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
      this.selectorStopWatches.get(componentInstance).forEach((stopWatch: StopHandle) => stopWatch());
      if (originalOnDestroy) {
        originalOnDestroy();
      }
    };
  }
}
