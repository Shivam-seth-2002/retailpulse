# Interview Notes

## Architecture Overview
RetailPulse is designed as a modular monolithic backend. We chose Node.js with `better-sqlite3` (in WAL mode) for maximum single-node speed without the operational overhead of a separate database server or Redis. 
The system features a REST API layer, an Intent Engine for complex analytical queries, and a Workflow Orchestrator for long-running asynchronous tasks (like large CSV imports). 

## Custom Data Structures

### 1. LRUCache
**Purpose:** Caches the results of the Intent Engine to reduce database load for repeated, heavy analytical queries.
**Implementation:** Combines a `Map` (for O(1) key lookups) and a Doubly Linked List (to track recency). 
**Time Complexity:** O(1) for `get()`, `set()`, and `delete()`.
**Space Complexity:** O(N) where N is the `maxSize`.

### 2. JobQueue
**Purpose:** Manages pending jobs for the Workflow Orchestrator.
**Implementation:** Instead of using an array (where `shift()` is O(N)), we use a custom Linked List. To support priority buckets (High, Mid, Low), it maintains an array/map of Linked Lists.
**Time Complexity:** O(1) for `enqueue()`, `dequeue()`, and `peek()`. Job removal via ID is also O(1) because we keep a Map of Job ID to Linked List Node.

### 3. FilterTree
**Purpose:** Safely parses deeply nested JSON logical filters from the client into an Abstract Syntax Tree (AST).
**Implementation:** Recursively creates `LogicalNode` (AND/OR/NOT) and `ConditionNode` (field, op, value) instances. Limits max depth (5) and total nodes (30) to prevent algorithmic complexity attacks.

### 4. StateMachine
**Purpose:** Governs the lifecycle of a background job, preventing illegal state transitions.
**Implementation:** Uses a Map of Sets (a transition table). 
**Time Complexity:** O(1) to validate any state transition.

## Security & SQL Injection Prevention
Instead of using an ORM, we wrote raw SQL queries for performance and clarity. 
SQL injection is prevented at multiple layers:
1. **Validation:** Joi enforces type constraints on all API inputs.
2. **Filter Whitelists:** `FilterTree` only allows specific comparison operators. `filterCompiler` strictly checks the requested `field` against a hardcoded Map of valid SQL columns. 
3. **Prepared Statements:** No user input is ever concatenated into SQL strings. The `filterCompiler` replaces all values with `?` placeholders and passes the actual values as parameter bindings to the `better-sqlite3` driver.

## Workflow Engine and Retries
The orchestrator polls the `JobQueue` (via an asynchronous loop) and dispatches jobs up to a `concurrency` limit. 
- **Steps:** Workflows are defined as an array of step names. The worker executes each step sequentially, updating the `current_step` in the database.
- **Failures & Backoff:** If a step throws an error, the orchestrator catches it. If attempts < `maxRetries`, the job is marked `RETRYING` and re-enqueued using `setTimeout` with an exponential backoff formula (`base * 2^(attempts-1)`). Otherwise, it fails.
- **Crash Recovery:** On server boot, the orchestrator re-enqueues all `PENDING` and `RETRYING` jobs from the database, and transitions any abandoned `RUNNING` jobs to `RETRYING`.
