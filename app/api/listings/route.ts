import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

// creates reads updates and deletes seller listings and starts the mock publish flow

const client = new DynamoDBClient({
  region: "us-east-2",
});

const docClient = DynamoDBDocumentClient.from(client);

function getAppBaseUrl(request: Request): string {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, "");
  }

  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host") || new URL(request.url).host;

  return `${protocol}://${host}`.replace(/\/$/, "");
}

function normalizeCondition(value: unknown): string {
  const allowedConditions = new Set([
    "brand_new",
    "like_new",
    "used_good",
    "used_fair",
  ]);

  if (typeof value !== "string") {
    return "used_good";
  }

  return allowedConditions.has(value) ? value : "used_good";
}

export async function POST(request: Request): Promise<Response> {
  const { title, description, price, marketplaces, condition } =
    await request.json();

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
    condition: normalizeCondition(condition),
    marketplaces: Array.isArray(marketplaces) ? marketplaces : [],
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  const shouldPublishToBackbook = newItem.marketplaces.includes("backbook");

  try {
    await docClient.send(
      new PutCommand({
        TableName: "Listings",
        Item: newItem,
      }),
    );

    if (shouldPublishToBackbook) {
      await docClient.send(
        new PutCommand({
          TableName: "ActivityFeed",
          Item: {
            id: uuidv4(),
            listingId: newItem.id,
            eventType: "publish_requested",
            message: "Listing submitted to Backbook",
            createdAt: new Date().toISOString(),
          },
        }),
      );

      let publishAccepted = false;

      try {
        const appBaseUrl = getAppBaseUrl(request);
        const publishUrl = `${appBaseUrl}/api/mock-marketplace/publish`;

        console.log("Mock marketplace publish URL:", publishUrl);

        const publishResponse = await fetch(publishUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            listingId: newItem.id,
            title,
            description,
            price,
            idempotencyKey: newItem.id,
          }),
        });
        const publishResponseBody = await publishResponse.text();

        console.log(
          "Mock marketplace publish response status:",
          publishResponse.status,
        );
        console.log(
          "Mock marketplace publish response body:",
          publishResponseBody,
        );

        let publishResult: { success?: boolean; status?: string } = {};

        try {
          publishResult = JSON.parse(publishResponseBody) as {
            success?: boolean;
            status?: string;
          };
        } catch (parseError) {
          console.error(
            "Mock marketplace publish response was not valid JSON:",
            parseError,
          );
        }

        publishAccepted =
          publishResponse.ok && publishResult.success === true;

        if (!publishAccepted) {
          console.error("Mock marketplace publish was not accepted:", {
            status: publishResponse.status,
            body: publishResponseBody,
          });
        }
      } catch (error) {
        console.error("Mock marketplace publish error:", error);
      }

      await docClient.send(
        new PutCommand({
          TableName: "ActivityFeed",
          Item: {
            id: uuidv4(),
            listingId: newItem.id,
            eventType: publishAccepted ? "publish_accepted" : "publish_failed",
            message: publishAccepted
              ? "Listed on Backbook"
              : "Failed to publish to Backbook",
            createdAt: new Date().toISOString(),
          },
        }),
      );

      newItem.status = publishAccepted ? "published" : "failed";

      await docClient.send(
        new PutCommand({
          TableName: "Listings",
          Item: newItem,
        }),
      );
    }

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

export async function PUT(request: Request): Promise<Response> {
  const { id, title, description, price, condition } = await request.json();

  if (!id || !title || !description || price === undefined || price === null) {
    return Response.json(
      { error: "Missing required fields: id, title, description, price" },
      { status: 400 },
    );
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: "Listings",
        Key: { id },
        UpdateExpression:
          "SET title = :title, description = :description, price = :price, #condition = :condition",
        ExpressionAttributeNames: {
          "#condition": "condition",
        },
        ExpressionAttributeValues: {
          ":title": title,
          ":description": description,
          ":price": price,
          ":condition": normalizeCondition(condition),
        },
      }),
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("DynamoDB UPDATE error:", error);

    return Response.json(
      { error: "Failed to update listing" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json(
      { error: "Missing required query parameter: id" },
      { status: 400 },
    );
  }

  try {
    await docClient.send(
      new DeleteCommand({
        TableName: "Listings",
        Key: { id },
      }),
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("DynamoDB DELETE error:", error);

    return Response.json(
      { error: "Failed to delete listing" },
      { status: 500 },
    );
  }
}
