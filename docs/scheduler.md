# Birthday Scheduler Documentation

EventBridge-triggered Lambda function that scans users and sends birthday notifications at 9:00 AM in each user's timezone.

## Overview

The Birthday Scheduler service:
1. Runs on a schedule (typically every minute via EventBridge)
2. Scans all users from DynamoDB
3. Checks if today is their birthday (in their timezone)
4. Checks if the current time is exactly 9:00 AM
5. Sends notification messages to SQS for processing

## Architecture

```
EventBridge Rule (Every Minute)
    ↓
[Birthday Scheduler Lambda]
    ├→ DynamoDB (Scan Users)
    └→ SQS (Send Messages)
        ↓
    [Notification Delivery Lambda]
```

## Environment Variables

- `USERS_TABLE`: DynamoDB table name containing user data (e.g., `users`)
- `QUEUE_URL`: SQS queue URL for notification delivery (e.g., `https://sqs.us-east-1.amazonaws.com/123456789012/birthday-notifications.fifo`)

## EventBridge Trigger Configuration

### Schedule Expression
```
rate(1 minute)
```

This runs the Lambda once per minute. The exact 9:00 AM check happens inside the Lambda for each user's timezone.

## SQS Message Format

**Queue Type:** FIFO (exactly-once processing)

**Message Structure:**
```json
{
  "userId": "user-123",
  "firstName": "John",
  "lastName": "Doe",
  "year": 2026
}
```

**Queue Attributes:**
- `MessageGroupId`: User ID (ensures messages for same user are processed in order)
- `MessageDeduplicationId`: `{userId}-{year}` (prevents duplicate messages within SQS)

## Performance Considerations

### DynamoDB Scan Impact
- **Scans entire table** every minute
- For small user bases (< 100K items): ~1-2 seconds per scan
- For large user bases (> 1M items): Consider adding filters

### Optimization Strategies

1. **Add FilterExpression:**
```javascript
new ScanCommand({
  TableName: USERS_TABLE,
  FilterExpression: "timezone = :tz",
  ExpressionAttributeValues: {
    ":tz": { S: "America/New_York" }
  }
})
```

2. **Use Query instead of Scan:**
Requires a different data model (timezone as partition key).

3. **Batch by Timezone:**
Deploy separate Lambda instances for different timezone regions.

### Current Implementation
Uses full table scan - simple and works well for up to 100K users.

## Configuration Examples

### Production Setup
```bash
export USERS_TABLE="production-users"
export QUEUE_URL="https://sqs.us-east-1.amazonaws.com/123456789012/birthday-notifications.fifo"
```

### Development Setup
```bash
export USERS_TABLE="dev-users"
export QUEUE_URL="https://sqs.us-east-1.amazonaws.com/123456789012/dev-birthday-notifications.fifo"
```