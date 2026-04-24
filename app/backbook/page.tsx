"use client";

// acts like the fake marketplace where accepted listings show up and where sale or comment events get sent back

import { useEffect, useState } from "react";

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  condition?: string;
  status?: string;
  createdAt?: string;
};

type BackbookTab = "active" | "sold";
// In deployment, keep this aligned with MOCK_MARKETPLACE_WEBHOOK_SECRET
// so the Backbook simulator and webhook receiver use the same shared secret.
const WEBHOOK_SECRET =
  process.env.NEXT_PUBLIC_MOCK_MARKETPLACE_WEBHOOK_SECRET ?? "dev-secret";

function formatConditionLabel(condition?: string): string {
  const labels: Record<string, string> = {
    brand_new: "Brand New",
    like_new: "Like New",
    used_good: "Used (Good)",
    used_fair: "Used (Fair)",
  };

  return labels[condition ?? "used_good"] ?? "Used (Good)";
}

function formatPrice(value: number): string {
  return value.toFixed(2);
}

function useViewport() {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const updateWidth = () => setWidth(window.innerWidth);

    updateWidth();
    window.addEventListener("resize", updateWidth);

    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const viewportWidth = width ?? 1024;

  return {
    isMobile: viewportWidth < 640,
    isTablet: viewportWidth >= 640 && viewportWidth < 960,
  };
}

function PressableButton({
  label,
  onClick,
  primary = false,
  fullWidth = false,
  compact = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseDown={() => {
        if (!disabled) {
          setIsPressed(true);
        }
      }}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => {
        if (!disabled) {
          setIsPressed(true);
        }
      }}
      onTouchEnd={() => setIsPressed(false)}
      type="button"
      disabled={disabled}
      style={{
        border: disabled
          ? "1px solid #e5e7eb"
          : primary
            ? "1px solid #1877F2"
            : "1px solid #dbeafe",
        background: disabled ? "#f8fafc" : primary ? "#1877F2" : "#f8fbff",
        color: disabled ? "#9ca3af" : primary ? "#ffffff" : "#1877F2",
        borderRadius: "999px",
        padding: compact ? "8px 12px" : "10px 14px",
        fontSize: compact ? "13px" : "14px",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        transform: isPressed ? "translateY(1px) scale(0.99)" : "translateY(0)",
        boxShadow: disabled
          ? "none"
          : isPressed
            ? "0 2px 6px rgba(24, 119, 242, 0.12)"
            : primary
              ? "0 6px 14px rgba(24, 119, 242, 0.18)"
              : "0 4px 10px rgba(24, 119, 242, 0.08)",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        width: fullWidth ? "100%" : "auto",
      }}
    >
      {label}
    </button>
  );
}

