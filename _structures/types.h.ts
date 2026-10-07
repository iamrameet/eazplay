import { Directory, Track } from ".";
import { Field, Manageable, ManageableFields } from "../library/lil-db";
import { ExtendedType } from "../library/types";

type StructureOf<T extends ReturnType<typeof Manageable.new>> = T extends ReturnType<typeof Manageable.new<infer S extends Readonly<{ [field: string]: Field<ExtendedType>; }>>> ? S & ManageableFields : never;

export type TrackStructure = StructureOf<typeof Track>;
export type DirectoryStructure = StructureOf<typeof Directory>;

export type StructureFieldsMap<T extends StructureOf<ReturnType<typeof Manageable.new>>> = {
  [K in keyof T]: InstanceType<T[K]["type"]>["value"]
};