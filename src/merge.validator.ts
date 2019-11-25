import joi from "@hapi/joi";
import { ObjectState } from "./event.model";

const isPayloadModel = joi.object({
  object_state: joi
    .string()
    .trim()
    .required()
    .valid(ObjectState.created, ObjectState.updated, ObjectState.deleted)
});

export const isCreateEvent = joi.object({
  object_type: joi
    .string()
    .trim()
    .lowercase()
    .required(),
  event_type: joi
    .string()
    .trim()
    .valid("create")
    .default("create"),
  object_state: joi
    .string()
    .trim()
    .required()
    .valid(ObjectState.created, ObjectState.updated, ObjectState.deleted),
  payload: joi.when("object_state", {
    is: joi.valid(ObjectState.created, ObjectState.updated),
    then: isPayloadModel.required()
  }),
  update: joi.when("object_state", {
    is: joi.valid(ObjectState.updated),
    then: joi.object().required()
  })
});
