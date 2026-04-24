# Approach

## Summary

I took an API-driven approach for this project.

The seller uses one app to create a listing, and the backend acts as a wrapper between our seller app and the marketplace. That gives us a clean boundary between our app and Backbook instead of mixing marketplace logic directly into the UI.

The basic idea is simple:

1. Create a listing in our app.
2. Save it.
3. Send it to the marketplace through the backend.
4. Receive events back through a webhook.
5. Show the result in one activity feed.

## Why This Shape

The main problem is that sellers should not have to post the same item over and over in different places or keep checking separate apps for messages and sales.

So I kept the core flow focused on:

- create once
- publish through an API
- receive events back
- show everything in one place

That keeps the system easy to understand and gives us a good base for adding more marketplaces later.

## Architecture

- Frontend: Next.js + TypeScript
- Backend: Next.js API routes deployed through AWS Amplify SSR/server-side compute
- Database: DynamoDB
- Deployment: AWS Amplify Hosting
- Access: Amplify compute IAM role for DynamoDB access

The backend is the important piece here. It works like a wrapper between the seller app and Backbook, so the UI talks to our own API routes and our API routes handle the marketplace-facing behavior.

## App Boundary

I split the system into two parts.

### 1. Seller App

This is our app. It handles:

- creating listings
- storing listings in DynamoDB
- sending publish requests
- receiving webhook events
- showing activity to the seller

### 2. Backbook

Backbook is the mocked marketplace.

- It is conceptually based on Facebook Marketplace.
- It stands in for an external marketplace so we can demo the flow end to end.
- It accepts listings, fails sometimes, and sends events back like comments and sales.

Keeping Backbook separate helps show the real design idea: our app owns the seller experience, and the backend handles the marketplace integration boundary.

## Data Model

I kept the data model small with two DynamoDB tables in `us-east-2`.

### Listings

Stores listing details like:

- title
- description
- price
- condition
- status
- selected marketplace

### ActivityFeed

Stores important events like:

- publish_requested
- publish_accepted
- publish_failed
- item_sold
- new_comment

This gives the seller one place to see what happened without mixing all of that into the listing record itself.

## Reference Marketplace

Backbook is loosely modeled after Facebook Marketplace because that is an easy mental model for a person reading or testing the demo.

It is still a mock, not a real integration.

In a real system, each marketplace adapter would need more work, including:

- OAuth or API tokens
- rate limits
- webhook verification
- marketplace-specific edge cases
- different payload formats and failure modes

That is another reason I kept the backend as a wrapper. It gives us a clean place to add those differences later.

## Safety

I kept the safety model basic but real enough for a prototype:

- DynamoDB access uses an IAM compute role
- no AWS keys are committed in the repo
- the webhook uses a shared secret
- event types are validated
- basic idempotency uses `eventId` or `idempotencyKey`

For production, I would not rely only on direct retries inside request flow. A better production setup would use SQS and a dead-letter queue for retries and failure handling.

## Cost

At prototype scale, this stays cheap.

For something like:

- 10 sellers
- 1,000 listings
- 10,000 events

the rough cost should still be low because:

- DynamoDB on-demand is inexpensive at that volume
- Amplify Hosting is light for a small frontend
- Amplify SSR/server-side compute stays cheap when request volume is low

The first cost wall would usually come from:

- high polling frequency
- more SSR compute calls
- images or other media storage and delivery (involving s3 buckets)

So for a demo or prototype, DynamoDB plus Amplify is a good fit.

## Tradeoffs

To keep the project small and understandable, I cut a few things on purpose:

- images, because they were optional and not core to the flow
- real marketplace OAuth or API calls
- queue-based retry infrastructure
- full auth and multi-user handling

That let me focus on the core architecture and the end-to-end event flow.

## Build Next

If I kept going, I would add:

- SQS - simple queue service: app would be able to drop a task into the queue and handle it safely in the background
- DLQ handling - dead letter queue, backup bin for failed jobs
- better retry logic
- auth
- S3 image uploads
- WebSockets or SSE - a full live chat both ways and a server live updates
- multiple marketplace adapters

That would move the project from a clean prototype toward a more production-ready system.

## Final Thought

The main thing I wanted to show was not just a UI. I wanted to show a clean system boundary:

- our app owns the seller workflow
- the backend wraps marketplace behavior
- the marketplace sends events back through a webhook

That makes the design easier to extend, easier to reason about, and closer to how a real integration system would be built. But honestly, this was super fun to do!
