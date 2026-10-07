import Accessor from "./accessor";

declare global {
  interface Array<T> {
    accessor(index: number): Accessor<Array<T>, T>;
    random<V>(emptyValue?: V): T | V;
    at<T extends this>(this: T, index: number): T;
  }
  interface ArrayConstructor {
    at<T>(arrayLike: ArrayLike<T>, index: number): T | undefined;
  }
}