import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({
  region: "us-east-2",
});

const docClient = DynamoDBDocumentClient.from(client);
const ALLOWED_EVENT_TYPES = new Set(["item_sold", "new_comment"]);
// In deployment, keep this aligned with NEXT_PUBLIC_MOCK_MARKETPLACE_WEBHOOK_SECRET
// so the Backbook simulator and webhook receiver agree on the shared secret.
const DEFAULT_WEBHOOK_SECRET = "dev-secret";

function getDefaultMessage(eventType: string): string {
  if (eventType === "item_sold") {
    return "Item sold on Backbook";
  }

  if (eventType === "new_comment") {
    return "New comment from Backbook";
  }

  return "Backbook event received";
}

export async function POST(request: Request): Promise<Response> {
  const expectedSecret =
    process.env.MOCK_MARKETPLACE_WEBHOOK_SECRET ?? DEFAULT_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get("x-mock-marketplace-secret");

  if (receivedSecret !== expectedSecret) {
    return Response.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  const { listingId, eventType, message, eventId, idempotencyKey, createdAt } =
    await request.json();

  if (!listingId) {
    return Response.json(
      { error: "Missing required field: listingId" },
      { status: 400 },
    );
  }

  if (!eventType) {
    return Response.json(
      { error: "Missing required field: eventType" },
      { status: 400 },
    );
  }

  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    return Response.json(
      { error: "Unsupported eventType" },
      { status: 400 },
    );
  }

  const resolvedMessage = message || getDefaultMessage(eventType);
  const resolvedCreatedAt =
    typeof createdAt === "string" && createdAt
      ? createdAt
      : new Date().toISOString();
  const resolvedEventId =
    eventId ||
    idempotencyKey ||
    (listingId && eventType
      ? `${listingId}:${eventType}:${resolvedMessage}:${resolvedCreatedAt}`
      : uuidv4());

  const newEvent = {
    id: resolvedEventId,
    listingId,
    eventType,
    message: resolvedMessage,
    createdAt: resolvedCreatedAt,
  };

  try {
    const existingEvent = await docClient.send(
      new GetCommand({
        TableName: "ActivityFeed",
        Key: { id: resolvedEventId },
      }),
    );

    if (existingEvent.Item) {
      return Response.json({
        success: true,
        duplicate: true,
      });
    }

    await docClient.send(
      new PutCommand({
        TableName: "ActivityFeed",
        Item: newEvent,
      }),
    );

    if (eventType === "item_sold") {
      await docClient.send(
        new UpdateCommand({
          TableName: "Listings",
          Key: { id: listingId },
          UpdateExpression: "SET #status = :status",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":status": "sold",
          },
        }),
      );
    }

    return Response.json({
      success: true,
      activity: newEvent,
    });
  } catch (error) {
    console.error("DynamoDB webhook error:", error);

    return Response.json(
      { error: "Failed to save activity event" },
      { status: 500 },
    );
  }
}
