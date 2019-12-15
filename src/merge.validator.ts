import joi from "@hapi/joi";
import { ObjectState } from "./objects";

const isPayloadModel = joi.object({
  object_state: joi
    .string()
    .trim()
    .required()
    .valid(ObjectState.Created, ObjectState.Updated, ObjectState.Deleted)
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
    .valid(ObjectState.Created, ObjectState.Updated, ObjectState.Deleted),
  payload: joi.when("object_state", {
    is: joi.valid(ObjectState.Created, ObjectState.Updated),
    then: isPayloadModel.required()
  }),
  update: joi.when("object_state", {
    is: joi.valid(ObjectState.Updated),
    then: joi.object().required()
  })
});
