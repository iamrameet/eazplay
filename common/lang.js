
/** @template {Type[]} T */
class GenericType {

  #types;

  /** @param {T} types */
  constructor(...types) {
    this.#types = new Set(types);
  }

  /** @param {T[number]} type */
  add(type) {
    this.#types.add(type);
  }

};

/**
 * @template {{ [name: string]: GenericType }} G
 * @template {abstract new (...args: any[]) => any} T
 */
class Type {

  #type;
  #templates;

  /**
   * @param {G} templates
   * @param {T} type
   */
  constructor(templates, type) {
    this.#templates = templates;
    this.#type = type;
  }

  get type() {
    return this.#type;
  }

  /**
   * @template {{ [K in keyof G]: G[K][number] }} V
   * @param {V} templateValues
   */
  templated(templateValues) {
  }

  /**
   * @param {ConstructorParameters<T>} args
   * @returns {T}
   */
  new(...args) {
    return new this.#type(...args);
  }

};

/** @template {Type} T */
class Instance {

  #value;
  #setter;

  /**
   * @param {(value: InstanceType<T>) => boolean} setter
   * @param {InstanceType<T["type"]>} value
   */
  constructor(setter, value) {
    this.#setter = setter;
    this.#value = value;
  }

  get value() {
    return this.#value;
  }
  set value(value) {
    this.#value = value;
  }

};

class Operator {
  /** @readonly */ static Increment = "++";
  /** @readonly */ static Decrement = "--";
  /** @readonly */ static Addition = "+";
  /** @readonly */ static Subtraction = "-";
  /** @readonly */ static Multiplication = "*";
  /** @readonly */ static Division = "/";
  /** @readonly */ static Modulus = "%";
  /** @readonly */ static Assignment = "=";
};

/** @template {any[]} T */
class Statement {
  /** @param {T} args */
  constructor(...args) {}
};

/**
 * @template {"const" | "let"} M
 * @template {Type} T
 * @template {string} N
 * @extends {Statement<[ mutable: M, type: T, identifier: N ]>}
 */
class VariableDeclaration extends Statement {

  /**
   * @param {M} mutable
   * @param {T} type
   * @param {N} identifier
   * @param {Statement<[InstanceType<T>]>} [value]
   */
  constructor(mutable, type, identifier, value) {
    super([ mutable, type, identifier, value ]);
  }

};

/**
 * @template {string} N
 * @template {{ [name: string]: GenericType }} G
 * @template {Type | keyof G} T
 * @template {{ [name: string]: Type | keyof G }} P
 * @template {Block<(Statement | typeof FunctionDeclaration.ReturnStatement<T extends string ? G[T] : T>)[]>} B
 * @extends {Statement<[ returnType: T, identifier: N, templates: G, parameters: P, block: B ]>}
 */
class FunctionDeclaration extends Statement {

  /**
   * @param {T} returnType
   * @param {N} identifier
   * @param {G} templates
   * @param {P} parameters
   * @param {B} block
   */
  constructor(returnType, identifier, templates, parameters, block) {
    super(returnType, identifier, templates, parameters, block);
  }

  static ReturnStatement;
  static {
    /**
     * @template T
     * @extends {Statement<[ type: T ]>}
     */
    this.ReturnStatement = class ReturnStatement extends Statement {
      /** @param {T} type */
      constructor(type) {
        super(type);
      }
    };
  }

};

/** @template {Statement[]} T */
class Block {
  /** @param {T} statements */
  constructor(...statements) {}
};

class Types {

  static Integer;
  static Float;
  static String;
  static GenericKey;
  static GenericValue;
  static Vector;
  static HashMap;

  static {
    this.Integer = new Type({}, class Integer {});
    this.Float = new Type({}, class Float {});
    this.String = new Type({}, String);
    this.GenericKey = new GenericType(Types.Integer, Types.Float, Types.String);
    /** @type {GenericType<[typeof Types.Integer, typeof Types.Float, typeof Types.String, typeof Types.Vector]>} */
    this.GenericValue = new GenericType(Types.Integer, Types.Float, Types.String);

    this.Vector = new Type({ T: Types.GenericValue }, Array);
    this.GenericValue.add(this.Vector);

    this.HashMap = new Type({
      K: Types.GenericKey,
      V: Types.GenericValue
    }, Map);
  }

};

