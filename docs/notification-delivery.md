# Notification Delivery Documentation

Lambda function that processes birthday notifications from SQS and delivers them via SNS and/or webhook.

## Overview

The Notification Delivery service:
1. Consumes messages from SQS queue
2. Records sent notifications in DynamoDB to prevent duplicates
3. Sends notifications via SNS (email/SMS)
4. Optionally sends to webhook endpoint for testing
5. Handles duplicate detection using conditional writes

## Environment Variables

- `SENT_TABLE`: DynamoDB table name to track sent notifications (e.g., `sentMessages`)
- `TOPIC_ARN`: AWS SNS Topic ARN for sending notifications (e.g., `arn:aws:sns:us-east-1:123456789012:birthday-notifications`)
- `REQUEST_BIN_URL`: (Optional) Webhook URL for testing/logging notifications (e.g., `https://requestbin.example.com/abc123`)

## Architecture

```
SQS Queue
    ↓
[Notification Delivery Lambda]
    ├→ DynamoDB (duplicate prevention)
    ├→ SNS (email/SMS notifications)
    └→ Webhook (optional testing)
```

## Input: SQS Message Format

Messages from the scheduler Lambda are received in SQS batch format:

```json
{
 [
    {
      "messageId": "msg-id-123",
      "body": "{\"userId\":\"user-123\",\"firstName\":\"John\",\"lastName\":\"Doe\",\"year\":2026}",
      "attributes": {
        "ApproximateReceiveCount": "1",
        "SentTimestamp": "1642603800000"
      },
      "messageAttributes": {}
    }
  ]
}
```

## Processing Flow

### 1. Parse Message
```javascript
const msg = JSON.parse(record.body);
// Result:
// {
//   userId: "user-123",
//   firstName: "John",
//   lastName: "Doe",
//   year: 2026
// }
```

### 2. Create Message Key
```javascript
const messageKey = `birthday#${msg.year}`;
// Result: "birthday#2026"
```

### 3. Record in DynamoDB (Duplicate Prevention)
```javascript
await dynamo.send(new PutItemCommand({
  TableName: SENT_TABLE,
  Item: {
    userId: { S: msg.userId },
    messageKey: { S: messageKey }
  },
  ConditionExpression: "attribute_not_exists(messageKey)"
}));
```

- Only succeeds if the messageKey doesn't already exist for this user
- If duplicate: throws `ConditionalCheckFailedException` (caught and logged)
- If new: record is created, notification proceeds

### 4. Send SNS Notification
```javascript
await sns.send(new PublishCommand({
  TopicArn: TOPIC_ARN,
  Message: `Hey, John Doe it's your birthday`
}));
```

### 5. Send Webhook (Optional)
```javascript
await axios.post(REQUEST_BIN_URL, {
  message: `Hey, John Doe it's your birthday`
});
```