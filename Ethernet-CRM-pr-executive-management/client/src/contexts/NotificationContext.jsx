import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './useAuth';
import { api } from '@/lib/api';
import NotificationContext from './notificationContextBase';

const getUserId = (user) => user?.user_id || user?.id || user?.uid || null;

const formatRelativeTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
};

const mapNotification = (n) => ({
  id: n.id,
  userId: n.user_id,
  title: `${n.entity_type ? n.entity_type.toUpperCase() : 'Update'} ${n.action || ''}`.trim(),
  message: n.message || `${n.entity_name || 'Entity'} was ${n.action || 'updated'}.`,
  time: formatRelativeTime(n.created_at),
  createdAt: n.created_at,
  isRead: Boolean(n.is_read),
  read: Boolean(n.is_read),
  entityType: n.entity_type,
  action: n.action,
});

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const userId = useMemo(() => getUserId(user), [user]);

  const fetchNotifications = async () => {
    if (!user?.token || !userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const [listResult, countResult] = await Promise.all([
        api.getNotifications({ userId, limit: 30, offset: 0 }),
        api.getUnreadNotificationCount(userId),
      ]);
      if (listResult.success && listResult.data?.success) {
        const mapped = (listResult.data.notifications || []).map(mapNotification);
        setNotifications(mapped);
      }
      if (countResult.success && countResult.data?.success) {
        setUnreadCount(Number(countResult.data.unread_count || 0));
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [user?.token, userId]);

  useEffect(() => {
    if (!user?.token) return undefined;
    const wsUrl = api.getDashboardSocketUrl({ userId, token: user?.token });
    if (!wsUrl) return undefined;

    const ws = new WebSocket(wsUrl);
    let heartbeat = null;

    ws.onopen = () => {
      heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'NEW_NOTIFICATION') {
          const next = mapNotification(msg.data);
          if (userId && String(next.userId) !== String(userId)) return;
          setNotifications((prev) => [next, ...prev.filter((item) => item.id !== next.id)]);
          setUnreadCount((prev) => prev + (next.isRead ? 0 : 1));
        }
      } catch (error) {
        console.error('Invalid WS notification payload:', error);
      }
    };

    return () => {
      if (heartbeat) clearInterval(heartbeat);
      ws.close();
    };
  }, [user?.token, userId]);

  const addNotification = (notification) => {
    const normalized = {
      id: notification.id || `local-${Date.now()}`,
      title: notification.title || 'Notification',
      message: notification.message || '',
      time: notification.time || 'Just now',
      createdAt: notification.createdAt || new Date().toISOString(),
      isRead: Boolean(notification.isRead || notification.read),
      read: Boolean(notification.isRead || notification.read),
    };
    setNotifications((prev) => [normalized, ...prev]);
    if (!normalized.isRead) {
      setUnreadCount((prev) => prev + 1);
    }
  };

  const markAsRead = async (id) => {
    let changed = false;
    setNotifications((prev) => prev.map((n) => {
      if (n.id !== id || n.isRead) return n;
      changed = true;
      return { ...n, isRead: true, read: true };
    }));
    if (changed) setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await api.markNotificationRead(id);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, read: true })));
    setUnreadCount(0);
    if (!userId) return;
    try {
      await api.markAllNotificationsRead(userId);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      fetchNotifications();
    }
  };

  const clearNotification = async (id) => {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    try {
      await api.deleteNotification(id);
    } catch (error) {
      console.error("Failed to delete notification:", error);
      fetchNotifications();
    }
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      loading, 
      unreadCount, 
      addNotification,
      markAsRead, 
      markAllAsRead,
      clearNotification 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