export default function BackbookPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>(
    {},
  );
  const [selectedTab, setSelectedTab] = useState<BackbookTab>("active");
  const { isMobile, isTablet } = useViewport();
  const publishedListings = listings.filter(
    (listing) => listing.status === "published" || listing.status === "sold",
  );
  const activeListings = publishedListings.filter(
    (listing) => listing.status !== "sold",
  );
  const soldListings = publishedListings.filter(
    (listing) => listing.status === "sold",
  );
  const visibleListings =
    selectedTab === "active" ? activeListings : soldListings;

  const fetchListings = async () => {
    const res = await fetch("/api/listings", {
      cache: "no-store",
    });
    const data = await res.json();
    setListings(data.listings ?? []);
  };

  useEffect(() => {
    let isMounted = true;

    const loadListings = async () => {
      const res = await fetch("/api/listings", {
        cache: "no-store",
      });
      const data = await res.json();

      if (isMounted) {
        setListings(data.listings ?? []);
      }
    };

    void loadListings();
    const intervalId = window.setInterval(() => {
      void loadListings();
    }, 3000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const sendEvent = async (listingId: string, eventType: string) => {
    const createdAt = new Date().toISOString();

    await fetch("/api/webhooks/mock-marketplace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mock-marketplace-secret": WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        listingId,
        eventType,
        eventId: `${listingId}-${eventType}-${createdAt}`,
        idempotencyKey: `${listingId}-${eventType}-${createdAt}`,
        createdAt,
      }),
    });

    await fetchListings();
  };

  const sendComment = async (listingId: string) => {
    const message = commentInputs[listingId]?.trim();

    if (!message) {
      return;
    }

    const createdAt = new Date().toISOString();

    await fetch("/api/webhooks/mock-marketplace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mock-marketplace-secret": WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        listingId,
        eventType: "new_comment",
        eventId: `${listingId}-new_comment-${createdAt}`,
        idempotencyKey: `${listingId}-new_comment-${createdAt}`,
        message,
        createdAt,
      }),
    });

    setCommentInputs((current) => ({
      ...current,
      [listingId]: "",
    }));

    await fetchListings();
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f6fb",
        padding: isMobile
          ? "28px 14px 56px"
          : isTablet
            ? "34px 16px 64px"
            : "40px 18px 72px",
      }}
    >
      <div
        style={{
          maxWidth: "980px",
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: isMobile ? "32px" : isTablet ? "36px" : "42px",
              lineHeight: 1.05,
              fontWeight: 800,
              color: "#1877F2",
              letterSpacing: "-0.03em",
            }}
          >
            Backbook
          </h1>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: "16px",
              color: "#6b7280",
            }}
          >
            Mock Marketplace Simulator
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "20px",
          }}
        >
          {[
            {
              key: "active" as const,
              label: "Active Listings",
              count: activeListings.length,
            },
            { key: "sold" as const, label: "Sold", count: soldListings.length },
          ].map((tab) => {
            const isSelected = selectedTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedTab(tab.key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  border: isSelected
                    ? "1px solid #1877F2"
                    : "1px solid #dbeafe",
                  background: isSelected ? "#1877F2" : "#ffffff",
                  color: isSelected ? "#ffffff" : "#1877F2",
                  borderRadius: "999px",
                  padding: "10px 14px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  minWidth: isMobile ? "100%" : "auto",
                  boxShadow: isSelected
                    ? "0 6px 14px rgba(24, 119, 242, 0.18)"
                    : "0 4px 10px rgba(24, 119, 242, 0.08)",
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    minWidth: "24px",
                    padding: "2px 7px",
                    borderRadius: "999px",
                    background: isSelected
                      ? "rgba(255,255,255,0.18)"
                      : "#eff6ff",
                    color: isSelected ? "#ffffff" : "#1877F2",
                    fontSize: "12px",
                    textAlign: "center",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "1fr"
              : isTablet
                ? "repeat(2, minmax(0, 1fr))"
                : "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "18px",
          }}
        >
          {visibleListings.map((listing) => {
            const statusLabel = listing.status ?? "active";
            const isSold = statusLabel === "sold";
            const badgeLabel = isSold ? "Sold" : "Active";
            const canPostComment = Boolean(commentInputs[listing.id]?.trim());

            return (
              <div
                key={listing.id}
                style={{
                  background: isSold ? "#f8fafc" : "#ffffff",
                  border: isSold ? "1px solid #e2e8f0" : "1px solid #e5e7eb",
                  borderRadius: "20px",
                  padding: isMobile ? "16px" : "20px",
                  boxShadow: isSold
                    ? "0 8px 18px rgba(15, 23, 42, 0.04)"
                    : "0 10px 24px rgba(15, 23, 42, 0.06)",
                  opacity: isSold ? 0.88 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                    marginBottom: "14px",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: isMobile ? "20px" : "22px",
                      lineHeight: 1.2,
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    {listing.title}
                  </h2>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 700,
                      textTransform: "capitalize",
                      whiteSpace: "nowrap",
                      color: isSold ? "#b91c1c" : "#15803d",
                      background: isSold ? "#fef2f2" : "#f0fdf4",
                      border: isSold
                        ? "1px solid #fecaca"
                        : "1px solid #bbf7d0",
                    }}
                  >
                    {badgeLabel}
                  </span>
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    lineHeight: 1.6,
                    color: "#6b7280",
                    minHeight: "44px",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {listing.description}
                </p>

                <p
                  style={{
                    margin: "16px 0 0",
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "#111827",
                  }}
                >
                  ${formatPrice(listing.price)}
                </p>

                <div style={{ marginTop: "12px" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: "999px",
                      background: "#ffffff",
                      border: "1px solid #dbeafe",
                      color: "#4b5563",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {formatConditionLabel(listing.condition)}
                  </span>
                </div>

                {!isSold ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginTop: "18px",
                        flexWrap: "wrap",
                        flexDirection: isMobile ? "column" : "row",
                        justifyContent: isMobile ? "stretch" : "flex-end",
                      }}
                    >
                      <PressableButton
                        label="Simulate Sale"
                        onClick={() => sendEvent(listing.id, "item_sold")}
                        primary
                        fullWidth={isMobile}
                        compact
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginTop: "12px",
                        flexWrap: "wrap",
                        flexDirection: isMobile ? "column" : "row",
                      }}
                    >
                      <input
                        value={commentInputs[listing.id] ?? ""}
                        onChange={(e) =>
                          setCommentInputs((current) => ({
                            ...current,
                            [listing.id]: e.target.value,
                          }))
                        }
                        placeholder="Write a comment"
                        style={{
                          flex: isMobile ? undefined : "1 1 180px",
                          minWidth: isMobile ? "100%" : "180px",
                          boxSizing: "border-box",
                          border: "1px solid #dbeafe",
                          background: "#ffffff",
                          color: "#111827",
                          borderRadius: "999px",
                          padding: "10px 14px",
                          fontSize: "14px",
                          outline: "none",
                        }}
                      />
                      <PressableButton
                        label="Send Comment"
                        onClick={() => sendComment(listing.id)}
                        fullWidth={isMobile}
                        disabled={!canPostComment}
                      />
                    </div>
                  </>
                ) : (
                  <p
                    style={{
                      margin: "16px 0 0",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#6b7280",
                    }}
                  >
                    This listing has been sold.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {visibleListings.length === 0 ? (
          <div
            style={{
              marginTop: "18px",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "20px",
              padding: "20px",
              color: "#6b7280",
              fontSize: "14px",
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
            }}
          >
            No listings in this view yet.
          </div>
        ) : null}
      </div>
    </main>
  );
}
