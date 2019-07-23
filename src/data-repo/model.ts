import { Model } from "@random-guys/bucket";

export interface GuardedModel extends Model {
  staged: boolean
}