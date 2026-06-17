import { EventItem } from "../data/mockEvents";

export function injectEventSchema(item: EventItem): void {
  if (typeof document === "undefined") return;

  const existing = document.getElementById("event-schema-ld");
  if (existing) existing.remove();

  if (!item.title || !item.startIso) return;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": item.title,
    "startDate": item.startIso,
    "description": item.longDesc ?? item.desc ?? item.title,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  };

  if (item.endIso) {
    schema["endDate"] = item.endIso;
  }

  if (item.location || item.lat) {
    schema["location"] = {
      "@type": "Place",
      "name": item.location ?? "See event for details",
      ...(item.lat && item.lng ? {
        "geo": {
          "@type": "GeoCoordinates",
          "latitude":  item.lat,
          "longitude": item.lng,
        },
      } : {}),
    };
  }

  if (item.booking?.url) {
    schema["offers"] = {
      "@type": "Offer",
      "url":           item.booking.url,
      "price":         "0",
      "priceCurrency": "USD",
      "availability":  "https://schema.org/InStock",
    };
  }

  if (item.imageUrl) {
    schema["image"] = item.imageUrl;
  }

  if (item.source) {
    schema["organizer"] = {
      "@type": "Organization",
      "name":  item.source,
    };
  }

  const script = document.createElement("script");
  script.id   = "event-schema-ld";
  script.type = "application/ld+json";
  script.text = JSON.stringify(schema);
  document.head.appendChild(script);
}

export function removeEventSchema(): void {
  if (typeof document === "undefined") return;
  document.getElementById("event-schema-ld")?.remove();
}
