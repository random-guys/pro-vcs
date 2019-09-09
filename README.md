# pro-vcs

Database abstraction to simplify review request workflow

## How to install?

## How does it work?

## TODO

- [ ] Analysis for possible concurrency bugs
- [ ] Split test files(specifically `event.repo.ts`)

### Pending Tests(`EventRepo`)

- `assertExists`
  - [ ] when such document exists
  - [ ] when it doesn't
- `get`
  - [ ] a new object
  - [ ] an updated object
  - [ ] a deleted object
  - [ ] a stable object
- `byQuery`
  - [ ] ...all object states
  - [ ] when such document doesn't exist
- `all`
  - [ ] ...all object states
- `update`
  - [ ] a deleted object
  - [ ] an updated object
  - [ ] Protection against unauthorised edits
  - [ ] detecting inconsistent state
- `delete`
  - [ ] Protection against unauthorised edits
  - [ ] detecting inconsistent state
- `merge`
  - [ ] ...all object states
