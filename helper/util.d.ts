type ExcludeFirstParameter<F extends (...args: any[]) => any> =
  F extends (head: any, ...tail: infer T) => any ? (...args: T) => any : never;

type Flat<T extends { [name: string]: { [name: string]: any } }> = { [K in keyof T as K extends string ? keyof T[K] extends string ? `${ K }.${ keyof T[K] }` : never : never]: T[K][keyof T[K]] };