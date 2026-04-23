import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: "us-east-2",
});

const docClient = DynamoDBDocumentClient.from(client);

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get("listingId");

  if (!listingId) {
    return Response.json(
      { error: "Missing required query parameter: listingId" },
      { status: 400 },
    );
  }

  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: "ActivityFeed",
        FilterExpression: "listingId = :listingId",
        ExpressionAttributeValues: {
          ":listingId": listingId,
        },
      }),
    );

    return Response.json({
      success: true,
      activity: result.Items || [],
    });
  } catch (error) {
    console.error("DynamoDB Activity GET error:", error);

    return Response.json(
      { error: "Failed to fetch activity" },
      { status: 500 },
    );
  }
}
