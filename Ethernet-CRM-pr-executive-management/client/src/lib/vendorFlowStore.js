const STORAGE_KEY = 'ethernet_crm_vendor_flow_v1';

const DEFAULT_STATE = {
  vendors: [],
  priceLists: [],
};

const nowIso = () => new Date().toISOString();

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
};

const readState = () => {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_STATE };
  const parsed = safeParse(raw, DEFAULT_STATE);
  return {
    vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
    priceLists: Array.isArray(parsed.priceLists) ? parsed.priceLists : [],
  };
};

const writeState = (state) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const nextId = (items, key) => {
  const max = items.reduce((acc, item) => {
    const value = Number(item?.[key]);
    return Number.isFinite(value) && value > acc ? value : acc;
  }, 0);
  return max + 1;
};

const sortByNewest = (items, key = 'updated_at') => {
  return [...items].sort((a, b) => {
    const aTime = new Date(a?.[key] || 0).getTime();
    const bTime = new Date(b?.[key] || 0).getTime();
    return bTime - aTime;
  });
};

export const vendorFlowStore = {
  listVendors() {
    const state = readState();
    return sortByNewest(state.vendors, 'updated_at');
  },

  getVendorById(vendorId) {
    const state = readState();
    return state.vendors.find((vendor) => String(vendor.vendor_id) === String(vendorId)) || null;
  },

  createVendor(data) {
    const state = readState();
    const timestamp = nowIso();
    const vendor = {
      vendor_id: nextId(state.vendors, 'vendor_id'),
      vendor_name: data.vendor_name || '',
      vendor_company_name: data.vendor_company_name || '',
      vendor_email: data.vendor_email || '',
      mobile_number: data.mobile_number || '',
      location: data.location || '',
      status: data.status || 'active',
      created_at: timestamp,
      updated_at: timestamp,
    };

    state.vendors = [vendor, ...state.vendors];
    writeState(state);
    return vendor;
  },

  updateVendor(vendorId, data) {
    const state = readState();
    const idx = state.vendors.findIndex((vendor) => String(vendor.vendor_id) === String(vendorId));
    if (idx < 0) return null;

    const current = state.vendors[idx];
    const updated = {
      ...current,
      ...data,
      updated_at: nowIso(),
    };

    state.vendors[idx] = updated;
    writeState(state);
    return updated;
  },

  deleteVendor(vendorId) {
    const state = readState();
    const before = state.vendors.length;

    state.vendors = state.vendors.filter((vendor) => String(vendor.vendor_id) !== String(vendorId));
    state.priceLists = state.priceLists.filter((priceList) => String(priceList.vendor_id) !== String(vendorId));

    writeState(state);
    return state.vendors.length !== before;
  },

  listPriceLists(vendorId) {
    const state = readState();
    const rows = state.priceLists.filter((priceList) => String(priceList.vendor_id) === String(vendorId));
    return sortByNewest(rows, 'updated_at');
  },

  getPriceListById(vendorId, priceListId) {
    const state = readState();
    return (
      state.priceLists.find(
        (priceList) =>
          String(priceList.vendor_id) === String(vendorId) &&
          String(priceList.price_list_id) === String(priceListId)
      ) || null
    );
  },

  updatePriceList(priceListId, data) {
    const state = readState();
    const idx = state.priceLists.findIndex((priceList) => String(priceList.price_list_id) === String(priceListId));
    if (idx < 0) return null;
    const updated = {
      ...state.priceLists[idx],
      ...data,
      updated_at: nowIso(),
    };
    state.priceLists[idx] = updated;
    writeState(state);
    return updated;
  },

  deletePriceList(priceListId) {
    const state = readState();
    const before = state.priceLists.length;
    state.priceLists = state.priceLists.filter((priceList) => String(priceList.price_list_id) !== String(priceListId));
    writeState(state);
    return state.priceLists.length !== before;
  },

  getLatestPriceList(vendorId) {
    const lists = this.listPriceLists(vendorId);
    return lists[0] || null;
  },

  createPriceList(vendorId, payload) {
    const state = readState();
    const timestamp = nowIso();
    const items = Array.isArray(payload.items) ? payload.items : [];

    const normalizedItems = items
      .map((item) => ({
        items_name: String(item.items_name || item.material || '').trim(),
        hsn_code: String(item.hsn_code || '').trim(),
        item_code: String(item.item_code || '').trim(),
        category: String(item.category || '').trim(),
        product_name: String(item.product_name || '').trim(),
        size_inch: String(item.size_inch || item.SIZE_INCH || '').trim(),
        size_mm: String(item.size_mm || item.SIZE_MM || '').trim(),
        price_per_pic: Number(item.price_per_pic ?? item.rate ?? item['price_per-pic']) || 0,
        discount_price: Number(item.discount_price ?? item.discountprice) || 0,
        net_price: Number(item.net_price) || 0,
      }))
      .filter((item) => item.items_name);

    const priceList = {
      price_list_id: nextId(state.priceLists, 'price_list_id'),
      vendor_id: Number(vendorId),
      version_name: String(payload.version_name || payload.title || '').trim() || `Price List ${new Date().toLocaleDateString()}`,
      status: String(payload.status || 'active'),
      file_path: payload.file_path || null,
      items: normalizedItems,
      created_at: timestamp,
      updated_at: timestamp,
    };

    state.priceLists = [priceList, ...state.priceLists];
    writeState(state);
    return priceList;
  },
};
