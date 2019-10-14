# pro-vcs

Database abstraction to simplify review request workflow

## How to install?

Run `yarn add @random-guys/pro-vcs`

## How does it work?

## TODO

- [x] [Less complex code](https://dave.cheney.net/2019/07/09/clear-is-better-than-clever)
- [x] Timestamps
- [ ] Introduction of transactions for better concurrency guarantees
- [ ] Split test files(specifically `event.repo.ts`)

### Pending Tests(`EventRepo`)

- `assertExists`
  - [ ] when such document exists
  - [ ] when it doesn't
- `get`
  - [ ] a new object
  - [ ] an updated object
  - [ ] a deleted object
  - [x] a stable object
- `byQuery`
  - [ ] ...all object states
  - [ ] tests for allow new
  - [ ] when such document doesn't exist
- `all`
  - [ ] ...all object states
  - [ ] tests for allow new
  - [ ] tests for queries on unapproved updates
  - [x] owner based results
- `list`
  - [ ] ...same tests as all
- `update`
  - [ ] a deleted object
  - [ ] an updated object
  - [ ] Protection against unauthorised edits
- `delete`
  - [ ] Protection against unauthorised edits
  - [ ] detecting inconsistent state
- `merge`
  - [ ] ...all object states
