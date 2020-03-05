import { computed, ComputedRef, reactive, Ref, StopHandle, UnwrapRef, watch } from '@pksilen/reactive-js';
import { SubStateFlagWrapper } from './createSubState';

export type SubState = object & SubStateFlagWrapper;
export type State = { [key: string]: SubState };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StateGetter = () => any;

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
  private updateCount = 0;

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

  getUpdateCount(): Readonly<number> {
    return this.updateCount;
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
    subStateOrStateGetterMap: { [stateName: string]: SubState | StateGetter },
    selectorMap: { [key: string]: ComputedRef }
  ): void {
    this.useState(componentInstance, subStateOrStateGetterMap);
    this.useSelectors(componentInstance, selectorMap);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useState<V extends new (...args: any[]) => any>(
    componentInstance: InstanceType<V>,
    subStateOrStateGetterMap: { [key: string]: SubState | StateGetter }
  ): void {
    this.stateStopWatches.set(componentInstance, []);

    Object.entries(subStateOrStateGetterMap).forEach(
      ([stateName, subStateOrStateGetter]: [string, SubState | StateGetter]) => {
        if (typeof subStateOrStateGetter !== 'function' && !subStateOrStateGetter.__isSubState__) {
          throw new Error('useState: One of given subStates is not subState');
        }

        componentInstance[stateName] =
          typeof subStateOrStateGetter === 'function'
            ? computed(subStateOrStateGetter).value
            : subStateOrStateGetter;

        this.stateStopWatches
          .get(componentInstance)
          ?.push(
            this.watch(
              componentInstance,
              stateName,
              typeof subStateOrStateGetter === 'function'
                ? computed(subStateOrStateGetter)
                : subStateOrStateGetter
            )
          );
      }
    );

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
    subStateOrStateGetterOrSelector: SubState | StateGetter | ComputedRef
  ): StopHandle {
    return watch(
      () => subStateOrStateGetterOrSelector,
      () => {
        if (!this.componentInstanceToUpdatesMap.get(componentInstance)) {
          setTimeout(() => {
            this.updateCount++;
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
          [name]:
            'effect' in subStateOrStateGetterOrSelector
              ? subStateOrStateGetterOrSelector.value
              : subStateOrStateGetterOrSelector
        });
      },
      {
        deep: true,
        flush: 'sync'
      }
    );
  }
}
