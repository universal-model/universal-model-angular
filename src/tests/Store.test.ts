import createSubState from '../createSubState';
import createStore from '../createStore';

jest.useFakeTimers();

const object = {};

const initialState1 = {
  number: 1,
  boolean: true,
  string: 'test',
  undefined: undefined as number | undefined,
  null: null as number | null,
  array: [1],
  object: {
    value: 1
  },
  func: () => 1,
  map: new Map(),
  set: new Set(),
  weakMap: new WeakMap(),
  weakSet: new WeakSet()
};

const initialState = {
  state1: createSubState(initialState1)
};

type State = typeof initialState;

const onDestroyMock = jest.fn();

class TestComponent {
  state1 = initialState1;
  numberSelector: number;
  booleanSelector: boolean;
  stringSelector: string;
  undefinedSelector: number | undefined;
  nullSelector: number | null;
  arraySelector: number[];
  objectSelector: number;
  funcSelector: number;
  mapSelector: number;
  setSelector: number;
  weakMapSelector: number;
  weakSetSelector: number;

  constructor() {
    this.numberSelector = 0;
    this.booleanSelector = false;
    this.stringSelector = '';
    this.undefinedSelector = 1;
    this.nullSelector = 1;
    this.arraySelector = [];
    this.objectSelector = 0;
    this.funcSelector = 0;
    this.mapSelector = 0;
    this.setSelector = 0;
    this.weakMapSelector = 0;
    this.weakSetSelector = 0;
  }

  ngOnDestroy(): void {
    onDestroyMock();
  }
}

const selectors = {
  numberSelector: (state: State) => state.state1.number + 1,
  booleanSelector: (state: State) => !state.state1.boolean,
  stringSelector: (state: State) => state.state1.string + '1',
  undefinedSelector: (state: State) => (typeof state.state1.undefined === 'undefined' ? 1 : 2),
  nullSelector: (state: State) => (state.state1.null === null ? 1 : 2),
  arraySelector: (state: State) => [...state.state1.array, 2],
  objectSelector: (state: State) => state.state1.object.value + 1,
  funcSelector: (state: State) => state.state1.func() + 1,
  mapSelector: (state: State) => state.state1.map.get('a') + 1,
  setSelector: (state: State) => (state.state1.set.has('a') ? 3 : 1),
  weakMapSelector: (state: State) => state.state1.weakMap.get(object) + 1,
  weakSetSelector: (state: State) => (state.state1.weakSet.has(object) ? 3 : 1)
};

const store = createStore<State, typeof selectors>(initialState, selectors);
const testComponent = new TestComponent();

describe('Store', () => {
  describe('useState', () => {
    it('should update component instance on state changes', () => {
      // GIVEN
      const { state1 } = store.getState();
      store.useState(testComponent, { state1 });

      // WHEN
      state1.number = 2;
      state1.boolean = false;
      state1.string = '';
      state1.undefined = 1;
      state1.null = 1;
      state1.array.push(2);
      state1.object.value = 2;
      state1.func = () => 2;
      state1.map.set('a', 1);
      state1.set.add(1);
      state1.weakMap.set(object, 1);
      state1.weakSet.add(object);
      jest.runAllTimers();

      // THEN
      expect(testComponent.state1.number).toBe(2);
      expect(testComponent.state1.boolean).toBe(false);
      expect(testComponent.state1.string).toBe('');
      expect(testComponent.state1.undefined).toBe(1);
      expect(testComponent.state1.null).toBe(1);
      expect(testComponent.state1.array).toStrictEqual([1, 2]);
      expect(testComponent.state1.object).toStrictEqual({ value: 2 });
      expect(testComponent.state1.func()).toBe(2);
      expect(testComponent.state1.map.get('a')).toBe(1);
      expect(testComponent.state1.set.has(1)).toBe(true);
      expect(testComponent.state1.weakMap.get(object)).toBe(1);
      expect(testComponent.state1.weakSet.has(object)).toBe(true);

      // WHEN
      testComponent.ngOnDestroy();

      // THEN
      expect(onDestroyMock).toHaveBeenCalled();
    });

    it('should throw error if given sub-state is not a sub-state', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        store.useState(testComponent, { state: {} });
      }).toThrowError('useState: One of given subStates is not subState');
    });
  });

  describe('useSelectors', () => {
    it('should update component instance on state changes', () => {
      // GIVEN
      const { state1 } = store.getState();

      const {
        numberSelector,
        booleanSelector,
        stringSelector,
        undefinedSelector,
        nullSelector,
        arraySelector,
        objectSelector,
        funcSelector,
        mapSelector,
        setSelector,
        weakMapSelector,
        weakSetSelector
      } = store.getSelectors();

      store.useSelectors(testComponent, {
        numberSelector,
        booleanSelector,
        stringSelector,
        undefinedSelector,
        nullSelector,
        arraySelector,
        objectSelector,
        funcSelector,
        mapSelector,
        setSelector,
        weakMapSelector,
        weakSetSelector
      });

      // WHEN
      state1.number = 2;
      state1.boolean = false;
      state1.string = 'foo';
      state1.undefined = 2;
      state1.null = 2;
      state1.array = [1];
      state1.object.value = 2;
      state1.func = () => 2;
      state1.map.set('a', 2);
      state1.set.add('a');
      state1.weakMap.set(object, 2);
      state1.weakSet.add(object);
      jest.runAllTimers();

      // THEN
      expect(testComponent.numberSelector).toBe(3);
      expect(testComponent.booleanSelector).toBe(true);
      expect(testComponent.stringSelector).toBe('foo1');
      expect(testComponent.undefinedSelector).toBe(2);
      expect(testComponent.nullSelector).toBe(2);
      expect(testComponent.arraySelector).toStrictEqual([1, 2]);
      expect(testComponent.objectSelector).toBe(3);
      expect(testComponent.funcSelector).toBe(3);
      expect(testComponent.mapSelector).toBe(3);
      expect(testComponent.setSelector).toBe(3);
      expect(testComponent.weakMapSelector).toBe(3);
      expect(testComponent.weakSetSelector).toBe(3);

      // WHEN
      testComponent.ngOnDestroy();

      // THEN
      expect(onDestroyMock).toHaveBeenCalled();
    });
  });

  describe('useStateAndSelectors', () => {
    it('should update component instance on state changes', () => {
      // GIVEN
      const [{ state1 }, { numberSelector }] = store.getStateAndSelectors();
      store.useStateAndSelectors(testComponent, { state1 }, { numberSelector });

      // WHEN
      state1.number = 5;
      jest.runAllTimers();

      // THEN
      expect(testComponent.state1.number).toBe(5);
      expect(testComponent.numberSelector).toBe(6);
    });
  });
});
