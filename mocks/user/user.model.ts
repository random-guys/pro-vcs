import { PatcheableModel } from "../../src";

export interface User extends PatcheableModel {
  fullname: string
  email_address: string
}