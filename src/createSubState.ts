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
  | ArrayBuffer
  | DataView
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Promise<any>
  | Generator
  | GeneratorFunction
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

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.entries(initialState).forEach(([key, value]: [string, any]) => {
      let isForbidden;

      try {
        isForbidden =
          value instanceof Error ||
          value instanceof Date ||
          value instanceof RegExp ||
          value instanceof Int8Array ||
          value instanceof Uint8Array ||
          value instanceof Uint8ClampedArray ||
          value instanceof Int16Array ||
          value instanceof Uint16Array ||
          value instanceof Int32Array ||
          value instanceof Uint32Array ||
          value instanceof Float32Array ||
          value instanceof Float64Array ||
          value instanceof BigInt64Array ||
          value instanceof BigUint64Array ||
          value instanceof ArrayBuffer ||
          value instanceof DataView ||
          value instanceof Promise ||
          value instanceof Proxy ||
          value instanceof Intl.Collator ||
          value instanceof Intl.DateTimeFormat ||
          value instanceof Intl.NumberFormat ||
          value instanceof Intl.PluralRules ||
          (typeof value !== 'number' &&
            typeof value !== 'boolean' &&
            typeof value !== 'string' &&
            typeof value !== 'undefined' &&
            value !== null &&
            !Array.isArray(value) &&
            typeof value !== 'function' &&
            typeof value !== 'object');
      } catch (error) {
        // NOOP
      }

      if (isForbidden) {
        throw new Error('Forbidden value type for key: ' + key);
      }
    });
  }

  return {
    ...initialState,
    __isSubState__: true
  };
}
