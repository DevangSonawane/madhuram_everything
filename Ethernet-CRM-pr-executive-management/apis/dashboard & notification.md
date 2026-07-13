📘 Madhuram API Documentation – Dashboard Module
Overview
The Dashboard API in Madhuram provides:
Stats
Overall dashboard totals
Project-wise stats
User-wise stats
Activity Log
Fetch activity logs with filters
Delete activity entries
Notifications
Get user notifications
Get unread count
Mark one as read
Mark all as read
Delete notification
WebSocket
Live activity feed
Live notification feed

Base URL
REST Base
/api/dashboard

WebSocket URL
ws://your-server/ws/activity

Example:
ws://localhost:5000/ws/activity

or in production:
wss://yourdomain.com/ws/activity


1) Dashboard Stats API
Endpoint
GET /api/dashboard/stats
Fetch dashboard stats in 3 modes:
overall
by project
by user

Query Parameters
Param
Type
Required
Description
project_id
string
❌
Get stats for a specific project
user_id
string
❌
Get stats for a specific user

If both are omitted, overall stats are returned.

A. Overall Stats
Request
GET /api/dashboard/stats

Response
{
  "success": true,
  "stats": {
    "mode": "overall",
    "vendors": { "total": 10, "last_30_days": 2 },
    "pos": { "total": 15, "last_30_days": 5 },
    "samples": { "total": 6, "last_30_days": 1 },
    "mirs": { "total": 8, "last_30_days": 3 },
    "itrs": { "total": 7, "last_30_days": 2 },
    "users": { "total": 12 }
  }
}


B. Project-wise Stats
Request
GET /api/dashboard/stats?project_id=10

Response
{
  "success": true,
  "stats": {
    "mode": "project",
    "project_id": "10",
    "vendors": { "total": 4, "last_30_days": 1 },
    "pos": { "total": 7, "last_30_days": 2 },
    "samples": { "total": 2, "last_30_days": 1 },
    "mirs": { "total": 3, "last_30_days": 1 },
    "itrs": { "total": 1, "last_30_days": 0 }
  }
}


C. User-wise Stats
Request
GET /api/dashboard/stats?user_id=abc123

Response
{
  "success": true,
  "stats": {
    "mode": "user",
    "user_id": "abc123",
    "vendors": 2,
    "pos": 5,
    "samples": 1,
    "mirs": 3,
    "itrs": 1,
    "activity_last_30_days": 12
  }
}


2) Activity Log API
Endpoint
GET /api/dashboard/activity
Fetch activity logs with pagination and filters.

Query Parameters
Param
Type
Required
Description
user_id
string
❌
Filter by user
project_id
string
❌
Filter by project
entity_type
string
❌
Filter by entity type
action
string
❌
Filter by action
limit
integer
❌
Default 20, max 100
offset
integer
❌
Default 0

Allowed entity_type
vendor
po
sample
mir
itr
project
user
Allowed action
created
updated
deleted

Example Requests
All activities
GET /api/dashboard/activity

By user
GET /api/dashboard/activity?user_id=abc123

By project
GET /api/dashboard/activity?project_id=10

With filters + pagination
GET /api/dashboard/activity?project_id=10&entity_type=po&action=created&limit=10&offset=0


Response
{
  "success": true,
  "total": 55,
  "limit": 20,
  "offset": 0,
  "activities": [
    {
      "id": 1,
      "action": "created",
      "entity_type": "po",
      "entity_id": 45,
      "entity_name": "PO-2026-001",
      "performed_by": "abc123",
      "performed_by_name": "John Doe",
      "project_id": 10,
      "meta": {
        "project_id": 10
      },
      "created_at": "2026-03-01T10:20:00.000Z"
    }
  ]
}


Delete Activity Log
DELETE /api/dashboard/activity/{id}
Request
DELETE /api/dashboard/activity/12

Response
{
  "success": true,
  "message": "Activity deleted"
}


3) Notifications API

Get Notifications
GET /api/dashboard/notifications
Fetch notifications for a user.
Query Parameters
Param
Type
Required
Description
user_id
string
✅
User ID
is_read
boolean
❌
true = read only, false = unread only
limit
integer
❌
Default 20, max 100
offset
integer
❌
Default 0


Example Requests
All notifications
GET /api/dashboard/notifications?user_id=abc123

Only unread
GET /api/dashboard/notifications?user_id=abc123&is_read=false

Only read
GET /api/dashboard/notifications?user_id=abc123&is_read=true


Response
{
  "success": true,
  "total": 12,
  "unread_count": 4,
  "limit": 20,
  "offset": 0,
  "notifications": [
    {
      "id": 1,
      "user_id": "abc123",
      "user_name": "John Doe",
      "action": "created",
      "entity_type": "po",
      "entity_id": 45,
      "entity_name": "PO-2026-001",
      "project_id": 10,
      "message": "Purchase Order \"PO-2026-001\" was created successfully.",
      "is_read": false,
      "meta": {
        "project_id": 10
      },
      "created_at": "2026-03-01T10:30:00.000Z"
    }
  ]
}


Get Unread Count
GET /api/dashboard/notifications/unread-count
Query Parameters
Param
Type
Required
user_id
string
✅

Request
GET /api/dashboard/notifications/unread-count?user_id=abc123

Response
{
  "success": true,
  "unread_count": 4
}


Mark One Notification as Read
PUT /api/dashboard/notifications/{id}/read
Request
PUT /api/dashboard/notifications/5/read

Response
{
  "success": true,
  "notification": {
    "id": 5,
    "is_read": true,
    "read_at": "2026-03-01T11:00:00.000Z"
  }
}

