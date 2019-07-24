import { Model } from "@random-guys/bucket";
import { Diff } from "deep-diff";


export interface ReviewRequest extends Model {
  reference: string
  document_type: string
  creator: string
  diff: Diff<any>
}

export interface ReviewableModel extends Model {
  staged: boolean
}