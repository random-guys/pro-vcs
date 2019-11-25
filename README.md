# pro-vcs

Database abstraction to simplify review request workflow

## How to install

Run `yarn add @random-guys/pro-vcs`

## How it works

## TODO

- [x] [Less complex code](https://dave.cheney.net/2019/07/09/clear-is-better-than-clever)
- [x] Timestamps
- [ ] Introduction of transactions for better concurrency guarantees
- [ ] Arrange tests
- [ ] True data uniqueness by taking `object_state` into consideration
- [ ] proxy `ModelNotFound` errors from `inplace` methods to `InconsistentState` error

### Pending Tests

- `event.repo`
  - `create`
    - [x] object is in `created` state
    - [ ] `prohub` is notified
    - [ ] DB constraints are held
  - `createApproved`
    - [ ] object is in `stable` state
  - `assertExists`
    - [ ] throws `DuplicateModelError` only when duplicate exists
  - `get`
    - [x] return `frozen` for `created/updated/deleted` when request is not from owner
    - [ ] return `stable` objects as is
    - [ ] patches objects for `updated` owners
  - `byQuery`
    - same as `get`
    - [ ] hides `created` objects by default
    - [ ] shows `created` objects on `allowNew`
  - `all`
    - [ ] same as `get`
    - [x] same as `byQuery`
  - `list`
    - [ ] same as `all`
  - `update`
    - [x] updates `created` objects
    - [x] updates `updated` objects
    - [x] returns patched object
    - [ ] sends patches to `prohub` for `created` objects
    - [ ] sends patches to `prohub` for `updated` objects
    - [ ] throws `InvalidOperation` for `deleted` objects
    - [x] create a new update for a `stable` object
    - [ ] send a new event for `stable` objects
    - [ ] throws `InvalidOperation` for objects not owner by user
  - `delete`
    - [ ] sends close event to `prohub` for `created` objects
    - [ ] sends close event to `prohub` for `updated` objects
    - [ ] sends close event to `prohub` for `deleted` objects
    - [x] undo `updated` objects
    - [x] undo `deleted` objects
    - [x] deletes `created` events
    - [x] creates new `deleted` event for `stable` objects
    - [ ] throws `InvalidOperation` for objects not owner by user
  - `merge`
    - [ ] stabilises `created` objects
    - [ ] stabilises `updated` objects with the new data. i.e other users can now see the changes
    - [ ] obliterates `deleted` objects
    - [ ] throws `InvalidOperation` for `stable` objects
  - `reject`
    - [ ] cleans up `created` objects
    - [ ] reverts `updated/deleted` objects
    - [ ] throws `InvalidOperation` for `stable` objects
- `merge.app`
  - [ ] `onApprove`
  - [ ] `onReject`
  - [ ] `onChecks`
