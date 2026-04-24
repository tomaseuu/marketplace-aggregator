type PublishRequest = {
  listingId?: string;
  title?: string;
  description?: string;
  price?: number;
  idempotencyKey?: string;
};

// acts like the fake marketplace publish endpoint and may accept fail or send later comments back

const BUYER_COMMENTS = [
  "How much is it?",
  "Would you be willing to meet at a different price?",
  "Wow! I would like to buy it!",
];
const lastCommentIndexByListing = new Map<string, number>();

function getAppBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function getWebhookSecret(): string {
  return process.env.MOCK_MARKETPLACE_WEBHOOK_SECRET ?? "dev-secret";
}

function shouldFailPublish(): boolean {
  return Math.random() < 0.1;
}

function shouldSendBuyerComment(): boolean {
  return Math.random() < 0.4;
}

function getNextBuyerComment(listingId: string): string {
  const lastIndex = lastCommentIndexByListing.get(listingId);
  const availableIndexes = BUYER_COMMENTS.map((_, index) => index).filter(
    (index) => index !== lastIndex,
  );
  const nextIndex =
    availableIndexes[Math.floor(Math.random() * availableIndexes.length)];

  lastCommentIndexByListing.set(listingId, nextIndex);

  return BUYER_COMMENTS[nextIndex];
}

function getInitialDelay(): number {
  return 15000;
}

function getFollowUpDelay(): number {
  return Math.floor(Math.random() * 10000) + 25000;
}

function sendBuyerComment(listingId: string, message: string, delay: number) {
  setTimeout(() => {
    const createdAt = new Date().toISOString();

    void fetch(`${getAppBaseUrl()}/api/webhooks/mock-marketplace`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mock-marketplace-secret": getWebhookSecret(),
      },
      body: JSON.stringify({
        listingId,
        eventType: "new_comment",
        eventId: `${listingId}-auto-comment-${createdAt}`,
        idempotencyKey: `${listingId}-auto-comment-${createdAt}`,
        message,
        createdAt,
      }),
    }).catch((error) => {
      console.error("Mock marketplace webhook error:", error);
    });
  }, delay);
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as PublishRequest;
  const { listingId, title, description, price } = body;

  if (!listingId || !title || !description || price === undefined) {
    return Response.json(
      {
        success: false,
        message:
          "Missing required fields: listingId, title, description, price",
      },
      { status: 400 },
    );
  }

  const fail = shouldFailPublish();

  if (fail) {
    return Response.json(
      {
        success: false,
        status: "failed",
        message: "Mock marketplace publish failed",
      },
      { status: 500 },
    );
  }

  if (shouldSendBuyerComment()) {
    sendBuyerComment(
      listingId,
      getNextBuyerComment(listingId),
      getInitialDelay(),
    );

    if (Math.random() < 0.35) {
      sendBuyerComment(
        listingId,
        getNextBuyerComment(listingId),
        getFollowUpDelay(),
      );
    }
  }

  return Response.json({
    success: true,
    status: "accepted",
    message: "Mock marketplace accepted listing",
  });
}
