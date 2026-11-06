# Risk Service

Asynchronous fraud detection, velocity analysis, and risk rule engine.

## Responsibilities
- Consume transactional outbox events from Redis BullMQ queue
- Evaluate risk rules: velocity thresholds, unexpected spikes, new payees, unverified devices
- Raise risk flags (`risk_flags`) for review
- Trigger automated temporary account holds for critical risk thresholds
