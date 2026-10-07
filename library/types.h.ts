interface PrimitiveTypeMap {
  number: number;
  string: string;
  boolean: boolean;
  bigint: bigint;
  symbol: symbol;
  object: object;
}

type PrimitiveTypeNames = keyof PrimitiveTypeMap;
type PrimitiveTypes = PrimitiveTypeMap[PrimitiveTypeNames];