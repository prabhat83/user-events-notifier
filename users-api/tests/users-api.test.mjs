import { expect } from "chai";
import { mockClient } from "aws-sdk-client-mock";
import {
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

let handler;
const ddbMock = mockClient(DynamoDBDocument);

const baseEvent = {
  requestContext: { http: { method: "GET" } },
  queryStringParameters: {},
  body: "",
};

describe("users-api handler", () => {
  before(async () => {
    process.env.USERS_TABLE = "test-users";
    ({ handler } = await import("../index.mjs"));
  });

  beforeEach(() => {
    ddbMock.reset();
  });

  it("creates user on POST", async () => {
    ddbMock.on(PutItemCommand).resolves({ $metadata: { httpStatusCode: 200 } });

    const event = {
      ...baseEvent,
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        birthday: "1990-01-01",
        timezone: "America/New_York",
      }),
    };

    const res = await handler(event);
    const body = JSON.parse(res.body);

    expect(res.statusCode).to.equal(201);
    expect(body.success).to.be.true;
    expect(ddbMock.commandCalls(PutItemCommand).length).to.equal(1);
  });

  it("rejects invalid timezone", async () => {
    const event = {
      ...baseEvent,
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        birthday: "1990-01-01",
        timezone: "Invalid/Zone",
      }),
    };

    const res = await handler(event);
    expect(res.statusCode).to.equal(400);
  });

  it("rejects invalid birthday format", async () => {
    const event = {
      ...baseEvent,
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        birthday: "01-01-1990",
        timezone: "America/New_York",
      }),
    };

    const res = await handler(event);
    expect(res.statusCode).to.equal(400);
  });

  it("gets user on GET", async () => {
    ddbMock.on(GetItemCommand).resolves({
      Item: {
        userId: { S: "u1" },
        firstName: { S: "John" },
        lastName: { S: "Doe" },
        birthday: { S: "1990-01-01" },
        timezone: { S: "America/New_York" },
      },
    });

    const event = {
      ...baseEvent,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: { userId: "u1" },
    };

    const res = await handler(event);
    expect(res.statusCode).to.equal(200);
    expect(ddbMock.commandCalls(GetItemCommand).length).to.equal(1);
  });

  it("returns 404 when user missing", async () => {
    ddbMock.on(GetItemCommand).resolves({});

    const event = {
      ...baseEvent,
      requestContext: { http: { method: "GET" } },
      queryStringParameters: { userId: "missing" },
    };

    const res = await handler(event);
    expect(res.statusCode).to.equal(404);
  });

  it("updates timezone on PUT", async () => {
    ddbMock.on(UpdateItemCommand).resolves({});

    const event = {
      ...baseEvent,
      requestContext: { http: { method: "PUT" } },
      queryStringParameters: { userId: "u1" },
      body: JSON.stringify({ timezone: "Europe/London" }),
    };

    const res = await handler(event);
    expect(res.statusCode).to.equal(200);
    expect(ddbMock.commandCalls(UpdateItemCommand).length).to.equal(1);
  });

  it("rejects PUT with non-timezone fields", async () => {
    const event = {
      ...baseEvent,
      requestContext: { http: { method: "PUT" } },
      queryStringParameters: { userId: "u1" },
      body: JSON.stringify({ firstName: "Hack" }),
    };

    const res = await handler(event);
    expect(res.statusCode).to.equal(400);
  });

  it("deletes user on DELETE", async () => {
    ddbMock.on(DeleteItemCommand).resolves({});

    const event = {
      ...baseEvent,
      requestContext: { http: { method: "DELETE" } },
      queryStringParameters: { userId: "u1" },
    };

    const res = await handler(event);
    expect(res.statusCode).to.equal(204);
    expect(ddbMock.commandCalls(DeleteItemCommand).length).to.equal(1);
  });
});
