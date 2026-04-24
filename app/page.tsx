"use client";

// lets the seller make listings see what happened to them and check new activity

import { useEffect, useRef, useState } from "react";

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  condition?: string;
  status?: string;
  marketplaces?: string[];
  createdAt?: string;
};

type ActivityItem = {
  id: string;
  listingId: string;
  eventType: string;
  message: string;
  createdAt: string;
};

type NotificationItem = ActivityItem & {
  listingTitle: string;
};

type ListingFilter = "sold" | "active";

const TITLE_MIN_LENGTH = 5;
const TITLE_MAX_LENGTH = 80;
const DESCRIPTION_MIN_LENGTH = 10;
const DESCRIPTION_MAX_LENGTH = 250;
const DASHBOARD_POLL_INTERVAL_MS = 10000;
const LISTING_HIGHLIGHT_DURATION_MS = 5000;
const CONDITION_OPTIONS = [
  { value: "brand_new", label: "Brand New" },
  { value: "like_new", label: "Like New" },
  { value: "used_good", label: "Used (Good)" },
  { value: "used_fair", label: "Used (Fair)" },
] as const;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatActivityEventType(eventType: string): string {
  const labels: Record<string, string> = {
    publish_requested: "Listing submitted",
    publish_accepted: "Listed on Backbook",
    publish_failed: "Failed to publish",
    item_sold: "Item sold",
    new_comment: "New comment",
  };

  return labels[eventType] ?? eventType.replaceAll("_", " ");
}

function formatMarketplaceName(marketplace: string): string {
  const labels: Record<string, string> = {
    backbook: "Backbook",
    ebay: "fBay",
    facebook_marketplace: "OfferDown",
    offerdown: "OfferDown",
  };

  return labels[marketplace] ?? marketplace;
}

function formatConditionLabel(condition?: string): string {
  const labels: Record<string, string> = {
    brand_new: "Brand New",
    like_new: "Like New",
    used_good: "Used (Good)",
    used_fair: "Used (Fair)",
  };

  return labels[condition ?? "used_good"] ?? "Used (Good)";
}

function getSellerStatusDisplay(status?: string): {
  label: string;
  border: string;
  background: string;
  color: string;
} {
  if (status === "sold") {
    return {
      label: "Sold",
      border: "1px solid #fecaca",
      background: "#fef2f2",
      color: "#b91c1c",
    };
  }

  if (status === "failed") {
    return {
      label: "Inactive",
      border: "1px solid #fde68a",
      background: "#fffbeb",
      color: "#b45309",
    };
  }

  return {
    label: "Active",
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#15803d",
  };
}

function formatPrice(value: number): string {
  return value.toFixed(2);
}

function parsePriceValue(value: string): number {
  return Number(value.replace(/[^0-9.]/g, ""));
}

function formatPriceInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");

  if (!cleaned) {
    return "";
  }

  const firstDecimalIndex = cleaned.indexOf(".");
  const hasDecimal = firstDecimalIndex !== -1;
  const wholePart =
    firstDecimalIndex === -1 ? cleaned : cleaned.slice(0, firstDecimalIndex);
  const decimals =
    firstDecimalIndex === -1
      ? ""
      : cleaned
          .slice(firstDecimalIndex + 1)
          .replace(/\./g, "")
          .slice(0, 2);
  const normalizedWhole = wholePart || "0";

  if (hasDecimal) {
    return `$${normalizedWhole}.${decimals}`;
  }

  return `$${normalizedWhole}`;
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

