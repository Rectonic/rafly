"use client";

import { useEffect, useRef } from "react";
import * as L from "leaflet";
import type {
  CircleMarker,
  FeatureGroup,
  Map as LeafletMap,
  TileLayer,
} from "leaflet";

import type { Offer } from "@/types/offer";

const DEFAULT_CENTER: [number, number] = [41.3111, 69.2797];

export type MapTheme = "clean" | "standard" | "dark";

const MAP_THEMES: Record<
  MapTheme,
  { url: string; attribution: string; subdomains?: string[] }
> = {
  clean: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: ["a", "b", "c", "d"],
  },
  standard: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: ["a", "b", "c", "d"],
  },
};

interface OffersMapProps {
  offers: Offer[];
  activeOfferId: string | null;
  mapTheme: MapTheme;
  onActiveOfferChange: (offerId: string | null) => void;
}

function getMarkerStyles(isActive: boolean) {
  return {
    color: isActive ? "#0f766e" : "#16C79A",
    fillColor: isActive ? "#0f766e" : "#16C79A",
    fillOpacity: 0.85,
    radius: isActive ? 11 : 8,
    weight: 2,
  } satisfies L.CircleMarkerOptions;
}

function buildTooltipContent(offer: Offer) {
  const wrapper = document.createElement("div");
  wrapper.className = "space-y-0.5";

  const title = document.createElement("p");
  title.className = "text-xs font-semibold";
  title.textContent = offer.restaurant;

  const meta = document.createElement("p");
  meta.className = "text-[11px] text-muted-foreground";
  meta.textContent = `${offer.distance} • $${offer.newPrice.toFixed(2)}`;

  wrapper.append(title, meta);
  return wrapper;
}

function buildPopupContent(offer: Offer) {
  const wrapper = document.createElement("div");
  wrapper.className = "space-y-1";

  const title = document.createElement("p");
  title.className = "text-sm font-semibold";
  title.textContent = offer.title;

  const restaurant = document.createElement("p");
  restaurant.className = "text-xs text-muted-foreground";
  restaurant.textContent = offer.restaurant;

  const address = document.createElement("p");
  address.className = "text-xs text-muted-foreground";
  address.textContent = offer.location.address;

  const savings = document.createElement("p");
  savings.className = "text-xs font-medium text-primary";
  savings.textContent = `Save ${offer.discount}% • Collect by ${offer.endTime}`;

  wrapper.append(title, restaurant, address, savings);
  return wrapper;
}

export default function OffersMap({
  offers,
  activeOfferId,
  mapTheme,
  onActiveOfferChange,
}: OffersMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const markersLayerRef = useRef<FeatureGroup | null>(null);
  const markersRef = useRef<Map<string, CircleMarker>>(new Map());
  const onActiveOfferChangeRef = useRef(onActiveOfferChange);

  useEffect(() => {
    onActiveOfferChangeRef.current = onActiveOfferChange;
  }, [onActiveOfferChange]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || mapRef.current) {
      return;
    }

    const leafletContainer = container as HTMLDivElement & {
      _leaflet_id?: number;
    };

    if (leafletContainer._leaflet_id) {
      leafletContainer._leaflet_id = undefined;
    }

    const map = L.map(container, {
      center: DEFAULT_CENTER,
      scrollWheelZoom: true,
      zoom: 12,
    });
    const markersLayer = L.featureGroup().addTo(map);
    const markers = markersRef.current;

    mapRef.current = map;
    markersLayerRef.current = markersLayer;

    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      markersLayer.clearLayers();
      markers.clear();
      markersLayerRef.current = null;

      if (tileLayerRef.current) {
        tileLayerRef.current.remove();
        tileLayerRef.current = null;
      }

      map.remove();
      mapRef.current = null;
      container.innerHTML = "";

      if (leafletContainer._leaflet_id) {
        leafletContainer._leaflet_id = undefined;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const layer = MAP_THEMES[mapTheme];

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const tileLayer = L.tileLayer(layer.url, {
      attribution: layer.attribution,
      subdomains: layer.subdomains,
    }).addTo(mapRef.current);

    tileLayerRef.current = tileLayer;

    return () => {
      if (tileLayerRef.current === tileLayer) {
        tileLayer.remove();
        tileLayerRef.current = null;
      }
    };
  }, [mapTheme]);

  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) {
      return;
    }

    const markersLayer = markersLayerRef.current;
    const visibleOfferIds = new Set(offers.map((offer) => offer.id));

    for (const [offerId, marker] of markersRef.current) {
      if (!visibleOfferIds.has(offerId)) {
        markersLayer.removeLayer(marker);
        markersRef.current.delete(offerId);
      }
    }

    for (const offer of offers) {
      let marker = markersRef.current.get(offer.id);

      if (!marker) {
        marker = L.circleMarker(
          [offer.location.lat, offer.location.lng],
          getMarkerStyles(false)
        );

        marker.on("click", () => onActiveOfferChangeRef.current(offer.id));
        marker.on("mouseover", () => onActiveOfferChangeRef.current(offer.id));
        marker.on("mouseout", () => onActiveOfferChangeRef.current(null));
        marker.addTo(markersLayer);

        markersRef.current.set(offer.id, marker);
      } else {
        marker.setLatLng([offer.location.lat, offer.location.lng]);
      }

      const tooltipContent = buildTooltipContent(offer);
      if (marker.getTooltip()) {
        marker.setTooltipContent(tooltipContent);
      } else {
        marker.bindTooltip(tooltipContent, {
          direction: "top",
          offset: [0, -8],
        });
      }

      const popupContent = buildPopupContent(offer);
      if (marker.getPopup()) {
        marker.setPopupContent(popupContent);
      } else {
        marker.bindPopup(popupContent);
      }
    }

    if (offers.length === 0) {
      mapRef.current.setView(DEFAULT_CENTER, 12);
    } else if (offers.length === 1) {
      const [offer] = offers;
      mapRef.current.setView([offer.location.lat, offer.location.lng], 14);
    } else {
      const bounds = L.latLngBounds(
        offers.map((offer) => [offer.location.lat, offer.location.lng])
      );

      mapRef.current.fitBounds(bounds, {
        maxZoom: 14,
        padding: [45, 45],
      });
    }

    requestAnimationFrame(() => {
      mapRef.current?.invalidateSize();
    });
  }, [offers]);

  useEffect(() => {
    const visibleOfferIds = new Set(offers.map((offer) => offer.id));

    for (const [offerId, marker] of markersRef.current) {
      if (!visibleOfferIds.has(offerId)) {
        continue;
      }

      const isActive = offerId === activeOfferId;
      const styles = getMarkerStyles(isActive);
      marker.setStyle(styles);
      marker.setRadius(styles.radius ?? 8);
    }
  }, [activeOfferId, offers]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-[500] -translate-x-1/2 rounded-full border border-primary/20 bg-background/95 px-4 py-2 shadow-md backdrop-blur">
        <p className="text-xs font-semibold text-foreground">
          {offers.length} live offer{offers.length === 1 ? "" : "s"} on map
        </p>
      </div>
    </div>
  );
}
