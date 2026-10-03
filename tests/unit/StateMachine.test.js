const {
  StateMachine,
  InvalidTransitionError,
  STATES,
  TRANSITIONS,
} = require('../../src/dataStructures/StateMachine');

describe('StateMachine', () => {
  test('transition table matches the spec', () => {
    expect([...TRANSITIONS.get('PENDING')]).toEqual(['RUNNING', 'CANCELLED']);
    expect([...TRANSITIONS.get('RUNNING')]).toEqual(['COMPLETED', 'FAILED', 'RETRYING']);
    expect([...TRANSITIONS.get('RETRYING')]).toEqual(['RUNNING', 'FAILED']);
    expect(TRANSITIONS.get('FAILED').size).toBe(0);
    expect(TRANSITIONS.get('COMPLETED').size).toBe(0);
    expect(TRANSITIONS.get('CANCELLED').size).toBe(0);
  });

  test('allows valid transitions and updates job.status', () => {
    const sm = new StateMachine();
    const job = { id: '1', status: STATES.PENDING };
    sm.transition(job, STATES.RUNNING);
    expect(job.status).toBe('RUNNING');
    sm.transition(job, STATES.RETRYING);
    sm.transition(job, STATES.RUNNING);
    sm.transition(job, STATES.COMPLETED);
    expect(job.status).toBe('COMPLETED');
  });

  test('throws InvalidTransitionError for illegal moves and leaves status unchanged', () => {
    const sm = new StateMachine();
    const job = { id: '1', status: STATES.PENDING };
    expect(() => sm.transition(job, STATES.COMPLETED)).toThrow(InvalidTransitionError);
    expect(job.status).toBe('PENDING');

    const done = { id: '2', status: STATES.COMPLETED };
    expect(() => sm.transition(done, STATES.RUNNING)).toThrow(/COMPLETED -> RUNNING/);
  });

  test('throws for unknown states', () => {
    const sm = new StateMachine();
    expect(() => sm.transition({ id: '1', status: 'WEIRD' }, 'RUNNING')).toThrow(InvalidTransitionError);
    expect(() => sm.transition({ id: '1', status: 'PENDING' }, 'WEIRD')).toThrow(InvalidTransitionError);
  });

  test('InvalidTransitionError exposes from/to and a 409 status', () => {
    const sm = new StateMachine();
    try {
      sm.transition({ id: '1', status: 'FAILED' }, 'RUNNING');
    } catch (err) {
      expect(err.from).toBe('FAILED');
      expect(err.to).toBe('RUNNING');
      expect(err.statusCode).toBe(409);
    }
    expect.assertions(3);
  });

  test('calls onTransition(job, from, to) after every successful move', () => {
    const onTransition = jest.fn();
    const sm = new StateMachine({ onTransition });
    const job = { id: '1', status: 'PENDING' };
    sm.transition(job, 'RUNNING');
    expect(onTransition).toHaveBeenCalledWith(job, 'PENDING', 'RUNNING');

    expect(() => sm.transition(job, 'PENDING')).toThrow();
    expect(onTransition).toHaveBeenCalledTimes(1); // not called for invalid moves
  });

  test('canTransition, isTerminal and allowedFrom helpers', () => {
    const sm = new StateMachine();
    expect(sm.canTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(sm.canTransition('RUNNING', 'CANCELLED')).toBe(false);
    expect(sm.isTerminal('COMPLETED')).toBe(true);
    expect(sm.isTerminal('RUNNING')).toBe(false);
    expect(sm.allowedFrom('RETRYING')).toEqual(['RUNNING', 'FAILED']);
    expect(sm.allowedFrom('NOPE')).toEqual([]);
  });
});
