/**
 * Common utility types for Relay.
 */

/** Make specific properties optional */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Make specific properties required */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/** Extract only the string keys from an object type */
export type StringKeys<T> = Extract<keyof T, string>;

/** Non-nullable version of a type */
export type NonNullable<T> = T extends null | undefined ? never : T;

/** Deep partial for nested objects */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Extract the value type from a Record */
export type ValueOf<T> = T[keyof T];

/** Make a type readonly deeply */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/** Async function type */
export type AsyncFn<T = void> = () => Promise<T>;

/** Callback type with error handling */
export type Callback<T = void> = (error?: Error | null, result?: T) => void;

/** Timestamp in milliseconds */
export type Timestamp = number;

/** ID string type */
export type ID = string;
