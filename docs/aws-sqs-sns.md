# AWS SQS and SNS Order Events

## Flow

```text
POST /api/v1/orders
  -> PostgreSQL transaction commits
  -> SQS ORDER_CREATED event
  -> worker receives and validates event
  -> SNS notification topic
```

The event contains only `eventType`, `orderId`, `userId`, and `timestamp`. It is published after the existing transactional checkout returns successfully. If SQS publishing fails, the order remains successful and the failure is logged; the API does not attempt to undo committed database work. A production system could use a transactional Outbox Pattern for guaranteed publication.

The worker polls SQS with long polling and a visibility timeout. It validates event structure, publishes a minimal event to SNS, and deletes the SQS message only after SNS processing succeeds. Invalid or failed messages remain available for retry and can eventually be routed to a configured dead-letter queue. Duplicate delivery is expected: the worker tracks processed order IDs during its process lifetime and does not create another order record, making repeated `ORDER_CREATED` handling safe.

SNS is used as a fan-out notification layer after successful worker processing. It does not send email or SMS directly in this phase. Future subscribers can consume the topic independently.

AWS configuration uses `AWS_REGION`, `AWS_SQS_ORDER_QUEUE_URL`, and `AWS_SNS_ORDER_TOPIC_ARN`. Missing configuration leaves the API and worker usable for local development. SDK calls are backend/worker-only; React never communicates with SQS or SNS. Neither SQS nor SNS has been deployed by this project.
