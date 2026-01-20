import { DynamoDB, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DateTime } from "luxon";

const dynamo = DynamoDBDocument.from(new DynamoDB());
const sqs = new SQSClient({});

// SQS Queue URL for sending birthday messages
const QUEUE_URL = process.env.QUEUE_URL;
// DynamoDB table to read users from
const USERS_TABLE = process.env.USERS_TABLE;

const EVENT_TYPE = process.env.EVENT_TYPE || "birthday";

export const handler = async () => {
  if (EVENT_TYPE !== "birthday" && EVENT_TYPE !== "anniversary") {
    throw new Error("Unsupported EVENT_TYPE: " + EVENT_TYPE);
  }

  // Scan all users from the DynamoDB table
  // This can be optimized with filters by timezone etc.
  const users = await dynamo.send(
    new ScanCommand({
      TableName: USERS_TABLE,
    }),
  );

  console.log("Number of users:", users.Count);

  for (const item of users.Items ?? []) {
    console.log("User:", item.firstName.S, item.lastName.S);

    const timezone = item.timezone.S;
    let eventDate =
      EVENT_TYPE === "birthday" ? item.birthday.S : item.anniversary.S;

    const now = DateTime.utc().setZone(timezone);
    const dob = DateTime.fromISO(eventDate);

    if (
      now.hour === 9 &&
      now.minute === 0 &&
      now.day === dob.day &&
      now.month === dob.month
    ) {
      const res = await sqs.send(
        new SendMessageCommand({
          QueueUrl: QUEUE_URL,
          MessageGroupId: item.userId.S,
          MessageDeduplicationId: `${item.userId.S}-${now.year}`,
          MessageBody: JSON.stringify({
            userId: item.userId.S,
            firstName: item.firstName.S,
            lastName: item.lastName.S,
            eventType: EVENT_TYPE,
            year: now.year,
          }),
        }),
      );
      console.log("SQS Send Result:", res);
    }
  }
};
