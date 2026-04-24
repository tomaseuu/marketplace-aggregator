# Marketplace Aggregator (Backbook Demo)

This is a simple full-stack prototype where a seller creates a listing, sends it to a mock marketplace called Backbook, and then gets events back like comments or a sale.

The goal is to show a clean flow where we:

- create listings
- send them to an external marketplace
- receive events back through a webhook
- show everything in one seller dashboard

## What This Does

1. Seller creates a listing.
2. The backend saves it in DynamoDB.
3. The backend sends it to Backbook through an API route.
4. Backbook either accepts or fails the publish request.
5. If accepted, Backbook can send events back later.
6. The webhook receives those events.
7. The activity feed updates in the seller app.

## Tech Stack

- Next.js (App Router)
- TypeScript
- Next.js API routes
- AWS Amplify Hosting
- Amplify SSR/server-side compute for backend routes
- DynamoDB
- Mock marketplace only, no real marketplace API

## Setup (Local)

1. Clone the repo.

```bash
git clone <your-repo-url>
cd marketplace-app
```

2. Install dependencies.

```bash
npm install
```

3. Create `.env.local`.

```text
APP_BASE_URL=http://localhost:3000
MOCK_MARKETPLACE_WEBHOOK_SECRET=dev-secret
NEXT_PUBLIC_MOCK_MARKETPLACE_WEBHOOK_SECRET=dev-secret
```

These two secret values should stay the same:

- `MOCK_MARKETPLACE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_MOCK_MARKETPLACE_WEBHOOK_SECRET`

4. Make sure you have AWS credentials available locally through the normal AWS SDK credential chain, like `aws configure` or an AWS profile.

5. Create the DynamoDB tables in `us-east-2`:

- `Listings`
- `ActivityFeed`

6. Run the app.

```bash
npm run dev
```

7. Open:

```text
http://localhost:3000
```

## Environment Variables

Use these values locally or in deployment, with `APP_BASE_URL` set to the correct URL for that environment:

```text
APP_BASE_URL=<deployed Amplify URL>
MOCK_MARKETPLACE_WEBHOOK_SECRET=dev-secret
NEXT_PUBLIC_MOCK_MARKETPLACE_WEBHOOK_SECRET=dev-secret
```

## Build

To verify the app builds:

```bash
npm run build
```

## AWS Deployment

The final deployment uses AWS Amplify Hosting.

1. Push this repo to GitHub.
2. In AWS Amplify Hosting, connect the GitHub repo and choose the branch to deploy.
3. Use the build command:

```bash
npm run build
```

4. Set these environment variables in Amplify:

```text
APP_BASE_URL=<deployed Amplify URL>
MOCK_MARKETPLACE_WEBHOOK_SECRET=dev-secret
NEXT_PUBLIC_MOCK_MARKETPLACE_WEBHOOK_SECRET=dev-secret
```

5. Make sure `NEXT_PUBLIC_MOCK_MARKETPLACE_WEBHOOK_SECRET` matches `MOCK_MARKETPLACE_WEBHOOK_SECRET`.
6. Configure the Amplify compute IAM role so the deployed server-side Next.js API routes can read and write DynamoDB.
7. Give that role access to these tables in `us-east-2`:

- `Listings`
- `ActivityFeed`

8. Do not commit AWS access keys or store long-lived AWS keys in the repo for this app.
9. Redeploy the Amplify app after the environment variables and IAM role are set.

## DynamoDB Setup

Create these tables in `us-east-2`:

### `Listings`

- Primary key: `id` (string)

### `ActivityFeed`

- Primary key: `id` (string)

In production, DynamoDB access comes from the Amplify compute IAM role. In local development, it comes from your normal AWS credentials setup.

## How To Use

### Seller Dashboard (`/`)

- create a listing
- choose the marketplace
- publish to Backbook
- see listing status and activity

### Backbook (`/backbook`)

- acts like a fake marketplace
- shows published listings
- lets you simulate:
  - sale
  - comments

## Mock Event Flow

- Publish has about a 20 percent failure rate.
- If accepted, Backbook may send a comment later.
- You can also manually simulate:
  - a sale
  - a comment

These events go to:

```text
POST /api/webhooks/mock-marketplace
```

## Triggering Mock Events

1. From the Backbook UI at `/backbook`
2. Directly by API:

```bash
curl -X POST http://localhost:3000/api/webhooks/mock-marketplace \
  -H "Content-Type: application/json" \
  -H "x-mock-marketplace-secret: dev-secret" \
  -d '{"listingId":"<id>","eventType":"item_sold"}'
```

## Webhook Security

The webhook uses this shared header:

```text
x-mock-marketplace-secret
```

It must match:

```text
MOCK_MARKETPLACE_WEBHOOK_SECRET
```

For this prototype, `NEXT_PUBLIC_MOCK_MARKETPLACE_WEBHOOK_SECRET` is set to the same value so the mocked marketplace UI can send test events back to the app.

## Cost Estimate

- Amplify Hosting plus server-side compute stays very cheap at low traffic.
- DynamoDB on-demand is also very cheap for a prototype at this size.
- For a one-day prototype or low traffic demo, the cost is basically near zero.
- The first real cost wall would be high polling or event volume, or heavier image and media uploads.

## Tear Down

When you are done with the prototype:

1. Delete the Amplify app.
2. Delete the DynamoDB tables:
   - `Listings`
   - `ActivityFeed`
3. Remove the IAM role and policy if you no longer need them.

## Notes

- Backbook is intentionally separate so it feels like an external marketplace.
- The backend uses API routes as the boundary between our app and the marketplace flow.
- Basic webhook validation and idempotency are included.
- Images were left out because they were optional and not needed for the core demo.
