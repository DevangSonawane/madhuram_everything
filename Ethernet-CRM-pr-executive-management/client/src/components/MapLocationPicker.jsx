import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER = { lat: 19.076, lng: 72.8777 }; // Mumbai
const DEFAULT_ZOOM = 12;

function clampText(value, max = 140) {
  const str = String(value ?? "");
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

async function nominatimSearch(query, { signal } = {}) {
  const q = String(query ?? "").trim();
  if (!q) return [];
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "8");
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function nominatimReverse({ lat, lng }, { signal } = {}) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Reverse failed (${res.status})`);
  return await res.json();
}

function ClickToPick({ onPick }) {
  useMapEvents({
    click(e) {
      onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function MapLocationPicker({
  open,
  onOpenChange,
  initialCenter,
  initialZoom,
  onSelect,
  title = "Select location from maps",
}) {
  const mapRef = useRef(null);
  const center = initialCenter ?? DEFAULT_CENTER;
  const zoom = initialZoom ?? DEFAULT_ZOOM;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [picked, setPicked] = useState(null); // {lat,lng}
  const [pickedLabel, setPickedLabel] = useState("");
  const [reverseLoading, setReverseLoading] = useState(false);

  const markerPosition = useMemo(() => {
    if (!picked) return null;
    return [picked.lat, picked.lng];
  }, [picked]);

  useEffect(() => {
    if (!open) return;
    setSearchError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const data = await nominatimSearch(q, { signal: controller.signal });
        setResults(
          data.map((item) => ({
            id: String(item.place_id ?? item.osm_id ?? item.display_name ?? Math.random()),
            label: String(item.display_name ?? "").trim(),
            lat: Number(item.lat),
            lng: Number(item.lon),
          }))
        );
      } catch (err) {
        if (err?.name === "AbortError") return;
        setSearchError(err?.message || "Search failed");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [open, query]);

  const pickLatLng = async ({ lat, lng }, { fly = true } = {}) => {
    const next = { lat, lng };
    setPicked(next);

    if (fly && mapRef.current) {
      mapRef.current.flyTo([lat, lng], Math.max(15, mapRef.current.getZoom() || 15), { duration: 0.6 });
    }

    const controller = new AbortController();
    setReverseLoading(true);
    try {
      const data = await nominatimReverse(next, { signal: controller.signal });
      setPickedLabel(String(data?.display_name || "").trim());
    } catch (err) {
      if (err?.name === "AbortError") return;
      setPickedLabel("");
    } finally {
      setReverseLoading(false);
    }
  };

  const confirm = () => {
    if (!picked) return;
    onSelect?.({
      lat: picked.lat,
      lng: picked.lng,
      label: pickedLabel,
    });
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:p-0 sm:inset-0 sm:left-0 sm:top-0 sm:-translate-x-0 sm:-translate-y-0 sm:max-w-none sm:max-h-none sm:rounded-none sm:border-0">
        <div className="flex h-[100dvh] w-screen flex-col bg-background">
          <DialogHeader className="border-b px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" /> {title}
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange?.(false)}
                aria-label="Close map"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="pl-9"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>

              {!!searchError && <p className="text-xs text-destructive">{searchError}</p>}

              {results.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border bg-background">
                  {results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={cn(
                        "block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-muted",
                        picked && Math.abs(picked.lat - r.lat) < 1e-7 && Math.abs(picked.lng - r.lng) < 1e-7 && "bg-muted"
                      )}
                      onClick={() => pickLatLng({ lat: r.lat, lng: r.lng })}
                    >
                      {clampText(r.label)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="relative flex-1">
            <MapContainer
              center={[center.lat, center.lng]}
              zoom={zoom}
              className="h-full w-full"
              ref={(instance) => {
                if (instance && !mapRef.current) mapRef.current = instance;
              }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClickToPick onPick={(latlng) => pickLatLng(latlng, { fly: false })} />
              {markerPosition && <Marker position={markerPosition} />}
            </MapContainer>

            <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center px-4">
              <div className="pointer-events-auto w-full max-w-3xl rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Click anywhere on map to pick a point{reverseLoading ? " · Looking up address…" : ""}
                    </p>
                    <p className="truncate text-sm font-medium">
                      {pickedLabel ? pickedLabel : picked ? `Lat ${picked.lat.toFixed(6)}, Lng ${picked.lng.toFixed(6)}` : "No location selected"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t px-4 py-3 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirm} disabled={!picked}>
              Use this location
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
