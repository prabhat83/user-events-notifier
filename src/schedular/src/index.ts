import { DynamoDBClient, ScanCommand, AttributeValue } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DateTime } from "luxon";

const dynamo = new DynamoDBClient({});
const sqs = new SQSClient({});

// SQS Queue URL for sending birthday messages
const QUEUE_URL = process.env.QUEUE_URL;
// DynamoDB table to read users from
const USERS_TABLE = process.env.USERS_TABLE;

// Define the User interface representing the structure of user items in DynamoDB
interface User {
  userId: AttributeValue;
  firstName: AttributeValue;
  lastName: AttributeValue;
  birthday: AttributeValue;
  timezone: AttributeValue;
  createdAt?: AttributeValue;
}

export const handler = async () => {
  // Scan all users from the DynamoDB table
  // This can be optimized with filters by timezone etc.
  const users = await dynamo.send(
    new ScanCommand({
      TableName: USERS_TABLE,
    }),
  );

  console.log("Found users with birthdays today:", users.Count);

  for (const item of users.Items as Record<keyof User, AttributeValue>[] ?? []) {
    console.log("User:", item.firstName.S, item.lastName.S);

    const timezone = item.timezone.S;
    const birthday = item.birthday.S;

    if (!timezone || !birthday) {
      console.log("Skipping user due to missing timezone or birthday");
      continue;
    }

    const now = DateTime.utc().setZone(timezone);
    const dob = DateTime.fromISO(birthday);

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
            year: now.year,
          }),
        }),
      );
      console.log("SQS Send Result:", res);
    }
  }
};
