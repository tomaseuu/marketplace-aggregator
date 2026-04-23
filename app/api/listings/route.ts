import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({
  region: "us-east-2",
});

const docClient = DynamoDBDocumentClient.from(client);

export async function POST(request: Request): Promise<Response> {
  const { title, description, price } = await request.json();

  if (!title || !description || price === undefined || price === null) {
    return Response.json(
      { error: "Missing required fields: title, description, price" },
      { status: 400 },
    );
  }

  const newItem = {
    id: uuidv4(),
    title,
    description,
    price,
    createdAt: new Date().toISOString(),
  };

  const activityItem = {
    id: uuidv4(),
    listingId: newItem.id,
    eventType: "publish_requested",
    message: "Listing submitted for marketplace publish",
    createdAt: new Date().toISOString(),
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: "Listings",
        Item: newItem,
      }),
    );

    await docClient.send(
      new PutCommand({
        TableName: "ActivityFeed",
        Item: activityItem,
      }),
    );

    return Response.json({
      success: true,
      listing: newItem,
    });
  } catch (error) {
    console.error("DynamoDB error:", error);

    return Response.json({ error: "Failed to save listing" }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "Listings",
      }),
    );

    return Response.json({
      success: true,
      listings: result.Items || [],
    });
  } catch (error) {
    console.error("DynamoDB GET error:", error);

    return Response.json(
      { error: "Failed to fetch listings" },
      { status: 500 },
    );
  }
}
