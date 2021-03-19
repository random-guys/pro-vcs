/**
 * `InvalidOperation` is usually thrown when a user tries to perform an operation on a frozen payload
 */
export class InvalidOperation extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * `InconsistentState` should only be thrown if invariants are not properly enforced, or possible concurrency issues.
 */
export class InconsistentState extends Error {
  constructor() {
    super("The database is in an inconsistent state. Please resolve");
  }
}
