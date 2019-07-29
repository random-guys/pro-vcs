import { Model } from "@random-guys/bucket";
import { Diff } from "deep-diff";


export type PatchType = 'create' | 'update' | 'delete'

export interface ReviewRequest extends Model {
  reference: string
  document_type: string
  creator: string
  patchType: PatchType
  diffs: Diff<any>[]
}

export interface ReviewableModel extends Model {
  frozen: boolean
}

export function isNewDiff(diffs: Diff<any>[]) {
  return diffs.length === 1
    && diffs[0].kind === 'E'
    && diffs[0]['lhs'] == null
}

export function isDeleteDiff(diffs: Diff<any>[]) {
  return diffs.length === 1
    && diffs[0].kind === 'E'
    && diffs[0]['rhs'] == null
}