# Marketplace Aggregator (Backbook Demo)

This is a simple full-stack prototype where a seller can create a listing, send it to a mock marketplace (Backbook), and then receive events back like comments or a sale.

The goal of this project is to show a clean system where we:

- create listings
- send them to an external marketplace
- react to events coming back

---

## What This Does

1. Seller creates a listing.
2. Backend saves it in DynamoDB.
3. Backend sends it to a mock marketplace, Backbook.
4. The marketplace:
   - sometimes fails, simulating real APIs
   - sometimes accepts the listing
5. If accepted:
   - the listing shows up in Backbook
   - the marketplace can send events back, such as a comment or sale
6. The webhook receives those events.
7. The seller dashboard activity feed updates.

---

## Tech Stack

- Next.js (App Router)
- TypeScript
- DynamoDB (AWS)
- API Routes (serverless-style)
- No real marketplace APIs used, mock only

---

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

```bash
APP_BASE_URL=http://localhost:3000
MOCK_MARKETPLACE_WEBHOOK_SECRET=dev-secret
NEXT_PUBLIC_MOCK_MARKETPLACE_WEBHOOK_SECRET=dev-secret
```

Note:
In deployment, both of these must match:

- `MOCK_MARKETPLACE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_MOCK_MARKETPLACE_WEBHOOK_SECRET`

4. Run the app.

```bash
npm run dev
```

5. Open in the browser:

```text
http://localhost:3000
```

---

## Build

To verify the project builds:

```bash
npm run build
```

This uses the webpack build path to ensure stability.

---

## Deploy (AWS Amplify Hosting)

The simplest AWS deployment path for this prototype is Amplify Hosting with SSR support.

### 1. Connect the repo

- Open AWS Amplify
- Create a new app
- Choose your Git provider
- Select this repository and branch

### 2. Amplify build settings

This repo includes an `amplify.yml` file, so Amplify can use the project build settings directly.

### 3. Add environment variables

Set these in Amplify for the branch you deploy:

```text
APP_BASE_URL=https://<your-amplify-domain>
MOCK_MARKETPLACE_WEBHOOK_SECRET=<your-shared-secret>
NEXT_PUBLIC_MOCK_MARKETPLACE_WEBHOOK_SECRET=<same-shared-secret>
```

Important:

- `MOCK_MARKETPLACE_WEBHOOK_SECRET` and `NEXT_PUBLIC_MOCK_MARKETPLACE_WEBHOOK_SECRET` must match
- `APP_BASE_URL` should be the final deployed Amplify URL or custom domain

### 4. Give the SSR runtime access to DynamoDB

Your Amplify SSR compute role must have permission to:

- read and write the `Listings` table
- read and write the `ActivityFeed` table

This app uses the default AWS credential chain through the Amplify SSR IAM role.

Do not commit or use AWS access keys in this repo for deployment.

You should not add these as Amplify environment variables:

- `APP_AWS_ACCESS_KEY_ID`
- `APP_AWS_SECRET_ACCESS_KEY`

If the IAM role is configured correctly, the AWS SDK will pick up credentials automatically.

### 5. Deploy

- Save and deploy the branch in Amplify
- Amplify will install dependencies and run:

```bash
npm run build
```

---

## DynamoDB Setup

Create two tables:

### `Listings`

- Primary key: `id` (string)

### `ActivityFeed`

- Primary key: `id` (string)

Make sure your AWS region is:

```text
us-east-2
```

For local development, DynamoDB access should come from your normal AWS SDK credentials setup, for example:

- `aws configure`
- an AWS profile in `~/.aws/credentials`
- temporary shell credentials

---

## How To Use

### Seller Dashboard (`/`)

- create a listing
- choose marketplace, Backbook
- see status and activity

### Backbook (`/backbook`)

- acts like a fake marketplace
- shows only published listings
- lets you simulate:
  - sale
  - comments

---

## Mock Event Flow

- Publish has about a 20 percent failure rate.
- If accepted:
  - an async comment may come in
- You can also manually:
  - simulate a sale
  - add a comment

These hit:

```text
POST /api/webhooks/mock-marketplace
```

---

## Triggering Mock Events

There are two ways to trigger marketplace events:

1. From the Backbook UI (`/backbook`):
   - Click `Simulate Sale`
   - Enter and send a comment
2. Direct API, optional:

```bash
curl -X POST http://localhost:3000/api/webhooks/mock-marketplace \
  -H "Content-Type: application/json" \
  -H "x-mock-marketplace-secret: dev-secret" \
  -d '{"listingId":"<id>","eventType":"item_sold"}'
```

---

## Webhook Security

Uses a shared secret header:

```text
x-mock-marketplace-secret
```

It must match:

```text
MOCK_MARKETPLACE_WEBHOOK_SECRET
```

For local development, both server and client-facing webhook secret values default to `dev-secret`.

---

## Cost Notes

- Uses DynamoDB only, which is very low cost at this scale
- No heavy compute
- No background queues or long-running jobs used
- Polling is limited and controlled
- No large file storage

Estimated cost is near zero per day for this prototype.

---

## Tear Down

Delete the DynamoDB tables:

- `Listings`
- `ActivityFeed`

---

## Demo

The demo shows:

- creating a listing
- publish success or failure
- interacting with Backbook
- activity feed updating

---

## Notes

- Images were not included since they are optional
- Mock marketplace is separated into its own page at `/backbook`
- Async behavior is simulated
- Basic idempotency and webhook validation are included
