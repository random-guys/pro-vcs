import { ReviewableModel } from "../../src";

export interface User extends ReviewableModel {
  fullname: string
  email_address: string
}