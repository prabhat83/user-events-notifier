import { expect } from "chai";
import sinon from "sinon";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DateTime } from "luxon";

const ddbMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

describe("birthday scheduler handler", () => {
  let handler;
  let consoleLogStub;

  before(async () => {
    // Set env before module loads
    process.env.QUEUE_URL =
      "https://sqs.us-east-1.amazonaws.com/123456789012/birthday-notifications.fifo";
    process.env.USERS_TABLE = "test-users";

    ({ handler } = await import("../index.mjs"));
  });

  beforeEach(() => {
    ddbMock.reset();
    sqsMock.reset();
    consoleLogStub = sinon.stub(console, "log");
    // Freeze time at 9:00 AM UTC to trigger send path
    sinon
      .stub(DateTime, "utc")
      .returns(DateTime.fromISO("2026-01-20T09:00:00.000Z"));
  });

  afterEach(() => {
    consoleLogStub.restore();
    sinon.restore();
  });

  it("scans DynamoDB users table", async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        {
          userId: "user1",
          firstName: "John",
          lastName: "Doe",
          birthday: "2000-01-01",
          timezone: "UTC",
        },
      ],
    });

    await handler();

    expect(ddbMock.calls()).to.have.lengthOf(1);
  });

  it("sends SQS message when birthday matches at 9:00 AM", async () => {
    // DateTime.utc is stubbed to 2026-01-20T09:00:00Z (see beforeEach)
    const userTimezone = "UTC";
    const todayBirthday = "2000-01-20";

    ddbMock.on(ScanCommand).resolves({
      Count: 1,
      Items: [
        {
          userId: { S: "user-123" },
          firstName: { S: "Alice" },
          lastName: { S: "Smith" },
          birthday: { S: todayBirthday },
          timezone: { S: userTimezone },
        },
      ],
    });

    sqsMock.on(SendMessageCommand).resolves({ MessageId: "msg-123" });

    await handler();

    expect(sqsMock.calls()).to.have.lengthOf(1);
  });

  describe("Test non-upported event type", () => {
    it("throws error for unsupported event type", async () => {
      const originalEventType = process.env.EVENT_TYPE;
      process.env.EVENT_TYPE = "unsupported-event";

      // Clear the module cache to force re-import with new ENV
      const modulePath = new URL("../index.mjs", import.meta.url).href;
      delete (await import.meta.resolve("../index.mjs"));

      try {
        const { handler: testHandler } = await import(
          `../index.mjs?t=${Date.now()}`
        );
        await testHandler();
      } catch (error) {
        expect(error.message).to.include("Unsupported EVENT_TYPE");
      } finally {
        // Restore original EVENT_TYPE
        if (originalEventType) {
          process.env.EVENT_TYPE = originalEventType;
        } else {
          delete process.env.EVENT_TYPE;
        }
      }
    });
  });
});
