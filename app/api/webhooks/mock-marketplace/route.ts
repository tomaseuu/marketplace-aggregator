import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({
  region: "us-east-2",
});

const docClient = DynamoDBDocumentClient.from(client);

function getDefaultMessage(eventType: string): string {
  if (eventType === "item_sold") {
    return "Item sold on marketplace";
  }

  if (eventType === "new_comment") {
    return "New comment received from marketplace";
  }

  return "Marketplace event received";
}

export async function POST(request: Request): Promise<Response> {
  const { listingId, eventType, message } = await request.json();

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

  const newEvent = {
    id: uuidv4(),
    listingId,
    eventType,
    message: message || getDefaultMessage(eventType),
    createdAt: new Date().toISOString(),
  };

  try {
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
