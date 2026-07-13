import React, { useCallback, useMemo } from "react";
import { Alert, Spin, Typography } from "antd";
import {
  GoogleMap,
  Marker,
  Polyline,
  useJsApiLoader,
} from "@react-google-maps/api";

const { Text } = Typography;

declare global {
  interface Window {
    google?: typeof google;
  }
}

type LatLngLiteral = {
  lat: number;
  lng: number;
};

type RouteGeometry = {
  path: LatLngLiteral[];
  start?: LatLngLiteral;
  end?: LatLngLiteral;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
};

type RouteMapProps = {
  route: unknown;
  height?: number;
  apiKey?: string;
};

const DEFAULT_CENTER: LatLngLiteral = { lat: 18.5204, lng: 73.8567 };

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 8,
  overflow: "hidden",
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = parseFloat(value);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) return numeric;
  }
  return null;
};

const decodePolyline = (encoded: string): LatLngLiteral[] => {
  if (!encoded) return [];
  let index = 0;
  const len = encoded.length;
  const path: LatLngLiteral[] = [];
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    path.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return path;
};

const extractPathFromString = (value: string): LatLngLiteral[] => {
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (/^[a-zA-Z0-9_.~:-]+$/.test(trimmed) && /[A-Za-z]/.test(trimmed)) {
    return decodePolyline(trimmed);
  }

  const separators = /[|;\n]/;
  const segments = trimmed.split(separators);
  const result: LatLngLiteral[] = [];

  segments.forEach((segment) => {
    const [latRaw, lngRaw] = segment.split(",").map((token) => token?.trim());
    const lat = toNumber(latRaw);
    const lng = toNumber(lngRaw);
    if (lat !== null && lng !== null) {
      result.push({ lat, lng });
    }
  });

  return result;
};

const extractPathRecursively = (
  input: unknown,
  depth = 0
): LatLngLiteral[] => {
  if (!input || depth > 6) return [];

  if (Array.isArray(input)) {
    if (
      input.length === 2 &&
      toNumber(input[0]) !== null &&
      toNumber(input[1]) !== null
    ) {
      const lat = toNumber(input[0]);
      const lng = toNumber(input[1]);
      if (lat !== null && lng !== null) {
        return [{ lat, lng }];
      }
    }

    return input.flatMap((item) => extractPathRecursively(item, depth + 1));
  }

  if (typeof input === "string") {
    return extractPathFromString(input);
  }

  if (typeof input !== "object") return [];

  const candidate = input as Record<string, unknown>;
  const lat =
    toNumber(candidate.lat) ??
    toNumber(candidate.latitude) ??
    toNumber(candidate.Latitude);
  const lng =
    toNumber(candidate.lng) ??
    toNumber(candidate.longitude) ??
    toNumber(candidate.Longitude);

  if (lat !== null && lng !== null) {
    return [{ lat, lng }];
  }

  if (candidate.location) {
    const nested = extractPathRecursively(candidate.location, depth + 1);
    if (nested.length) return nested;
  }

  if (candidate.position) {
    const nested = extractPathRecursively(candidate.position, depth + 1);
    if (nested.length) return nested;
  }

  if (candidate.geometry) {
    const nested = extractPathRecursively(candidate.geometry, depth + 1);
    if (nested.length) return nested;
  }

  const pathKeys = [
    "path",
    "paths",
    "points",
    "coordinates",
    "polyline",
    "overview_path",
    "overviewPath",
    "polylinePoints",
    "routes",
    "legs",
    "steps",
  ];

  for (const key of pathKeys) {
    if (candidate[key]) {
      const nested = extractPathRecursively(candidate[key], depth + 1);
      if (nested.length) return nested;
    }
  }

  return [];
};

const computeBounds = (path: LatLngLiteral[]) => {
  if (!path.length) return undefined;

  let north = path[0].lat;
  let south = path[0].lat;
  let east = path[0].lng;
  let west = path[0].lng;

  path.forEach((point) => {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  });

  return { north, south, east, west };
};

const buildGeometry = (route: unknown): RouteGeometry | null => {
  if (!route) return null;

  if (
    route &&
    typeof route === "object" &&
    !Array.isArray(route) &&
    Array.isArray((route as any).path)
  ) {
    const candidate = route as any;
    const normalisedPath = (candidate.path as unknown[])
      .map((point) => extractPathRecursively(point))
      .flat();
    const normalisedStart = extractPathRecursively(candidate.start);
    const normalisedEnd = extractPathRecursively(candidate.end);
    if (normalisedPath.length) {
      return {
        path: normalisedPath,
        start: normalisedStart[0] ?? normalisedPath[0],
        end: normalisedEnd[0] ?? normalisedPath[normalisedPath.length - 1],
        bounds: computeBounds(normalisedPath),
      };
    }
  }

  const path = extractPathRecursively(route);
  if (!path.length) return null;

  const bounds = computeBounds(path);
  return {
    path,
    bounds,
    start: path[0],
    end: path[path.length - 1],
  };
};

const RouteMap: React.FC<RouteMapProps> = ({
  route,
  height = 260,
  apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
}) => {
  const geometry = useMemo(() => buildGeometry(route), [route]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "travel-tracker-map",
    googleMapsApiKey: apiKey ?? "",
  });

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      if (!geometry?.path.length) return;
      if (!("google" in window) || !window.google?.maps) return;

      const bounds = new window.google.maps.LatLngBounds();
      geometry.path.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, 32);
    },
    [geometry]
  );

  const mapHeightStyle = useMemo<React.CSSProperties>(
    () => ({
      ...containerStyle,
      height,
    }),
    [height]
  );

  if (!apiKey) {
    return (
      <Alert
        type="warning"
        message="Google Maps API key missing"
        description="Set REACT_APP_GOOGLE_MAPS_API_KEY in your environment to display the route map."
        showIcon
      />
    );
  }

  if (loadError) {
    return (
      <Alert
        type="error"
        message="Failed to load map"
        description={loadError.message}
        showIcon
      />
    );
  }

  if (!isLoaded) {
    return (
      <div
        style={{
          ...mapHeightStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f5",
        }}
      >
        <Spin tip="Loading map..." />
      </div>
    );
  }

  if (!geometry?.path.length) {
    return (
      <div
        style={{
          ...mapHeightStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f5",
        }}
      >
        <Text type="secondary">Route geometry unavailable for this record.</Text>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapHeightStyle}
      center={geometry.bounds ? undefined : DEFAULT_CENTER}
      zoom={geometry.bounds ? undefined : 12}
      options={MAP_OPTIONS}
      onLoad={onMapLoad}
    >
      <Polyline
        path={geometry.path}
        options={{
          strokeColor: "#ff4d4f",
          strokeOpacity: 0.95,
          strokeWeight: 6,
          clickable: false,
          geodesic: true,
        }}
      />
      {geometry.start ? (
        <Marker
          position={geometry.start}
          label={{ text: "Start", fontWeight: "600", color: "#ffffff" }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#52c41a",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#ffffff",
          }}
        />
      ) : null}
      {geometry.end ? (
        <Marker
          position={geometry.end}
          label={{ text: "End", fontWeight: "600", color: "#ffffff" }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#ff4d4f",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#ffffff",
          }}
        />
      ) : null}
    </GoogleMap>
  );
};

export default RouteMap;

