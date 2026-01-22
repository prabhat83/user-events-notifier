import { DynamoDB, QueryCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DateTime } from "luxon";
import { getTimezonesWith9AM } from "./utils.mjs";

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

  const timezoneWith9AM = getTimezonesWith9AM();
  console.log(
    `Timezones with 9 AM now (${timezoneWith9AM.length}):`,
    JSON.stringify(timezoneWith9AM, null, 2),
  );

  if (timezoneWith9AM.length === 0) {
    console.log("No timezones with 9:00 AM right now, skipping");
    return;
  }

  try {
    // Query each timezone in parallel
    const queryPromises = timezoneWith9AM.map((tz) =>
      dynamo.send(
        new QueryCommand({
          TableName: USERS_TABLE,
          IndexName: "timezone-index",
          KeyConditionExpression: "#tz = :tz",
          ExpressionAttributeNames: {
            "#tz": "timezone",
          },
          ExpressionAttributeValues: {
            ":tz": { S: tz.timezone },
          },
        }),
      ),
    );

    const results = await Promise.all(queryPromises);

    // Combine all users from all timezones
    const users = results.flatMap((result) => result.Items ?? []);

    // Only send to users with birthdays TODAY
    const matchingUsers = users.filter((item) => {
      const timezone = item.timezone.S;
      const birthday = item.birthday.S;
      const now = DateTime.utc().setZone(timezone);
      const dob = DateTime.fromISO(birthday);

      return now.day === dob.day && now.month === dob.month;
    });

    console.log("Number of Users to process:", matchingUsers.length);

    const now = DateTime.utc();

    for (const item of matchingUsers) {
      console.log("User:", item.firstName.S, item.lastName.S);

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
  } catch (err) {
    console.error("Error processing users:", err);
    throw err;
  }
};
