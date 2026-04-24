import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

// this route reads activity feed items so the seller dashboard can show what happened

type ActivityRecord = {
  createdAt?: string;
};

const credentials =
  process.env.APP_AWS_ACCESS_KEY_ID && process.env.APP_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const client = new DynamoDBClient({
  region: "us-east-2",
  credentials,
});

const docClient = DynamoDBDocumentClient.from(client);

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get("listingId");

  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "ActivityFeed",
        ...(listingId
          ? {
              FilterExpression: "listingId = :listingId",
              ExpressionAttributeValues: {
                ":listingId": listingId,
              },
            }
          : {}),
      }),
    );
    const activity = (result.Items ?? []) as ActivityRecord[];

    activity.sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    );

    return Response.json({
      success: true,
      activity,
    });
  } catch (error) {
    console.error("DynamoDB Activity GET error:", error);

    return Response.json(
      { error: "Failed to fetch activity" },
      { status: 500 },
    );
  }
}
