import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { hasPageAccess, normalizeProjectRoutePath } from '@/lib/accessControl';
import { AppLoader } from '@/components/ui/loader';
import { Button } from '@/components/ui/button';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to the login page (root path), but save the current location they were trying to go to
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (user && user.role !== 'admin' && !user.access_control) {
    return <AppLoader fullscreen label="Loading access permissions..." />;
  }

  const pagePath = normalizeProjectRoutePath(location.pathname);
  if (!hasPageAccess(user, pagePath)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md text-center space-y-2">
          <p className="text-2xl font-semibold text-destructive">Please contact admin to get access</p>
          <p className="text-sm text-muted-foreground">You do not have permission to open this page.</p>
          <div className="pt-4 flex justify-center">
            <Button variant="outline" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};
