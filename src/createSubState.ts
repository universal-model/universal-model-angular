export type SubStateFlagWrapper = {
  readonly __isSubState__: boolean;
};

type AllowedInitialStateProperties<T extends object> = {
  [K in keyof T]: K extends '__isSubState__' ? never : T[K];
};

type DisallowedInitialStatePropertyValueType =
  | Error
  | Date
  | RegExp
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array
  | ArrayBuffer
  | DataView
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Promise<any>
  | Generator
  | GeneratorFunction
  | AsyncGeneratorFunction
  | AsyncGeneratorFunctionConstructor
  | ProxyConstructor
  | Intl.Collator
  | Intl.DateTimeFormat
  | Intl.NumberFormat
  | Intl.PluralRules;

type AllowedInitialStatePropertyValueType =
  | number
  | boolean
  | string
  | undefined
  | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Array<any>
  | object
  | Function;

export type InitialState<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof T]: T[K] extends DisallowedInitialStatePropertyValueType
    ? never
    : T[K] extends AllowedInitialStatePropertyValueType
    ? T[K]
    : never;
};

export default function createSubState<T extends InitialState<T>>(
  initialState: T & AllowedInitialStateProperties<T>
): T & SubStateFlagWrapper {
  if (Object.keys(initialState).includes('__isSubState__')) {
    throw new Error('createSubState: subState may not contain key: __isSubState__');
  }

  return {
    ...initialState,
    __isSubState__: true
  };
}
