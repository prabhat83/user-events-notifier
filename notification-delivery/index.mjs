import { DynamoDB, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import axios from "axios";

const dynamo = DynamoDBDocument.from(new DynamoDB());
const sns = new SNSClient({});

// DynamoDB table to record sent notifications
const SENT_TABLE = process.env.SENT_TABLE;
// SNS Topic ARN for notifications
const TOPIC_ARN = process.env.TOPIC_ARN;
// Optional Request Bin URL for testing
const REQUEST_BIN_URL = process.env.REQUEST_BIN_URL;

console.log("SENT_TABLE:", SENT_TABLE);
console.log("TOPIC_ARN:", TOPIC_ARN);
console.log("REQUEST_BIN_URL:", REQUEST_BIN_URL);

export const handler = async (event) => {
  for (const record of event) {
    const msg = JSON.parse(record.body);
    const messageKey = `${msg.eventType}#${msg.year}`;

    try {
      // Record the sent notification to prevent duplicates
      // It will fail if the userId already exists with the same messageKey
      const result = await dynamo.send(
        new PutItemCommand({
          TableName: SENT_TABLE,
          Item: {
            userId: { S: msg.userId },
            messageKey: { S: messageKey },
          },
          ConditionExpression: "attribute_not_exists(messageKey)",
        }),
      );

      console.log("DynamoDB result:", result);

      if (TOPIC_ARN) {
        await sns.send(
          new PublishCommand({
            TopicArn: TOPIC_ARN,
            Message: `Hey, ${msg.firstName} ${msg.lastName} it’s your ${msg.eventType}`,
          }),
        );
      }

      if (REQUEST_BIN_URL) {
        await axios.post(REQUEST_BIN_URL, {
          message: `Hey, ${msg.firstName} ${msg.lastName} it's your ${msg.eventType}`,
        });
      }
    } catch (err) {
      // Duplicate → safe to ignore
      console.log("Already sent, skipping", err.message);
    }
  }
};
