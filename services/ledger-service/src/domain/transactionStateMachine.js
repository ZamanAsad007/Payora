/**
 * TransactionStateMachine: Enforces legal lifecycle transitions for financial transactions.
 */
export const TransactionState = Object.freeze({
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  REVERSED: "REVERSED",
});

const ALLOWED_TRANSITIONS = {
  [TransactionState.PENDING]: [TransactionState.COMPLETED, TransactionState.FAILED],
  [TransactionState.COMPLETED]: [TransactionState.REVERSED],
  [TransactionState.FAILED]: [],
  [TransactionState.REVERSED]: [],
};

export class TransactionStateMachine {
  /**
   * Check if transition from currentState to nextState is valid.
   */
  static canTransition(currentState, nextState) {
    const allowed = ALLOWED_TRANSITIONS[currentState] || [];
    return allowed.includes(nextState);
  }

  /**
   * Validate transition and throw if illegal.
   */
  static transition(currentState, nextState) {
    if (!this.canTransition(currentState, nextState)) {
      const err = new Error(
        `Illegal transaction state transition from ${currentState} to ${nextState}`
      );
      err.code = "ILLEGAL_STATE_TRANSITION";
      err.statusCode = 400;
      throw err;
    }
    return nextState;
  }
}