Error if not found
{
  "success": false,
  "error": "Not found"
}


Mark All Notifications as Read
PUT /api/dashboard/notifications/read-all?user_id=abc123
Response
{
  "success": true,
  "updated_count": 4
}


Delete Notification
DELETE /api/dashboard/notifications/{id}
Request
DELETE /api/dashboard/notifications/5

Response
{
  "success": true,
  "message": "Notification deleted"
}


4) WebSocket Integration
WebSocket URL
ws://your-server/ws/activity

Example:
ws://localhost:5000/ws/activity

Production:
wss://yourdomain.com/ws/activity


What frontend receives over WebSocket
The backend sends these events:
1. INITIAL_ACTIVITIES
Sent immediately when socket connects.
{
  "type": "INITIAL_ACTIVITIES",
  "data": [
    {
      "id": 1,
      "action": "created",
      "entity_type": "po",
      "entity_name": "PO-001"
    }
  ]
}


2. NEW_ACTIVITY
Sent whenever any activity is logged.
{
  "type": "NEW_ACTIVITY",
  "data": {
    "id": 12,
    "action": "updated",
    "entity_type": "sample",
    "entity_name": "Sample A",
    "performed_by": "abc123",
    "performed_by_name": "John Doe",
    "project_id": 10,
    "meta": {
      "project_id": 10
    },
    "created_at": "2026-03-01T11:20:00.000Z"
  }
}


3. NEW_NOTIFICATION
Sent whenever a notification is created.
{
  "type": "NEW_NOTIFICATION",
  "data": {
    "id": 21,
    "user_id": "abc123",
    "message": "Purchase Order \"PO-001\" was updated successfully.",
    "is_read": false,
    "created_at": "2026-03-01T11:21:00.000Z"
  }
}


4. pong
If frontend sends:
{ "type": "ping" }

Backend responds:
{ "type": "pong" }


5) Frontend WebSocket Usage Guide
Basic connection example
const ws = new WebSocket("ws://localhost:5000/ws/activity");

ws.onopen = () => {
  console.log("WebSocket connected");
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log("WS message:", message);

  switch (message.type) {
    case "INITIAL_ACTIVITIES":
      // load initial activity timeline
      setActivities(message.data);
      break;

    case "NEW_ACTIVITY":
      // prepend latest activity to activity list
      setActivities((prev) => [message.data, ...prev]);
      break;

    case "NEW_NOTIFICATION":
      // prepend notification and increment unread badge
      setNotifications((prev) => [message.data, ...prev]);
      setUnreadCount((prev) => prev + 1);
      break;

    case "pong":
      console.log("Heartbeat received");
      break;

    default:
      break;
  }
};

ws.onclose = () => {
  console.log("WebSocket disconnected");
};

ws.onerror = (error) => {
  console.error("WebSocket error", error);
};


Heartbeat / keep-alive
To keep the connection alive:
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "ping" }));
  }
}, 30000);


React example
import { useEffect, useRef, useState } from "react";

export default function useDashboardSocket() {
  const wsRef = useRef(null);
  const [activities, setActivities] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:5000/ws/activity");
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "INITIAL_ACTIVITIES") {
        setActivities(msg.data);
      }

      if (msg.type === "NEW_ACTIVITY") {
        setActivities((prev) => [msg.data, ...prev]);
      }

      if (msg.type === "NEW_NOTIFICATION") {
        setNotifications((prev) => [msg.data, ...prev]);
        setUnreadCount((prev) => prev + 1);
      }
    };

    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  return {
    activities,
    notifications,
    unreadCount,
    setUnreadCount
  };
}


6) Recommended Frontend Flow
Dashboard page
On page load:
Call:
GET /api/dashboard/stats
GET /api/dashboard/activity
GET /api/dashboard/notifications?user_id=...
GET /api/dashboard/notifications/unread-count?user_id=...
Open WebSocket connection to /ws/activity
Update UI in real time when:
NEW_ACTIVITY arrives
NEW_NOTIFICATION arrives

Notifications panel
Load notifications using REST first
Keep them fresh via WebSocket
On click:
call PUT /api/dashboard/notifications/:id/read
On “Mark all read”:
call PUT /api/dashboard/notifications/read-all?user_id=...
On delete:
call DELETE /api/dashboard/notifications/:id

Activity feed
Load paginated activity via REST
Append/prepend live entries from WebSocket
Use filters through query params:
user_id
project_id
entity_type
action

7) Notes for Frontend Developer
success: true/false is used in most dashboard endpoints.
WebSocket currently broadcasts to all connected clients.
Frontend should filter notifications by user_id if needed.
Notifications are created automatically inside logActivity() when an action is performed.
Initial WebSocket event only sends last 10 activities, not notifications.
For notification badge count, use:
REST: /notifications/unread-count
then update live from NEW_NOTIFICATION

8) Quick Endpoint List
Stats
GET /api/dashboard/stats
GET /api/dashboard/stats?project_id=X
GET /api/dashboard/stats?user_id=X
Activity
GET /api/dashboard/activity
GET /api/dashboard/activity?user_id=X
GET /api/dashboard/activity?project_id=X
DELETE /api/dashboard/activity/:id
Notifications
GET /api/dashboard/notifications?user_id=X
GET /api/dashboard/notifications/unread-count?user_id=X
PUT /api/dashboard/notifications/:id/read
PUT /api/dashboard/notifications/read-all?user_id=X
DELETE /api/dashboard/notifications/:id
WebSocket
ws://your-server/ws/activity
