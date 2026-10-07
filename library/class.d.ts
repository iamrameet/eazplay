export declare type Class<T, C extends any[], S extends ClassPropertyScope<"static">, I extends ClassPropertyScope<"this">> = {

  new<T, C extends any[], S extends ClassPropertyScope<"static">, I extends ClassPropertyScope<"this">>(properties: {
    this?: I;
    static?: S;
    constructor?: ClassConstructor<T, C, S, I>
  }): PublicClass<T, C, S, I>

};

type PublicClass<T, C extends any[], S extends ClassPropertyScope<"static">, I extends ClassPropertyScope<"this">> = {
  [K in keyof S["public"]]: S["public"][K];
} & {
  new(...args: C): ClassInstance<T, "public", I>;
};

type ClassStatic<T, A extends keyof ClassPropertyScope, S extends ClassPropertyScope<"static">> = T & S[A];
type ClassInstance<T, A extends keyof ClassPropertyScope, I extends ClassPropertyScope<"this">> = T & I[A];

type PrivateInstance<T, I extends ClassPropertyScope<"this">> = ClassInstance<T, "public" | "protected" | "private", I>;
type PrivateStatic<T, S extends ClassPropertyScope<"static">> = ClassStatic<T, "public" | "protected" | "private", S>;

type MethodsWithThis<T, P extends ClassPropertyScope> = {
  [K in keyof P]: P[K] extends (...args: infer A) => infer R ? (this: {a: 10}, ...args: A) => R : P[K];
};

interface ClassPropertyScope<T extends "this" | "static" = "this" | "static"> {
  public?: ClassProperties<this>;
  private?: ClassProperties<this>;
  protected?: ClassProperties<this>;
}

type ClassProperties<T extends ClassPropertyScope> = {
  [property: PropertyKey]: number | string | boolean | symbol | bigint | object | (
    (this: T extends ClassPropertyScope<infer A>
      ? A extends "this"
        ? PrivateInstance<any, T>
        : PrivateStatic<any, T>
      : never, ...args: any[]
    ) => any)
}

type ClassConstructor<T, C extends any[], S extends ClassPropertyScope<"static">, I extends ClassPropertyScope<"this">> = (this: PrivateInstance<T, I>, ...args: C) => T;