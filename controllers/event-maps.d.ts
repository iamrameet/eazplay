import { IPCControllerAPIEventsMap } from "../tools/ipc-controller";
import Tables from "../managers/sqlite3";

export type DataControllerEventsMap = {
  [K in keyof typeof Tables as `${ K }:update`]: K extends "tracks" | "directories"
    ? [ path: string, fields: Parameters<typeof Tables[K]["update"]>[0] ]
    : [ id: number, fields: Parameters<typeof Tables[K]["update"]>[0] ]
}