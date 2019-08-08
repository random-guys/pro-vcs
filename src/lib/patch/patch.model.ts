import { Model } from "@random-guys/bucket";
import { Diff } from "deep-diff";


export type PatchType = 'create' | 'update' | 'delete'
export type PatchPayload = object | Diff<any>[]

export interface Patch extends Model {
  reference: string
  document_type: string
  owner: string
  patchType: PatchType
  payload?: PatchPayload
}

export interface PatcheableModel extends Model {
  frozen: boolean
}