const blocks = new Block(
  new VariableDeclaration("const", Types.Integer, "a", 10),
  new VariableDeclaration("const", Types.Integer, "b", 20),
  new FunctionDeclaration("T", "sum", {
    T: new GenericType(Types.Integer, Types.Float)
  }, { num1: "T", num2: "T" }, new Block(
    new FunctionDeclaration.ReturnStatement(new Types.Integer())
  ))
);

class ElementRestrictionObserver extends MutationObserver {

  #restrictedTagNames;

  /** @param {(keyof HTMLElementTagNameMap)[]} tagNames */
  constructor(...tagNames) {
    super(mutations => {
      for(const mutation of mutations) {
        for(const node of mutation.addedNodes) {
          if(node instanceof HTMLElement && this.#restrictedTagNames.has(node.localName)) {
            node.remove();
          }
        }
      }
    });
    this.#restrictedTagNames = new Set(tagNames);
  }

  /** @param {Node} target */
  observe(target) {
    for(const tagName of this.#restrictedTagNames) {
      for(const node of target.ownerDocument.getElementsByTagName(tagName)) {
        node.remove();
      }
    }
    super.observe(target);
  }

  /** @param {keyof HTMLElementTagNameMap} tagName */
  addTagNames(tagName) {
    this.#restrictedTagNames.add(tagName);
  }

};

const grammerRules = Object.freeze({

  /** @type {(type: string, identifier: string, expression: []) => any} */
  "type identifier<undefined> operator<=> expression punctuation<;>"(type, identifier, expression) {},

  /** @type {(identifier: string, expression: []) => any} */
  "identifier<defined> operator<=> expression punctuation<;>"(identifier, expression) {},

  /** @type {(type: string, identifier: string, expression: []) => any} */
  "keyword<const> type identifier<undefined> operator<=> expression punctuation<;>"(type, identifier, expression) {},

  /** @type {(expression: []) => any} */
  "punctuation<(> expression punctuation<)> punctuation<;>"(expression) {},

  /** @type {(expression1: [], expression2: []) => any} */
  "type identifier<undefined> punctuation<(> expression punctuation<)> punctuation<{> expression punctuation<}>"(expression1, expression2) {},
});

`
[type T] [identifier] <|= [statement<type T>]|>; = [declaration]
const [type T] [identifier] = [statement<type T>]; = [declaration]

[type R] [identifier]
  <|<
    [identifier] <|= [type], [type], ...|>,
    [identifier] <|= [type], [type], ...|>,
    ...
  >|> (<|
    [type P1] [identifier] <|= [statement<P1>]|>,
    [type P2] [identifier] <|= [statement<P2>]|>,
    ...
  |>) {
    <|[statement]|>;
    ...
    <|return <|[statement<R>]|>|>;
  }

if([statement<boolean>]) {
  <|[statement]|>
  <|[statement]|>
  ...
}

switch([statement<T>]) {
  <|case [statement<T>]: [statement];|>
  <|default: |>
  <|break;|>
}

<|[label]:|> for([declaration]; [statement<boolean>]; [statement]) {
  <|[statement]|>
  <|[statement]|>
  ...
  <|[jump_statement] <|[label]|>|>;
}

<|[label]:|> while([statement<boolean>]) {
  <|[statement]|>
  <|[statement]|>
  ...
  <|[jump_statement] <|[label]|>|>;
}

// statements
[identifier]
  <|<[type], [type], ...>|>
  (<|[statement], [statement], ...|>);

[operator] [statement]; // pre unary
[statement] [operator]; // post unary
[statement] [operator] [statement]; // binary
[statement] [operator<0>] [statement] [operator<1>] [statement] // ternary

[instance]
  <|<[type], [type], ...>|>
  <|.[property]<|(
      <|[statement], [statement], ...|>
    )|>
  |>;
`;