function ListingCard({
  listing,
  activity,
  isMobile,
  highlightedActivityId,
  onDelete,
  onUpdate,
}: {
  listing: Listing;
  activity: ActivityItem[];
  isMobile: boolean;
  highlightedActivityId: string | null;
  onDelete: (listingId: string) => Promise<void>;
  onUpdate: () => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(listing.title);
  const [editDescription, setEditDescription] = useState(listing.description);
  const [editPrice, setEditPrice] = useState(
    formatPriceInput(String(listing.price)),
  );
  const [editCondition, setEditCondition] = useState(
    listing.condition ?? "used_good",
  );
  const [isSaving, setIsSaving] = useState(false);

  const sortedActivity = [...activity].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const statusDisplay = getSellerStatusDisplay(listing.status);
  const isSold = listing.status === "sold";

  const handleSave = async () => {
    const trimmedTitle = editTitle.trim();
    const trimmedDescription = editDescription.trim();
    const parsedPrice = parsePriceValue(editPrice);

    if (
      trimmedTitle.length < TITLE_MIN_LENGTH ||
      trimmedTitle.length > TITLE_MAX_LENGTH
    ) {
      alert(
        `Title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`,
      );
      return;
    }

    if (
      trimmedDescription.length < DESCRIPTION_MIN_LENGTH ||
      trimmedDescription.length > DESCRIPTION_MAX_LENGTH
    ) {
      alert(
        `Description must be between ${DESCRIPTION_MIN_LENGTH} and ${DESCRIPTION_MAX_LENGTH} characters.`,
      );
      return;
    }

    if (!editCondition) {
      alert("Please select a condition.");
      return;
    }

    if (editPrice === "" || Number.isNaN(parsedPrice)) {
      alert("Please enter a valid price.");
      return;
    }

    setIsSaving(true);

    const res = await fetch("/api/listings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: listing.id,
        title: trimmedTitle,
        description: trimmedDescription,
        price: Number(parsedPrice.toFixed(2)),
        condition: editCondition,
      }),
    });

    setIsSaving(false);

    if (!res.ok) {
      alert("Failed to update listing");
      return;
    }

    await onUpdate();
    setIsEditing(false);
  };

  return (
    <div
      id={`listing-${listing.id}`}
      style={{
        background: "#ffffff",
        border: "1px solid #e7e5e4",
        borderRadius: "16px",
        padding: isMobile ? "18px" : "24px",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          gap: "16px",
          alignItems: "flex-start",
          marginBottom: "16px",
        }}
      >
        <div>
          {isEditing ? (
            <div
              style={{
                display: "grid",
                gap: "10px",
                width: "100%",
              }}
            >
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={TITLE_MAX_LENGTH}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #e7e5e4",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "16px",
                  color: "#111827",
                  background: "#ffffff",
                  outline: "none",
                }}
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={DESCRIPTION_MAX_LENGTH}
                rows={4}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #e7e5e4",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "14px",
                  color: "#111827",
                  background: "#ffffff",
                  outline: "none",
                  resize: "vertical",
                  minHeight: "110px",
                  maxHeight: "220px",
                  overflowY: "auto",
                  fontFamily: "inherit",
                }}
              />
            </div>
          ) : (
            <>
              <h2
                style={{
                  margin: 0,
                  fontSize: isMobile ? "20px" : "22px",
                  lineHeight: 1.25,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {listing.title}
              </h2>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "14px",
                  color: "#78716c",
                  lineHeight: 1.6,
                }}
              >
                {listing.description}
              </p>
            </>
          )}
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 10px",
            borderRadius: "999px",
            border: statusDisplay.border,
            background: statusDisplay.background,
            color: statusDisplay.color,
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "capitalize",
            whiteSpace: "nowrap",
          }}
        >
          {statusDisplay.label}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "#a8a29e",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Price
          </p>
          {isEditing ? (
            <input
              value={editPrice}
              onChange={(e) => setEditPrice(formatPriceInput(e.target.value))}
              onKeyDown={(event) => {
                const allowedKeys = [
                  "Backspace",
                  "Delete",
                  "ArrowLeft",
                  "ArrowRight",
                  "Tab",
                  "Home",
                  "End",
                ];

                if (allowedKeys.includes(event.key)) {
                  return;
                }

                if (event.key === ".") {
                  if (editPrice.includes(".")) {
                    event.preventDefault();
                  }

                  return;
                }

                if (!/^\d$/.test(event.key)) {
                  event.preventDefault();
                }
              }}
              onBlur={() => {
                if (
                  editPrice !== "" &&
                  !Number.isNaN(parsePriceValue(editPrice))
                ) {
                  setEditPrice(`$${parsePriceValue(editPrice).toFixed(2)}`);
                }
              }}
              inputMode="decimal"
              style={{
                marginTop: "6px",
                width: isMobile ? "100%" : "140px",
                boxSizing: "border-box",
                border: "1px solid #e7e5e4",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "14px",
                color: "#111827",
                background: "#ffffff",
                outline: "none",
              }}
            />
          ) : (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "18px",
                fontWeight: 600,
                color: "#111827",
              }}
            >
              ${formatPrice(listing.price)}
            </p>
          )}
        </div>

        <div>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "#a8a29e",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Condition
          </p>
          <div style={{ marginTop: "6px" }}>
            {isEditing ? (
              <select
                value={editCondition}
                onChange={(e) => setEditCondition(e.target.value)}
                style={{
                  width: isMobile ? "100%" : "160px",
                  boxSizing: "border-box",
                  border: "1px solid #e7e5e4",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "14px",
                  color: "#111827",
                  background: "#ffffff",
                  outline: "none",
                }}
              >
                {CONDITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: "999px",
                  background: "#fafaf9",
                  border: "1px solid #e7e5e4",
                  color: "#57534e",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {formatConditionLabel(listing.condition)}
              </span>
            )}
          </div>
        </div>

        {listing.marketplaces && listing.marketplaces.length > 0 ? (
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "#a8a29e",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Marketplaces
            </p>
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                marginTop: "6px",
              }}
            >
              {listing.marketplaces.map((marketplace) => (
                <span
                  key={marketplace}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 10px",
                    borderRadius: "999px",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#1d4ed8",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {formatMarketplaceName(marketplace)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {!isSold ? (
          <div
            style={{
              marginLeft: isMobile ? 0 : "auto",
              textAlign: isMobile ? "left" : "right",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "#a8a29e",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Actions
            </p>
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                justifyContent: isMobile ? "flex-start" : "flex-end",
                marginTop: "6px",
              }}
            >
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditTitle(listing.title);
                      setEditDescription(listing.description);
                      setEditPrice(formatPriceInput(String(listing.price)));
                      setEditCondition(listing.condition ?? "used_good");
                    }}
                    style={{
                      border: "1px solid #e7e5e4",
                      background: "#ffffff",
                      color: "#57534e",
                      borderRadius: "8px",
                      padding: "7px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    style={{
                      border: "1px solid #bbf7d0",
                      background: "#f0fdf4",
                      color: "#15803d",
                      borderRadius: "8px",
                      padding: "7px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: isSaving ? "not-allowed" : "pointer",
                      opacity: isSaving ? 0.7 : 1,
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditTitle(listing.title);
                      setEditDescription(listing.description);
                      setEditPrice(formatPriceInput(String(listing.price)));
                      setEditCondition(listing.condition ?? "used_good");
                      setIsEditing(true);
                    }}
                    style={{
                      border: "1px solid #bfdbfe",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      borderRadius: "8px",
                      padding: "7px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void onDelete(listing.id)}
                    style={{
                      border: "1px solid #fecaca",
                      background: "#ffffff",
                      color: "#b91c1c",
                      borderRadius: "8px",
                      padding: "7px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      width: isMobile ? "100%" : "auto",
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          borderTop: "1px solid #f0eeeb",
          paddingTop: "18px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 600,
            color: "#292524",
          }}
        >
          Activity
        </h3>
        {activity.length === 0 ? (
          <p
            style={{
              margin: "12px 0 0",
              fontSize: "14px",
              color: "#78716c",
            }}
          >
            No activity yet.
          </p>
        ) : (
          sortedActivity.map((item) => (
            <div
              key={item.id}
              id={`activity-${item.id}`}
              style={{
                background:
                  highlightedActivityId === item.id ? "#eff6ff" : "transparent",
                border:
                  highlightedActivityId === item.id
                    ? "1px solid #60a5fa"
                    : "1px solid transparent",
                borderRadius: "12px",
                padding:
                  highlightedActivityId === item.id ? "12px" : "12px 0 0",
                paddingTop: "12px",
                marginTop: "12px",
                borderTop:
                  highlightedActivityId === item.id
                    ? "1px solid #bfdbfe"
                    : "1px solid #f5f5f4",
                boxShadow:
                  highlightedActivityId === item.id
                    ? "0 0 0 3px rgba(96, 165, 250, 0.14)"
                    : "none",
                transition:
                  "background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  justifyContent: "space-between",
                  gap: "12px",
                  alignItems: isMobile ? "flex-start" : "center",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#44403c",
                    textTransform: "capitalize",
                  }}
                >
                  {formatActivityEventType(item.eventType)}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "#a8a29e",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatDateTime(item.createdAt)}
                </p>
              </div>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "#57534e",
                }}
              >
                {item.message}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filter, setFilter] = useState<ListingFilter>("active");
  const [activityByListing, setActivityByListing] = useState<
    Record<string, ActivityItem[]>
  >({});
  const [unreadActivityIds, setUnreadActivityIds] = useState<string[]>([]);
  const [highlightedActivityId, setHighlightedActivityId] = useState<
    string | null
  >(null);
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const isMountedRef = useRef(false);
  const isSyncingRef = useRef(false);
  const hasHydratedNotificationsRef = useRef(false);
  const knownActivityIdsRef = useRef<Set<string>>(new Set());
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const { isMobile, isTablet } = useViewport();
  const marketplaceOptions = [
    { key: "backbook", label: "Backbook", enabled: true },
    { key: "ebay", label: "fBay", enabled: false },
    {
      key: "offerdown",
      label: "OfferDown",
      enabled: false,
    },
  ] as const;

  const syncDashboard = async () => {
    if (isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;

    try {
      const listingsRes = await fetch("/api/listings", {
        cache: "no-store",
      });
      const listingsData = await listingsRes.json();
      const nextListings: Listing[] = listingsData.listings ?? [];

      const activityEntries = await Promise.all(
        nextListings.map(async (listing) => {
          try {
            const activityRes = await fetch(
              `/api/activity?listingId=${listing.id}`,
              {
                cache: "no-store",
              },
            );

            if (!activityRes.ok) {
              return [listing.id, []] as const;
            }

            const activityData = await activityRes.json();
            const items = (activityData.activity ?? []) as ActivityItem[];

            items.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );

            return [listing.id, items] as const;
          } catch (error) {
            console.error(
              "Failed to fetch activity for listing:",
              listing.id,
              error,
            );
            return [listing.id, []] as const;
          }
        }),
      );
      const nextActivityByListing = Object.fromEntries(activityEntries);
      const nextKnownActivityIds = new Set<string>();
      const nextUnreadIds: string[] = [];

      activityEntries.forEach(([, items]) => {
        items.forEach((item) => {
          nextKnownActivityIds.add(item.id);

          if (
            hasHydratedNotificationsRef.current &&
            !knownActivityIdsRef.current.has(item.id)
          ) {
            nextUnreadIds.push(item.id);
          }
        });
      });

      if (!isMountedRef.current) {
        return;
      }

      setListings(nextListings);
      setActivityByListing(nextActivityByListing);
      setUnreadActivityIds((current) => {
        const persistedUnreadIds = current.filter((id) =>
          nextKnownActivityIds.has(id),
        );

        if (!hasHydratedNotificationsRef.current) {
          return persistedUnreadIds;
        }

        return [...new Set([...nextUnreadIds, ...persistedUnreadIds])];
      });
      knownActivityIdsRef.current = nextKnownActivityIds;

      if (!hasHydratedNotificationsRef.current) {
        hasHydratedNotificationsRef.current = true;
      }
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    void syncDashboard();
    const intervalId = window.setInterval(() => {
      void syncDashboard();
    }, DASHBOARD_POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      window.clearInterval(intervalId);

      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("");
  const [formError, setFormError] = useState("");
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>(
    [],
  );

  const toggleMarketplace = (marketplace: string) => {
    setSelectedMarketplaces((current) =>
      current.includes(marketplace)
        ? current.filter((item) => item !== marketplace)
        : [...current, marketplace],
    );
  };

  const handlePriceKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
      "Home",
      "End",
    ];

    if (allowedKeys.includes(event.key)) {
      return;
    }

    if (event.key === ".") {
      if (price.includes(".")) {
        event.preventDefault();
      }

      return;
    }

    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  };

  const sortedListings = [...listings].sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() -
      new Date(a.createdAt ?? 0).getTime(),
  );

  const soldCount = listings.filter(
    (listing) => listing.status === "sold",
  ).length;
  const activeCount = listings.filter(
    (listing) => listing.status !== "sold",
  ).length;

  const filteredListings = sortedListings.filter((listing) => {
    if (filter === "sold") {
      return listing.status === "sold";
    }

    if (filter === "active") {
      return listing.status !== "sold";
    }

    return true;
  });

  const activityFeedItems: NotificationItem[] = Object.entries(
    activityByListing,
  )
    .flatMap(([listingId, items]) =>
      items.map((item) => ({
        ...item,
        listingTitle:
          listings.find((listing) => listing.id === listingId)?.title ??
          "Listing",
      })),
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const unreadActivityIdSet = new Set(unreadActivityIds);
  const notificationItems = activityFeedItems
    .filter((item) => unreadActivityIdSet.has(item.id))
    .slice(0, 8);

  const handleActivityClick = (item: NotificationItem) => {
    setUnreadActivityIds((current) => current.filter((id) => id !== item.id));
    setShowActivityPanel(false);
    setHighlightedActivityId(item.id);

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedActivityId((current) =>
        current === item.id ? null : current,
      );
    }, LISTING_HIGHLIGHT_DURATION_MS);

    const targetElement =
      document.getElementById(`activity-${item.id}`) ??
      document.getElementById(`listing-${item.listingId}`);

    targetElement?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const createListing = async () => {
    const trimmedTitleLength = title.trim().length;
    const trimmedDescriptionLength = description.trim().length;
    const parsedPrice = parsePriceValue(price);

    if (
      trimmedTitleLength < TITLE_MIN_LENGTH ||
      trimmedTitleLength > TITLE_MAX_LENGTH
    ) {
      const error = `Title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`;
      setFormError(error);
      alert(error);
      return;
    }

    if (
      trimmedDescriptionLength < DESCRIPTION_MIN_LENGTH ||
      trimmedDescriptionLength > DESCRIPTION_MAX_LENGTH
    ) {
      const error = `Description must be between ${DESCRIPTION_MIN_LENGTH} and ${DESCRIPTION_MAX_LENGTH} characters.`;
      setFormError(error);
      alert(error);
      return;
    }

    if (price === "" || isNaN(parsedPrice)) {
      const error = "Please fill out all fields correctly";
      setFormError(error);
      alert(error);
      return;
    }

    if (!condition) {
      const error = "Please select a condition.";
      setFormError(error);
      alert(error);
      return;
    }

    if (!selectedMarketplaces.includes("backbook")) {
      const error = "Please select at least one enabled marketplace.";
      setFormError(error);
      alert(error);
      return;
    }

    const normalizedPrice = Number(parsedPrice.toFixed(2));
    setFormError("");

    const res = await fetch("/api/listings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description,
        price: normalizedPrice,
        condition,
        marketplaces: selectedMarketplaces,
      }),
    });

    if (!res.ok) {
      let errorMessage = "Failed to create listing";

      try {
        const data = await res.json();

        if (typeof data.error === "string" && data.error) {
          errorMessage = data.error;
        }
      } catch {
        // Fall back to the default message if the response body is not JSON.
      }

      setFormError(errorMessage);
      alert(errorMessage);
      return;
    }

    await syncDashboard();

    setTitle("");
    setDescription("");
    setPrice("");
    setCondition("");
    setSelectedMarketplaces([]);
  };

  const handleDeleteListing = async (listingId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this listing?",
    );

    if (!confirmed) {
      return;
    }

    const res = await fetch(`/api/listings?id=${listingId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      alert("Failed to delete listing");
      return;
    }

    await syncDashboard();
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fafaf9",
        padding: isMobile
          ? "28px 14px 56px"
          : isTablet
            ? "36px 18px 68px"
            : "48px 20px 80px",
      }}
    >
      <div
        style={{
          maxWidth: "860px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            marginBottom: "28px",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
              flexDirection: isMobile ? "column" : "row",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#a8a29e",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Seller Dashboard
              </p>
              <h1
                style={{
                  margin: "10px 0 8px",
                  fontSize: isMobile ? "30px" : isTablet ? "34px" : "40px",
                  lineHeight: 1.1,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Marketplace Listings
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: isMobile ? "15px" : "16px",
                  lineHeight: 1.7,
                  color: "#78716c",
                  whiteSpace: "nowrap",
                }}
              >
                Create listings, track their status, and review the latest
                marketplace activity in one place.
              </p>
            </div>

            <div
              style={{
                position: "relative",
                alignSelf: isMobile ? "stretch" : "flex-start",
              }}
            >
              <button
                onClick={() => setShowActivityPanel((current) => !current)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  border: "1px solid #e7e5e4",
                  background: "#ffffff",
                  color: "#292524",
                  borderRadius: "999px",
                  padding: "10px 14px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                  width: isMobile ? "100%" : "auto",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M9 18h6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10.5 21h3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M5 16.5h14l-1.4-1.9a4 4 0 0 1-.77-2.36V10a4.83 4.83 0 1 0-9.66 0v2.24a4 4 0 0 1-.77 2.36L5 16.5Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Notifications</span>
                </span>
                <span
                  style={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "22px",
                    height: "22px",
                    borderRadius: "999px",
                    background:
                      notificationItems.length > 0 ? "#ef4444" : "#f5f5f4",
                    color: notificationItems.length > 0 ? "#ffffff" : "#78716c",
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "0 6px",
                  }}
                >
                  {notificationItems.length}
                </span>
              </button>

              {showActivityPanel ? (
                <div
                  style={{
                    position: "absolute",
                    top: isMobile ? "calc(100% + 10px)" : "calc(100% + 12px)",
                    right: 0,
                    width: isMobile ? "100%" : "360px",
                    maxHeight: "360px",
                    overflowY: "auto",
                    background: "#ffffff",
                    border: "1px solid #e7e5e4",
                    borderRadius: "16px",
                    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.10)",
                    padding: "10px",
                    zIndex: 20,
                  }}
                >
                  {notificationItems.length === 0 ? (
                    <div
                      style={{
                        padding: "14px",
                        color: "#78716c",
                        fontSize: "14px",
                      }}
                    >
                      No new notifications right now.
                    </div>
                  ) : (
                    notificationItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleActivityClick(item)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          background: "#ffffff",
                          border: "none",
                          borderRadius: "12px",
                          padding: "12px",
                          cursor: "pointer",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#292524",
                          }}
                        >
                          {formatActivityEventType(item.eventType)}
                        </p>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: "13px",
                            color: "#57534e",
                            lineHeight: 1.5,
                          }}
                        >
                          {item.message}
                        </p>
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: "12px",
                            color: "#78716c",
                          }}
                        >
                          {item.listingTitle}
                        </p>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: "12px",
                            color: "#a8a29e",
                          }}
                        >
                          {formatDateTime(item.createdAt)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e7e5e4",
            borderRadius: "18px",
            padding: isMobile ? "18px" : "24px",
            marginBottom: "24px",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ marginBottom: "18px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: 600,
                color: "#111827",
              }}
            >
              Create Listing
            </h2>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: "14px",
                color: "#78716c",
              }}
            >
              Add a new listing and send it into the publish flow.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            <input
              placeholder="Title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) {
                  setFormError("");
                }
              }}
              minLength={TITLE_MIN_LENGTH}
              maxLength={TITLE_MAX_LENGTH}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #e7e5e4",
                borderRadius: "12px",
                padding: "12px 14px",
                fontSize: "14px",
                color: "#111827",
                background: "#ffffff",
                outline: "none",
              }}
            />
            <p
              style={{
                margin: "-4px 0 0",
                fontSize: "12px",
                color: "#a8a29e",
                textAlign: "right",
              }}
            >
              {title.length} / {TITLE_MAX_LENGTH}
            </p>

            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (formError) {
                  setFormError("");
                }
              }}
              minLength={DESCRIPTION_MIN_LENGTH}
              maxLength={DESCRIPTION_MAX_LENGTH}
              rows={5}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #e7e5e4",
                borderRadius: "12px",
                padding: "12px 14px",
                fontSize: "14px",
                color: "#111827",
                background: "#ffffff",
                outline: "none",
                resize: "vertical",
                minHeight: "120px",
                maxHeight: "240px",
                overflowY: "auto",
                fontFamily: "inherit",
              }}
            />
            <p
              style={{
                margin: "-4px 0 0",
                fontSize: "12px",
                color: "#a8a29e",
                textAlign: "right",
              }}
            >
              {description.length} / {DESCRIPTION_MAX_LENGTH}
            </p>

            <div>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "12px",
                  color: "#a8a29e",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Condition
              </p>
              <select
                value={condition}
                onChange={(e) => {
                  setCondition(e.target.value);
                  if (formError) {
                    setFormError("");
                  }
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #e7e5e4",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  fontSize: "14px",
                  color: "#111827",
                  background: "#ffffff",
                  outline: "none",
                }}
              >
                <option value="" disabled hidden>
                  Select condition
                </option>
                {CONDITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <input
              placeholder="$0.00"
              value={price}
              onChange={(e) => {
                setPrice(formatPriceInput(e.target.value));
                if (formError) {
                  setFormError("");
                }
              }}
              onKeyDown={handlePriceKeyDown}
              onBlur={() => {
                if (price !== "" && !isNaN(parsePriceValue(price))) {
                  setPrice(`$${parsePriceValue(price).toFixed(2)}`);
                }
              }}
              inputMode="decimal"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #e7e5e4",
                borderRadius: "12px",
                padding: "12px 14px",
                fontSize: "14px",
                color: "#111827",
                background: "#ffffff",
                outline: "none",
              }}
            />

            <div>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "12px",
                  color: "#a8a29e",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Marketplaces
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  flexDirection: isMobile ? "column" : "row",
                }}
              >
                {marketplaceOptions.map((option) => {
                  const isSelected = selectedMarketplaces.includes(option.key);

                  return (
                    <button
                      key={option.key}
                      type="button"
                      disabled={!option.enabled}
                      onClick={() => toggleMarketplace(option.key)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        width: isMobile ? "100%" : "auto",
                        border: isSelected
                          ? "1px solid #1d4ed8"
                          : "1px solid #e7e5e4",
                        background: isSelected ? "#eff6ff" : "#ffffff",
                        color: option.enabled ? "#111827" : "#a8a29e",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: option.enabled ? "pointer" : "not-allowed",
                        opacity: option.enabled ? 1 : 0.7,
                      }}
                    >
                      <span>{option.label}</span>
                      {!option.enabled ? (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#a8a29e",
                          }}
                        >
                          Coming Soon
                        </span>
                      ) : isSelected ? (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#1d4ed8",
                          }}
                        >
                          Selected
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {formError ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#b91c1c",
                }}
              >
                {formError}
              </p>
            ) : null}

            <div>
              <button
                onClick={createListing}
                style={{
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "#ffffff",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  width: isMobile ? "100%" : "auto",
                  marginLeft: isMobile ? 0 : "auto",
                  display: "block",
                }}
              >
                Create Listing
              </button>
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "4px",
            }}
          >
            {[
              { key: "active" as const, label: "Active", count: activeCount },
              { key: "sold" as const, label: "Sold", count: soldCount },
            ].map((option) => {
              const isSelected = filter === option.key;

              return (
                <button
                  key={option.key}
                  onClick={() => setFilter(option.key)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    border: isSelected
                      ? "1px solid #111827"
                      : "1px solid #e7e5e4",
                    background: isSelected ? "#111827" : "#ffffff",
                    color: isSelected ? "#ffffff" : "#44403c",
                    borderRadius: "999px",
                    padding: "10px 14px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: isSelected
                      ? "0 4px 12px rgba(17, 24, 39, 0.12)"
                      : "none",
                    width: isMobile ? "100%" : "auto",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{option.label}</span>
                  <span
                    style={{
                      minWidth: "24px",
                      padding: "2px 7px",
                      borderRadius: "999px",
                      background: isSelected
                        ? "rgba(255,255,255,0.16)"
                        : "#f5f5f4",
                      color: isSelected ? "#ffffff" : "#78716c",
                      fontSize: "12px",
                      textAlign: "center",
                    }}
                  >
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredListings.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e7e5e4",
                borderRadius: "16px",
                padding: "24px",
                color: "#78716c",
                fontSize: "14px",
              }}
            >
              No listings in this view yet.
            </div>
          ) : null}

          {filteredListings.map((item) => (
            <ListingCard
              key={item.id}
              listing={item}
              activity={activityByListing[item.id] ?? []}
              isMobile={isMobile}
              highlightedActivityId={highlightedActivityId}
              onDelete={handleDeleteListing}
              onUpdate={syncDashboard}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
