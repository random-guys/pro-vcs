import { Model } from "@random-guys/bucket";

export interface User extends Model {
  fullname: string
  email_address: string
}