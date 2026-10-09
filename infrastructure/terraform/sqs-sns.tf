resource "aws_sqs_queue" "order_dlq" {
  name                      = "${var.order_queue_name}-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "order_events" {
  name                       = var.order_queue_name
  visibility_timeout_seconds = 30
  receive_wait_time_seconds  = 10
  message_retention_seconds  = 345600
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_sqs_queue_redrive_allow_policy" "order_dlq" {
  queue_url = aws_sqs_queue.order_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.order_events.arn]
  })
}

resource "aws_sns_topic" "order_events" {
  name = var.order_topic_name
}