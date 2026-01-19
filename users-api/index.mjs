import {
  DynamoDB,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";

import { DateTime } from "luxon";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { v4 as uuid } from "uuid";

const dynamo = DynamoDBDocument.from(new DynamoDB());

// DynamoDB table for users
const USERS_TABLE = process.env.USERS_TABLE;

// Cached list of valid timezones
const TIMEZONES = Intl.supportedValuesOf("timeZone");

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const method = event.requestContext.http.method;
  const userId = event.queryStringParameters?.userId;

  console.log("HTTP Method:", method);
  console.log("UserId:", userId);

  try {
    switch (method) {
      case "POST":
        return await createUser(event);
      case "PUT":
        return await updateUser(userId, event);
      case "DELETE":
        return await deleteUser(userId);
      case "GET":
        return await getUser(userId);
      default:
        return response(400, {
          error: "Bad request",
          message: `Unsupported HTTP method: ${method}`,
        });
    }
  } catch (err) {
    console.error("Error:", err);

    return response(500, {
      error: "Internal server error",
      message: err.message,
    });
  }
};

async function createUser(event) {
  const body = JSON.parse(event.body);
  const userId = uuid();

  if (!TIMEZONES.includes(body.timezone)) {
    return response(400, {
      error: "Validation error",
      message: `Invalid timezone: ${body.timezone}`,
    });
  }

  const birthday = DateTime.fromISO(body.birthday, { zone: body.timezone });
  if (!birthday.isValid) {
    return response(400, {
      error: "Validation error",
      message: "Invalid birthday format (use ISO 8601: YYYY-MM-DD)",
    });
  }

  if (!body.firstName || !body.lastName) {
    return response(400, {
      error: "Validation error",
      message: "firstName and lastName are required",
    });
  }

  const result = await dynamo.send(
    new PutItemCommand({
      TableName: USERS_TABLE,
      Item: {
        userId: { S: userId },
        firstName: { S: body.firstName },
        lastName: { S: body.lastName },
        birthday: { S: body.birthday },
        birthdayIso: { S: birthday.toISO() },
        timezone: { S: body.timezone },
        createdAt: { S: new Date().toISOString() },
      },
    }),
  );

  if (result.$metadata.httpStatusCode !== 200) {
    throw new Error("Failed to create user", result);
  }

  return response(201, {
    success: true,
    message: "User created successfully",
    data: { userId },
  });
}

async function updateUser(userId, event) {
  const body = JSON.parse(event.body);

  if (body.firstName || body.lastName || body.birthday) {
    return response(400, {
      error: "Validation error",
      message: "Only timezone can be updated",
    });
  }

  if (!TIMEZONES.includes(body.timezone)) {
    return response(400, {
      error: "Validation error",
      message: `Invalid timezone: ${body.timezone}`,
    });
  }

  await dynamo.send(
    new UpdateItemCommand({
      TableName: USERS_TABLE,
      Key: { userId: { S: userId } },
      UpdateExpression: "SET timezone = :tz",
      ExpressionAttributeValues: {
        ":tz": { S: body.timezone },
      },
    }),
  );

  return response(200, { success: true, message: "User updated successfully" });
}

async function deleteUser(userId) {
  await dynamo.send(
    new DeleteItemCommand({
      TableName: USERS_TABLE,
      Key: { userId: { S: userId } },
    }),
  );

  return response(204, null);
}

async function getUser(userId) {
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: USERS_TABLE,
      Key: { userId: { S: userId } },
    }),
  );

  if (!result.Item) {
    return response(404, {
      error: "Not found",
      message: `User with ID ${userId} not found`,
    });
  }

  return response(200, result.Item);
}

export function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    },
    body: body !== null ? JSON.stringify(body) : "",
  };
}
