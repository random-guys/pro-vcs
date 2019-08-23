import { Model } from "@random-guys/bucket";
import { Diff } from "deep-diff";


export type Action = 'create' | 'update' | 'delete'
export type Payload<T> = T | Diff<any>[]

export interface EventModel<T> extends Model {
  frozen: boolean
  metadata: Metadata
  payload?: Payload<T>
}

export interface Metadata {
  reference: string
  owner: string
  date_approved: Date
  action?: Action
}