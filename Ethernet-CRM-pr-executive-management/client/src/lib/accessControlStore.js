import { buildNoAccessControl } from '@/lib/accessControl';

const isPlainObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

const extractAccessMapsFromList = (source = {}) => {
  const pages = {};
  const functions = {};

  const pageList = Array.isArray(source.pages) ? source.pages : [];
  pageList.forEach((page) => {
    const pagePath = page?.pagePath || page?.page_path || page?.path || page?.page;
    if (!pagePath) return;
    pages[pagePath] = Boolean(page?.has_access ?? page?.hasAccess ?? page?.access ?? page?.enabled);

    const functionList = Array.isArray(page?.functions) ? page.functions : [];
    functionList.forEach((fn) => {
      const key = fn?.key || fn?.function_key || fn?.name;
      if (!key) return;
      functions[key] = Boolean(fn?.has_access ?? fn?.hasAccess ?? fn?.access ?? fn?.enabled);
    });
  });

  const functionList = Array.isArray(source.functions) ? source.functions : [];
  functionList.forEach((fn) => {
    const key = fn?.key || fn?.function_key || fn?.name;
    if (!key) return;
    functions[key] = Boolean(fn?.has_access ?? fn?.hasAccess ?? fn?.access ?? fn?.enabled);
  });

  return { pages, functions };
};

export const normalizeAccessControlMaps = (source = {}) => {
  const base = buildNoAccessControl();
  const pageMap = isPlainObject(source.page_map) ? source.page_map : null;
  const functionMap = isPlainObject(source.function_map) ? source.function_map : null;

  const legacyPages = isPlainObject(source.pages) ? source.pages : null;
  const legacyFunctions = isPlainObject(source.functions) ? source.functions : null;

  const extracted = extractAccessMapsFromList(source);
  const pages = pageMap || legacyPages || (Object.keys(extracted.pages).length ? extracted.pages : {});
  const functions = functionMap || legacyFunctions || (Object.keys(extracted.functions).length ? extracted.functions : {});

  return {
    pages: {
      ...base.pages,
      ...(pages || {}),
    },
    functions: {
      ...base.functions,
      ...(functions || {}),
    },
  };
};

export const resolveUserAccessControl = (user, accessControl) => {
  if (!user) return user;

  const inferredSource =
    accessControl ||
    user.access_control ||
    (user.page_map || user.function_map
      ? { page_map: user.page_map, function_map: user.function_map }
      : null);

  if (!inferredSource) return user;

  return {
    ...user,
    access_control: normalizeAccessControlMaps(inferredSource),
  };
};
