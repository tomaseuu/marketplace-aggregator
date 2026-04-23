"use client";

import { useEffect, useState } from "react";

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  status?: string;
};

type ActivityItem = {
  id: string;
  listingId: string;
  eventType: string;
  message: string;
  createdAt: string;
};

function ListingCard({ listing }: { listing: Listing }) {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState(listing.status);

  useEffect(() => {
    setStatus(listing.status);
  }, [listing.status]);

  const fetchActivity = async () => {
    const res = await fetch(`/api/activity?listingId=${listing.id}`);
    const data = await res.json();
    setActivity(data.activity ?? []);
  };

  useEffect(() => {
    fetchActivity();
  }, [listing.id]);

  const sendMarketplaceEvent = async (eventType: string) => {
    await fetch("/api/webhooks/mock-marketplace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        listingId: listing.id,
        eventType,
      }),
    });
  };

  const handleMarkSold = async () => {
    await sendMarketplaceEvent("item_sold");

    setStatus("sold");
    await fetchActivity();
  };

  const handleAddComment = async () => {
    await sendMarketplaceEvent("new_comment");
    await fetchActivity();
  };

  return (
    <div
      style={{
        border: "1px solid gray",
        margin: "10px 0",
        padding: "10px",
      }}
    >
      <h2>{listing.title}</h2>
      <p>{listing.description}</p>
      <p>${listing.price}</p>
      <p>Status: {status ?? "active"}</p>
      {status !== "sold" ? (
        <button onClick={handleMarkSold}>Mark Sold</button>
      ) : null}
      <button onClick={handleAddComment}>Add Comment</button>

      <div style={{ marginTop: "12px" }}>
        <h3>Activity</h3>
        {activity.length === 0 ? (
          <p>No activity yet.</p>
        ) : (
          activity.map((item) => (
            <div
              key={item.id}
              style={{
                borderTop: "1px solid #ddd",
                paddingTop: "8px",
                marginTop: "8px",
              }}
            >
              <p>{item.eventType}</p>
              <p>{item.message}</p>
              <p>{item.createdAt}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    fetch("/api/listings")
      .then((res) => res.json())
      .then((data) => setListings(data.listings));
  }, []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  const createListing = async () => {
    if (!title || !description || price === "" || isNaN(Number(price))) {
      alert("Please fill out all fields correctly");
      return;
    }

    await fetch("/api/listings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description,
        price: Number(price),
      }),
    });

    const res = await fetch("/api/listings");
    const data = await res.json();
    setListings(data.listings);

    setTitle("");
    setDescription("");
    setPrice("");
  };

  return (
    <main style={{ padding: "20px" }}>
      <h1>Marketplace</h1>
      <div style={{ marginBottom: "20px" }}>
        <h2>Create Listing</h2>

        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <br />

        <input
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <br />

        <input
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <br />

        <button onClick={createListing}>Create</button>
      </div>
      {listings.map((item) => (
        <ListingCard key={item.id} listing={item} />
      ))}
    </main>
  );
}
