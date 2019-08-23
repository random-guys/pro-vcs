import { Model } from "@random-guys/bucket";
import { Diff } from "deep-diff";

export type ObjectType = 'create' | 'update' | 'delete' | 'approved'
export type Payload<T> = T | Diff<any>[]

export interface DataModel<T> extends Model {
  metadata: Metadata
  payload?: Payload<T>
}

export interface Metadata {
  reference: string
  owner: string
  objectType: ObjectType
}