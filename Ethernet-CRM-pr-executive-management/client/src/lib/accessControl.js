import { MENU_CATEGORIES } from '@/constants/menuItems';
import { ACCESS_CONTROL_CATALOG, ACCESS_CONTROL_PAGE_PATHS } from '@/constants/accessControlCatalog';

export const ALWAYS_ALLOWED_PAGE_PATHS = ['/profile', '/settings'];

export const buildDefaultAccessControl = () => {
  const pages = {};
  const functions = {};

  ACCESS_CONTROL_CATALOG.forEach((page) => {
    pages[page.pagePath] = true;
    page.functions.forEach((fn) => {
      functions[fn.key] = true;
    });
  });

  return { pages, functions };
};

export const buildNoAccessControl = () => {
  const pages = {};
  const functions = {};

  ACCESS_CONTROL_CATALOG.forEach((page) => {
    pages[page.pagePath] = false;
    page.functions.forEach((fn) => {
      functions[fn.key] = false;
    });
  });

  return { pages, functions };
};

export const normalizeProjectRoutePath = (pathname = '') => {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return '/';
  }

  // Legacy routes -> new dedicated pages
  if (segments.length >= 2 && segments[1] === 'users') {
    return '/user-management';
  }

  const fullPath = `/${segments.join('/')}`;
  if (ACCESS_CONTROL_PAGE_PATHS.includes(fullPath)) {
    return fullPath;
  }

  if (segments.length > 1) {
    const twoSegmentPath = `/${segments.slice(0, 2).join('/')}`;
    if (ACCESS_CONTROL_PAGE_PATHS.includes(twoSegmentPath)) {
      return twoSegmentPath;
    }
  }

  if (segments.length > 2) {
    const secondThirdPath = `/${segments[1]}/${segments[2]}`;
    if (ACCESS_CONTROL_PAGE_PATHS.includes(secondThirdPath)) {
      return secondThirdPath;
    }
  }

  if (segments.length > 1) {
    const secondSegmentPath = `/${segments[1]}`;
    if (ACCESS_CONTROL_PAGE_PATHS.includes(secondSegmentPath)) {
      return secondSegmentPath;
    }
  }

  const firstSegmentPath = `/${segments[0]}`;
  if (ACCESS_CONTROL_PAGE_PATHS.includes(firstSegmentPath)) {
    return firstSegmentPath;
  }

  return '/';
};

export const hasPageAccess = (user, pagePath) => {
  if (!pagePath) return true;
  if (ALWAYS_ALLOWED_PAGE_PATHS.includes(pagePath)) return true;
  if (user?.role === 'admin') return true;

  const pages = user?.access_control?.pages;
  if (!pages || typeof pages !== 'object') return false;
  if (!Object.prototype.hasOwnProperty.call(pages, pagePath)) return false;
  return Boolean(pages[pagePath]);
};

export const hasFunctionAccess = (user, functionKey) => {
  if (!functionKey) return true;
  if (user?.role === 'admin') return true;

  const functions = user?.access_control?.functions;
  if (!functions || typeof functions !== 'object') return false;
  return Boolean(functions[functionKey]);
};

export const getAccessibleMenuCategories = (user) => {
  return MENU_CATEGORIES
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => !item.hidden && hasPageAccess(user, item.path)),
    }))
    .filter((category) => category.items.length > 0);
};
