# Approach

## Overview

I spent around 6–8 hours on this project, and my main goal was to keep everything simple but still show how a real system like this would work.

The idea is that instead of posting your item on multiple marketplaces like Facebook or eBay, you just use one app. That app sends your listing out and then listens for anything that happens, like comments or a sale, and shows everything in one place.

I did not want to overcomplicate it, so I focused on:

- making the flow easy to understand
- keeping a clean separation between my app and the marketplace
- making sure everything actually works end-to-end

---

## Understanding the Problem

The main problem is that sellers have to:

- post the same listing multiple times
- check different apps for messages or sales

This gets messy fast.

So the goal of this app is:

- create a listing once
- send it to a marketplace
- and then track everything in one place

---

## How I Thought About It

Before coding, I spent time planning:

- user flow
- basic architecture
- what data I needed
- what the fake marketplace should actually do

My mental model was:

> The user creates a listing → we save it → we send it → we wait → something happens → we get notified → we show it.

That helped keep everything simple and guided all my decisions.

---

## System Design

I split the system into two parts:

### 1. Seller App (my system)

This is the main app where:

- users create listings
- listings are saved in DynamoDB
- publish requests are sent
- webhook events are received
- activity is shown in the UI

---

### 2. Mock Marketplace (Backbook)

This is a fake marketplace that acts like a real external system.

- it has its own page (`/backbook`)
- it only shows listings that were successfully published
- it can:
  - simulate a sale
  - simulate comments
- it sends events back to my backend using a webhook

This separation was important because I did not want the seller UI to directly control marketplace events. It should feel like an external system.

---

## Data Modeling

I kept this simple with two tables:

### Listings

Stores:

- title, description, price
- condition
- marketplaces
- status (active, published, sold)

---

### ActivityFeed

Stores everything that happens:

- publish_requested
- publish_accepted
- publish_failed
- item_sold
- new_comment

I also added an `eventId` (idempotency key) so duplicate webhook events do not get stored twice.

---

## Publish Flow

When a user creates a listing:

1. It gets saved immediately
2. The backend sends it to the mock marketplace
3. The marketplace:
   - has a 20% chance to fail
   - otherwise accepts the listing

Then I store the result in:

- the listing status
- the activity feed

This simulates how real APIs behave without making it too complex.

---

## Async Behavior

I wanted to show that marketplaces do not respond instantly.

So:

- after a listing is accepted, the marketplace may send a comment later
- users can also manually trigger:
  - a sale
  - a comment

This shows how external systems send events after the initial request.

Note:
In a real system, this would use queues or background jobs instead of simple timeouts.

---

## Webhooks

I used a webhook to receive events from the mock marketplace.

To make it safer:

- I added a shared secret (`x-mock-marketplace-secret`)
- I only allow certain event types
- I added idempotency so duplicate events do not get stored

This is a simplified version of how real systems handle webhooks.

---

## Product Decisions (What I Added)

I also tried to make small decisions that make the app feel more usable and realistic.

### Simple and Minimal UI

I designed the seller dashboard to feel clean and minimal, similar to something like Notion:

- simple layout
- easy to scan
- not too many colors or distractions

The goal was to make it easy for someone to quickly understand what is happening with their listings.

---

### Activity Feed Focus

Instead of just showing raw data, I focused on:

- clear activity messages
- newest events at the top
- making it obvious what happened and when

This helps the user quickly understand the state of their listing.

---

### Notification System

I added a basic notification system so:

- new activity shows up in a notification panel
- users can click a notification
- it scrolls to the related listing
- the listing gets highlighted for a few seconds

This makes it easier to find what changed instead of manually searching through the page.

---

### Listing Management

I added small but important features:

- delete listing (in case the user changes their mind)
- condition tags (like new, used, etc.)
- marketplace selection (choose where to publish)

These are small things, but they make the app feel more real in my opinion.

---

### Backbook UX

For the mock marketplace:

- I made it feel like a simple Facebook-style marketplace (mainly just the color)
- used a clean card layout
- added simple interactions like:
  - simulate sale
  - add comment

This helps show the separation between systems while still being easy to demo.

---

## AWS + Setup Thoughts

I used DynamoDB because:

- it is simple
- easy to set up
- cheap for this type of project

Setting up AWS was honestly one of the harder parts.

I had issues with:

- IAM setup
- AWS CLI config
- mixing different SST versions

At one point SST kept crashing because my config file was wrong.

The fix was:

- resetting to a minimal working config
- making sure I was using the correct version

After that, everything worked fine.

---

## Cost Considerations

I tried to keep everything lightweight:

- DynamoDB only
- no heavy compute
- no background workers
- limited polling

This should cost basically nothing per day for a prototype.

---

## Tradeoffs

To keep the project simple, I made a few tradeoffs:

- async behavior is simulated, not fully reliable in serverless
- polling instead of real-time updates
- no images (optional in prompt)
- no queue system for retries

I focused more on clarity and correctness than completeness.

---

## What I Would Do Next

If I had more time, I would:

- replace polling with WebSockets or SSE
- use a queue like SQS for async processing
- add better retry handling
- improve notifications further
- support multiple marketplaces more fully
- add image uploads using S3 bucket

---

## Final Thoughts

My main goal was to show how systems interact:

- separating internal app vs external marketplace
- handling async behavior
- reacting to events through webhooks

I tried to keep everything simple, clean, and realistic enough to show how this would work in a real system.
