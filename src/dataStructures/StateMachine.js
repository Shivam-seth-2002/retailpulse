/**
 * StateMachine implementation for job status transitions.
 */

class InvalidTransitionError extends Error {
  constructor(from, to) {
    super(`Invalid state transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
    this.statusCode = 409;
    this.code = 'INVALID_TRANSITION';
    this.from = from;
    this.to = to;
  }
}

const STATES = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
  CANCELLED: 'CANCELLED'
};

const TRANSITIONS = new Map([
  ['PENDING',   new Set(['RUNNING', 'CANCELLED'])],
  ['RUNNING',   new Set(['COMPLETED', 'FAILED', 'RETRYING'])],
  ['RETRYING',  new Set(['RUNNING', 'FAILED'])],
  ['FAILED',    new Set([])],
  ['COMPLETED', new Set([])],
  ['CANCELLED', new Set([])],
]);

class StateMachine {
  constructor({ onTransition } = {}) {
    this.onTransition = onTransition;
  }

  transition(job, toState) {
    const fromState = job.status;

    if (!TRANSITIONS.has(fromState) || !TRANSITIONS.has(toState)) {
      throw new InvalidTransitionError(fromState, toState);
    }

    if (!this.canTransition(fromState, toState)) {
      throw new InvalidTransitionError(fromState, toState);
    }

    job.status = toState;

    if (this.onTransition) {
      this.onTransition(job, fromState, toState);
    }
  }

  canTransition(fromState, toState) {
    const allowed = TRANSITIONS.get(fromState);
    return allowed ? allowed.has(toState) : false;
  }

  isTerminal(state) {
    const allowed = TRANSITIONS.get(state);
    return allowed ? allowed.size === 0 : false;
  }

  allowedFrom(state) {
    const allowed = TRANSITIONS.get(state);
    return allowed ? Array.from(allowed) : [];
  }
}

module.exports = {
  StateMachine,
  InvalidTransitionError,
  STATES,
  TRANSITIONS
};
