import { difference } from "./object";

export const freshObjectDiff = difference({}, { staged: true })