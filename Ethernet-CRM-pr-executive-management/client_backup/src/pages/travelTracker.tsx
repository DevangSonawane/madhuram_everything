import React, { useEffect, useMemo, useState } from "react";
import dayjs, { Dayjs } from "dayjs";

import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Typography,
  Button,
  Tabs,
  Timeline,
  Tag,
  Space,
  Collapse,
  Spin,
  Empty,
  Alert,
} from "antd";
import {
  CarOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { apiClient } from "../utils/apiClient";
import RouteMap from "../components/RouteMap";

const { Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { Panel } = Collapse;

type Executive = {
  id: number;
  name: string;
  email?: string;
  role?: string;
};

type TravelRouteStop = {
  location?: string;
  address?: string;
  name?: string;
  place?: string;
  time?: string;
  time_range?: string;
  timeRange?: string;
  from?: string;
  to?: string;
  start?: string;
  end?: string;
  start_time?: string;
  end_time?: string;
  startTime?: string;
  endTime?: string;
  duration?: string | number;
  durationMinutes?: number;
  duration_min?: number;
  duration_label?: string;
  parked?: string;
  notes?: string;
  distance?: string | number;
  distance_km?: number;
  distanceKm?: number;
};

type RoutePoint = {
  lat: number;
  lng: number;
};

type RouteGeometry = {
  path: RoutePoint[];
  start?: RoutePoint;
  end?: RoutePoint;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
};

type TravelRecord = {
  id: number;
  user_id: number;
  date: string;
  distance_km?: number;
  vehicle_type?: string;
  route?: any;
  payout?: number;
  started_at?: string | null;
  ended_at?: string | null;
  auto_ended?: boolean;
  routeGeometry?: RouteGeometry | null;
};

type TravelSummaryResponse = {
  records: TravelRecord[];
  summary: {
    totalDistance: number;
    eligibleDistance: number;
    totalPayout: number;
    ratePerKm: number;
  };
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  OWN_VEHICLE: "Own Vehicle",
  COLLEAGUE: "Colleague Vehicle",
  COMPANY_VEHICLE: "Company Vehicle",
  BIKE: "Bike",
  CAR: "Car",
  BUS: "Bus",
  OTHER: "Other",
};

const getVehicleMeta = (record: TravelRecord) => {
  const route = record.route ?? {};
  const vehicle =
    route?.vehicle ??
    route?.vehicleDetails ??
    route?.vehicle_details ??
    {};

  const name =
    route?.vehicleName ??
    route?.vehicle_name ??
    vehicle?.name ??
    route?.vehicleLabel ??
    VEHICLE_TYPE_LABELS[record.vehicle_type ?? ""] ??
    "Vehicle";
  const number =
    route?.vehicleNumber ??
    route?.vehicle_number ??
    vehicle?.number ??
    route?.vehicleRegistration ??
    route?.vehicle_reg_no ??
    null;

  const typeLabel =
    route?.vehicleType ??
    route?.vehicle_type ??
    vehicle?.type ??
    VEHICLE_TYPE_LABELS[record.vehicle_type ?? ""] ??
    "Vehicle";

  return {
    name: typeof name === "string" && name.trim() ? name : "Vehicle",
    number,
    typeLabel,
  };
};

const toMinutes = (duration: unknown) => {
  if (typeof duration === "number") return duration;
  if (typeof duration === "string") {
    const minutesMatch = duration.match(/(\d+)\s*min/i);
    if (minutesMatch) return parseInt(minutesMatch[1], 10);
    const hoursMatch = duration.match(/(\d+)\s*h/i);
    if (hoursMatch) return parseInt(hoursMatch[1], 10) * 60;
  }
  return null;
};

const formatTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;
  return parsed.format("hh:mm A");
};

const formatTimeRange = (stop: TravelRouteStop) => {
  const explicitRange =
    stop.time_range ||
    stop.timeRange ||
    stop.time ||
    stop.duration_label ||
    stop.notes;
  if (explicitRange) return explicitRange;

  const start =
    stop.startTime ||
    stop.start_time ||
    stop.start ||
    stop.from ||
    null;
  const end = stop.endTime || stop.end_time || stop.end || stop.to || null;

  const formattedStart = formatTime(start);
  const formattedEnd = formatTime(end);

  if (formattedStart && formattedEnd)
    return `${formattedStart} - ${formattedEnd}`;
  if (formattedStart) return formattedStart;
  if (formattedEnd) return formattedEnd;
  return null;
};

const formatParking = (stop: TravelRouteStop) => {
  if (stop.parked) return stop.parked;
  if (stop.duration_label) return stop.duration_label;

  const duration =
    stop.durationMinutes ??
    stop.duration_min ??
    toMinutes(stop.duration);

  if (typeof duration === "number" && Number.isFinite(duration)) {
    if (duration >= 60) {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      if (minutes === 0) return `Parked ${hours} hr${hours > 1 ? "s" : ""}`;
      return `Parked ${hours} hr ${minutes} mins`;
    }
    return `Parked ${duration} mins`;
  }

  return null;
};

const extractStops = (route: any): TravelRouteStop[] => {
  if (!route) return [];
  if (typeof route === "string" && route.trim()) {
    return [
      {
        location: route.trim(),
      },
    ];
  }
  if (Array.isArray(route)) return route;
  if (Array.isArray(route?.stops)) return route.stops;
  if (Array.isArray(route?.timeline)) return route.timeline;
  if (Array.isArray(route?.locations)) return route.locations;
  if (Array.isArray(route?.points)) return route.points;
  if (Array.isArray(route?.events)) return route.events;
  if (Array.isArray(route?.segments)) {
    return route.segments.map((segment: any, index: number) => {
      const startLabel = segment?.start || segment?.from || segment?.source;
      const endLabel = segment?.end || segment?.to || segment?.destination;
      const labelParts = [startLabel, endLabel].filter(Boolean);
      const location =
        labelParts.length === 2
          ? `${labelParts[0]} → ${labelParts[1]}`
          : labelParts[0] || `Segment ${index + 1}`;

      return {
        location,
        distance_km:
          segment?.distance_km ??
          segment?.distanceKm ??
          (typeof segment?.distance === "number"
            ? segment.distance
            : undefined),
        duration: segment?.duration ?? segment?.durationMinutes,
        notes: segment?.notes,
      };
    });
  }
  return [];
};

const VehicleTimelinePage: React.FC = () => {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [selectedExecutiveId, setSelectedExecutiveId] =
    useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [travelRecords, setTravelRecords] = useState<TravelRecord[]>([]);
  const [isLoadingExecutives, setIsLoadingExecutives] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderIcon = (type: string | undefined) => {
    switch (type) {
      case "car":
      case "CAR":
        return <CarOutlined />;
      case "bike":
      case "BIKE":
        return <CarOutlined rotate={90} />;
      default:
        return <CarOutlined />;
    }
  };

  const fetchExecutives = async () => {
    try {
      setIsLoadingExecutives(true);
      setError(null);
      const response: Executive[] = await apiClient(
        "get",
        "/api/v1/travelTracker/executives"
      );
      setExecutives(response);
      if (response.length > 0) {
        setSelectedExecutiveId(response[0].id);
      }
    } catch (err: any) {
      const message =
        err?.message ||
        err?.error ||
        "Failed to load executives. Please try again.";
      setError(message);
    } finally {
      setIsLoadingExecutives(false);
    }
  };

  const fetchTravelHistory = async (executiveId: number) => {
    try {
      setIsLoadingRecords(true);
      setError(null);
      const response: TravelRecord[] = await apiClient(
        "get",
        `/api/v1/travelTracker/employee/${executiveId}`
      );
      const sortedRecords = [...(response ?? [])].sort(
        (a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf()
      );
      setTravelRecords(sortedRecords);
    } catch (err: any) {
      const message =
        err?.message ||
        err?.error ||
        "Failed to load travel history. Please try again.";
      setError(message);
      setTravelRecords([]);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchExecutives();
  }, []);

  useEffect(() => {
    if (!selectedExecutiveId) return;
    fetchTravelHistory(selectedExecutiveId);
  }, [selectedExecutiveId]);

  const selectedDateRecords = useMemo(() => {
    if (!travelRecords.length) return [];
    if (!selectedDate) return travelRecords;
    return travelRecords.filter((record) =>
      dayjs(record.date).isSame(selectedDate, "day")
    );
  }, [travelRecords, selectedDate]);

  useEffect(() => {
    if (!selectedDateRecords.length) {
      setExpandedKeys([]);
      return;
    }
    const keys = selectedDateRecords.map(
      (record) => `${record.id}-${record.date}`
    );
    setExpandedKeys(keys);
  }, [selectedDateRecords]);

  const getStopTitle = (stop: TravelRouteStop, index: number) => {
    return (
      stop.location ||
      stop.address ||
      stop.name ||
      stop.place ||
      `Stop ${index + 1}`
    );
  };

  const buildTimelineItems = (record: TravelRecord) => {
    const stops = extractStops(record.route);
    if (!stops.length) {
      const singleRange =
        formatTime(record.started_at ?? null) &&
        formatTime(record.ended_at ?? null)
          ? `${formatTime(record.started_at)} - ${formatTime(record.ended_at)}`
          : null;

      return [
        {
          dot: (
            <EnvironmentOutlined style={{ fontSize: 16, color: "#1677ff" }} />
          ),
          children: (
            <Card
              size="small"
              style={{
                borderRadius: 8,
                border: "1px solid #f0f0f0",
                marginBottom: 12,
              }}
            >
              <Space direction="vertical" size={4}>
                <Text strong style={{ fontSize: 15 }}>
                  Route details unavailable
                </Text>
                {singleRange && (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {singleRange}
                  </Text>
                )}
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Distance: {record.distance_km ?? "—"} km
                </Text>
              </Space>
            </Card>
          ),
        },
      ];
    }

    return stops.map((stop, index) => {
      const timeRange = formatTimeRange(stop);
      const parking = formatParking(stop);

      return {
        dot: (
          <EnvironmentOutlined style={{ fontSize: 16, color: "#1677ff" }} />
        ),
        children: (
          <Card
            size="small"
            style={{
              borderRadius: 8,
              border: "1px solid #f0f0f0",
              marginBottom: 12,
            }}
          >
            <Space direction="vertical" size={4}>
              <Text strong style={{ fontSize: 15 }}>
                {getStopTitle(stop, index)}
              </Text>
              {timeRange && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {timeRange}
                </Text>
              )}
              {(() => {
                const distance =
                  stop.distance_km ??
                  stop.distanceKm ??
                  (typeof stop.distance === "number" ? stop.distance : null);
                if (
                  typeof distance === "number" &&
                  Number.isFinite(distance)
                ) {
                  return (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Distance: {distance} km
                    </Text>
                  );
                }
                if (typeof stop.distance === "string" && stop.distance.trim()) {
                  return (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Distance: {stop.distance}
                    </Text>
                  );
                }
                return null;
              })()}
              {parking && (
                <Tag
                  color="default"
                  icon={<ClockCircleOutlined />}
                  style={{ marginTop: 4 }}
                >
                  {parking}
                </Tag>
              )}
            </Space>
          </Card>
        ),
      };
    });
  };

  const isLoading = isLoadingExecutives || isLoadingRecords;

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Filters */}
      <Row gutter={16} style={{ marginBottom: 32 }}>
        <Col span={12}>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            Select Executive
          </Text>
          <Select
            showSearch
            placeholder="Select executive"
            value={selectedExecutiveId ?? undefined}
            onChange={(value) => setSelectedExecutiveId(Number(value))}
            style={{ width: "100%" }}
            size="large"
            loading={isLoadingExecutives}
            optionFilterProp="children"
            filterOption={(input, option) => {
              const label =
                typeof option?.children === "string"
                  ? option.children
                  : option?.children?.toString() ?? "";
              return label.toLowerCase().includes(input.toLowerCase());
            }}
          >
            {executives.map((exec) => (
              <Option key={exec.id} value={exec.id}>
                {exec.name}
              </Option>
            ))}
          </Select>
        </Col>
        <Col span={12}>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            Select Date
          </Text>
          <DatePicker
            style={{ width: "100%" }}
            value={selectedDate}
            onChange={(d) => {
              setSelectedDate(d ?? null);
            }}
            size="large"
            allowClear
            disabled={!selectedExecutiveId}
          />
        </Col>
      </Row>

      {error && (
        <Alert
          type="error"
          message="Something went wrong"
          description={error}
          style={{ marginBottom: 24 }}
          showIcon
        />
      )}

      {isLoading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: 240,
          }}
        >
          <Spin tip="Loading travel details..." size="large" />
        </div>
      ) : null}

      {!isLoading && selectedExecutiveId && !selectedDateRecords.length ? (
        <Card style={{ borderRadius: 8 }}>
          <Empty
            description={
              <span>
                {selectedDate
                  ? `No travel activity found for ${selectedDate.format(
                      "MMM DD, YYYY"
                    )}`
                  : "No travel activity found for this executive yet."}
              </span>
            }
          />
        </Card>
      ) : null}

      {/* Vehicle summary list with expandable timeline */}
      {!isLoading && selectedDateRecords.length > 0 ? (
        <Collapse
          bordered={false}
          expandIconPosition="end"
          expandIcon={({ isActive }) => (
            <DownOutlined rotate={isActive ? 180 : 0} />
          )}
          style={{ background: "transparent" }}
          activeKey={expandedKeys}
          onChange={(keys) => setExpandedKeys(keys as string[])}
        >
          {selectedDateRecords.map((record) => {
            const key = `${record.id}-${record.date}`;
            const dateLabel = dayjs(record.date).format("ddd, MMM DD, YYYY");
            const vehicleMeta = getVehicleMeta(record);
            return (
              <Panel
                header={
                  <div>
                    <Text
                      type="secondary"
                      style={{ display: "block", marginBottom: 8, fontSize: 14 }}
                    >
                      {dateLabel}
                    </Text>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 15 }}>{vehicleMeta.name}</Text>
                      <Button
                        icon={renderIcon(record.vehicle_type)}
                        style={{
                          background: "#001f54",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          marginRight: 40,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {vehicleMeta.number ?? vehicleMeta.typeLabel}
                      </Button>
                    </div>
                  </div>
                }
                key={key}
                style={{
                  marginBottom: 16,
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #f0f0f0",
                }}
              >
                <Card
                  style={{ marginTop: 8, border: "1px solid #f0f0f0" }}
                  title={
                    <span>
                      Vehicle: <b>{vehicleMeta.name}</b>{" "}
                      <Text type="secondary">
                        ({vehicleMeta.typeLabel}
                        {vehicleMeta.number ? ` • ${vehicleMeta.number}` : ""})
                      </Text>
                    </span>
                  }
                >
                  <Tabs defaultActiveKey="timeline">
                    <TabPane tab="Timeline" key="timeline">
                      <Timeline items={buildTimelineItems(record)} />
                    </TabPane>

                    <TabPane tab="Map" key="map">
                      <RouteMap
                        route={record.routeGeometry ?? record.route}
                        height={260}
                      />
                    </TabPane>
                  </Tabs>
                </Card>
              </Panel>
            );
          })}
        </Collapse>
      ) : null}
    </div>
  );
};

export default VehicleTimelinePage;
