import React, { useMemo, useState, useCallback } from "react";
import { Alert, Empty, Skeleton, Button, Tooltip } from "antd";
import { ZoomInOutlined, ZoomOutOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

type SurveyLocation = {
  id: string | number;
  latitude: number;
  longitude: number;
  label?: string | null;
};

type SurveyMapProps = {
  loading?: boolean;
  locations: SurveyLocation[];
  height?: number;
};

const geoUrl =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

// Point-in-polygon check using ray casting algorithm
const pointInPolygon = (point: [number, number], rings: number[][][]): boolean => {
  const [x, y] = point;
  let inside = false;
  
  // Check each polygon ring (outer ring and holes)
  for (const ring of rings) {
    if (!ring || ring.length < 3) continue;
    
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ringPointI = ring[i];
      const ringPointJ = ring[j];
      
      if (!ringPointI || !ringPointJ || ringPointI.length < 2 || ringPointJ.length < 2) continue;
      
      const xi = ringPointI[0];
      const yi = ringPointI[1];
      const xj = ringPointJ[0];
      const yj = ringPointJ[1];
      
      const intersect = 
        ((yi > y) !== (yj > y)) && 
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
  }
  
  return inside;
};

// Get color based on survey count
const getColorForCount = (count: number, maxCount: number): string => {
  if (count === 0) return "#e0e7ff"; // Light indigo for no surveys
  if (maxCount === 0) return "#e0e7ff";
  
  const intensity = count / maxCount;
  
  // Color gradient from light blue to deep blue/purple
  if (intensity < 0.2) return "#bfdbfe"; // Light blue
  if (intensity < 0.4) return "#93c5fd"; // Medium light blue
  if (intensity < 0.6) return "#60a5fa"; // Medium blue
  if (intensity < 0.8) return "#3b82f6"; // Blue
  return "#2563eb"; // Deep blue
};

const SurveyMap: React.FC<SurveyMapProps> = ({
  loading = false,
  locations,
  height = 600,
}) => {
  const [position, setPosition] = useState({ coordinates: [0, 0], zoom: 1 });
  const [tooltipContent, setTooltipContent] = useState<string>("");

  const validLocations = useMemo(
    () =>
      (locations ?? [])
        .map((item) => {
          const lat = toNumber(item.latitude);
          const lng = toNumber(item.longitude);
          if (lat === null || lng === null) return null;
          return {
            id: item.id,
            lat,
            lng,
            label: item.label,
          };
        })
        .filter(Boolean) as Array<{ id: string | number; lat: number; lng: number; label?: string | null }>,
    [locations]
  );

  // Create a map of country codes to survey counts using geography data
  const [countryCountsMap, setCountryCountsMap] = useState<Record<string, number>>({});

  // Enhanced country detection using geography data
  const getCountrySurveyCount = useCallback((geo: any): number => {
    const countryCode = geo.properties.ISO_A2 || geo.properties.ISO_A3 || geo.rsmKey;
    return countryCountsMap[countryCode] || 0;
  }, [countryCountsMap]);

  // Process geography data to count surveys per country
  const processGeographies = useCallback((geographies: any[]) => {
    const counts: Record<string, number> = {};
    
    geographies.forEach((geo) => {
      const countryCode = geo.properties.ISO_A2 || geo.properties.ISO_A3 || geo.rsmKey;
      counts[countryCode] = 0;
    });

    // For each survey location, find which country it belongs to
    validLocations.forEach((location) => {
      const { lat, lng } = location;
      
      // Find the country that contains this point
      for (const geo of geographies) {
        const countryCode = geo.properties.ISO_A2 || geo.properties.ISO_A3 || geo.rsmKey;
        
        // Use bounding box check first (faster)
        const bbox = geo.bbox;
        if (bbox && (lng < bbox[0] || lng > bbox[2] || lat < bbox[1] || lat > bbox[3])) {
          continue;
        }
        
        // Then do point-in-polygon check
        let isInside = false;
        try {
          if (geo.geometry.type === "Polygon") {
            const coordinates = geo.geometry.coordinates;
            for (const ring of coordinates) {
              if (pointInPolygon([lng, lat], [ring])) {
                isInside = true;
                break;
              }
            }
          } else if (geo.geometry.type === "MultiPolygon") {
            for (const polygon of geo.geometry.coordinates) {
              if (pointInPolygon([lng, lat], polygon)) {
                isInside = true;
                break;
              }
            }
          }
        } catch (e) {
          // If geometry check fails, skip
          continue;
        }
        
        if (isInside) {
          counts[countryCode] = (counts[countryCode] || 0) + 1;
          break; // Found the country, no need to check others
        }
      }
    });
    
    setCountryCountsMap(counts);
  }, [validLocations]);

  const maxSurveyCount = useMemo(() => {
    const values = Object.values(countryCountsMap);
    return values.length > 0 ? Math.max(...values, 1) : 1;
  }, [countryCountsMap]);

  const handleMoveEnd = useCallback((position: any) => {
    if (position) {
      setPosition(position);
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    if (position.zoom >= 4) return;
    setPosition((pos) => ({ 
      ...pos, 
      zoom: Math.min(pos.zoom * 1.5, 4) 
    }));
  }, [position.zoom]);

  const handleZoomOut = useCallback(() => {
    if (position.zoom <= 0.5) return;
    setPosition((pos) => ({ 
      ...pos, 
      zoom: Math.max(pos.zoom / 1.5, 0.5) 
    }));
  }, [position.zoom]);

  const handleReset = useCallback(() => {
    setPosition({ coordinates: [0, 0], zoom: 1 });
  }, []);

  if (loading) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: 16,
        }}
      >
        <Skeleton.Input
          style={{ width: "60%", height: height * 0.6 }}
          active
        />
      </div>
    );
  }

  if (!validLocations.length) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Empty description="No survey locations available yet." />
      </div>
    );
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        padding: 20,
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
        position: "relative",
      }}
    >
      {/* Zoom Controls */}
      <div
        style={{
          position: "absolute",
          top: 30,
          right: 30,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "white",
          padding: 8,
          borderRadius: 8,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
      >
        <Tooltip title="Zoom In">
          <Button
            icon={<ZoomInOutlined />}
            onClick={handleZoomIn}
            disabled={position.zoom >= 4}
            size="small"
          />
        </Tooltip>
        <Tooltip title="Zoom Out">
          <Button
            icon={<ZoomOutOutlined />}
            onClick={handleZoomOut}
            disabled={position.zoom <= 1}
            size="small"
          />
        </Tooltip>
        <Tooltip title="Reset View">
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            size="small"
          />
        </Tooltip>
      </div>

      <ComposableMap
        projectionConfig={{
          scale: 147,
          center: [0, 20],
        }}
        style={{ width: "100%", height }}
      >
        <ZoomableGroup
          zoom={position.zoom}
          center={position.coordinates}
          onMoveEnd={handleMoveEnd}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) => {
              // Process geographies on first load
              if (Object.keys(countryCountsMap).length === 0 && geographies.length > 0) {
                processGeographies(geographies);
              }
              
              return geographies.map((geo) => {
                const surveyCount = getCountrySurveyCount(geo);
                const fillColor = getColorForCount(surveyCount, maxSurveyCount);
                const countryName = geo.properties.NAME || geo.properties.NAME_LONG || geo.properties.NAME_EN || "Unknown";

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => {
                      setTooltipContent(
                        `${countryName}: ${surveyCount} survey${surveyCount !== 1 ? "s" : ""}`
                      );
                    }}
                    onMouseLeave={() => {
                      setTooltipContent("");
                    }}
                    style={{
                      default: {
                        fill: fillColor,
                        outline: "none",
                        stroke: "#ffffff",
                        strokeWidth: 0.5,
                        transition: "all 0.3s ease",
                      },
                      hover: {
                        fill: surveyCount > 0 ? "#1e40af" : "#9ca3af",
                        outline: "none",
                        stroke: "#1e3a8a",
                        strokeWidth: 1.5,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      },
                      pressed: {
                        fill: surveyCount > 0 ? "#1e3a8a" : "#6b7280",
                        outline: "none",
                        stroke: "#1e3a8a",
                        strokeWidth: 2,
                      },
                    }}
                  />
                );
              });
            }}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {tooltipContent && (
        <div
          style={{
            position: "absolute",
            bottom: 30,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          {tooltipContent}
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          left: 30,
          background: "white",
          padding: 16,
          borderRadius: 8,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          zIndex: 1000,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
          Survey Density
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 20,
                height: 12,
                background: "#2563eb",
                borderRadius: 2,
              }}
            />
            <span style={{ fontSize: 11, color: "#6b7280" }}>High ({Math.ceil(maxSurveyCount * 0.8)}+)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 20,
                height: 12,
                background: "#60a5fa",
                borderRadius: 2,
              }}
            />
            <span style={{ fontSize: 11, color: "#6b7280" }}>Medium</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 20,
                height: 12,
                background: "#bfdbfe",
                borderRadius: 2,
              }}
            />
            <span style={{ fontSize: 11, color: "#6b7280" }}>Low</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 20,
                height: 12,
                background: "#e0e7ff",
                borderRadius: 2,
              }}
            />
            <span style={{ fontSize: 11, color: "#6b7280" }}>No Surveys</span>
          </div>
        </div>
      </div>

      <Alert
        style={{ marginTop: 12 }}
        type="info"
        showIcon
        message="Colored regions represent survey density. Hover over countries to see survey counts."
      />
    </div>
  );
};

export default SurveyMap;

