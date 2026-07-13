import fs from 'fs/promises';
import path from 'path';
import sequelize from '../config/database.js';
import Vendor from '../models/Vendor.js';
import VendorPriceList from '../models/VendorPriceList.js';
import VendorPriceListItem from '../models/VendorPriceListItem.js';

const ALLOWED_STATUS = new Set(['active', 'inactive', 'archived']);

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const toNum = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeStatus = (status, fallback = 'active') => {
  const normalized = String(status || fallback).trim() || fallback;
  return ALLOWED_STATUS.has(normalized) ? normalized : null;
};

const normalizeFilePath = (body = {}) => {
  const filePath = String(body.file_path || '').trim();
  if (filePath) return filePath;

  const filename = String(body.filename || '').trim();
  if (!filename) return null;
  if (filename.startsWith('/uploads/')) return filename;
  return `/uploads/price_lists/${filename}`;
};

const mapItem = (raw = {}) => ({
  items_name: raw.items_name ?? null,
  hsn_code: raw.hsn_code ?? null,
  item_code: raw.item_code ?? null,
  category: raw.category ?? null,
  product_name: raw.product_name ?? null,
  size_inch: raw.SIZE_INCH ?? raw.size_inch ?? null,
  size_mm: raw.SIZE_MM ?? raw.size_mm ?? null,
  price_per_pic: toNum(raw['price_per-pic'] ?? raw.price_per_pic),
  discount_price: toNum(raw.discountprice ?? raw.discount_price),
  net_price: toNum(raw.net_price),
});

const mapItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => mapItem(item));
};

const bulkInsertItems = async (items, transaction) => {
  if (!Array.isArray(items) || items.length === 0) return;

  const batchSize = 1000;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await VendorPriceListItem.bulkCreate(batch, { transaction });
  }
};

const parsePriceListIdArray = (value) => {
  if (Array.isArray(value)) return value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  } catch {
    return [];
  }
};

const appendPriceListIdToVendor = async (vendorId, priceListId, transaction) => {
  const vendor = await Vendor.findByPk(vendorId, { transaction });
  if (!vendor) return;

  const ids = parsePriceListIdArray(vendor.price_list_ids);
  if (!ids.includes(priceListId)) ids.push(priceListId);

  await vendor.update({ price_list_ids: ids }, { transaction });
};

const removePriceListIdFromVendor = async (vendorId, priceListId, transaction) => {
  const vendor = await Vendor.findByPk(vendorId, { transaction });
  if (!vendor) return;

  const ids = parsePriceListIdArray(vendor.price_list_ids).filter((id) => id !== priceListId);
  await vendor.update({ price_list_ids: ids }, { transaction });
};

const safeUnlinkUploadedFile = async (filePath) => {
  if (!filePath || typeof filePath !== 'string') return;
  if (!filePath.startsWith('/uploads/')) return;

  const relativePath = filePath.replace(/^\//, '');
  const absolutePath = path.join(process.cwd(), relativePath);

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn('Could not remove file from disk:', absolutePath, error?.message || error);
    }
  }
};

export const uploadPriceListFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filename = req.file.filename;
  return res.status(200).json({
    success: true,
    filename,
    filePath: `/uploads/price_lists/${filename}`,
  });
};

export const getVendorPriceLists = async (req, res) => {
  try {
    const vendorId = toInt(req.params.vendorId);
    if (vendorId == null) return res.status(400).json({ error: 'Invalid vendorId' });

    const rows = await VendorPriceList.findAll({
      where: { vendor_id: vendorId },
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json(rows);
  } catch (error) {
    console.error('Get vendor price lists error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getVendorPriceListById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (id == null) return res.status(400).json({ error: 'Invalid id' });

    const row = await VendorPriceList.findByPk(id);
    if (!row) return res.status(404).json({ error: 'Price list not found' });

    const items = await VendorPriceListItem.findAll({
      where: { price_list_id: id },
      order: [['item_id', 'ASC']],
    });

    return res.status(200).json({ ...row.toJSON(), items });
  } catch (error) {
    console.error('Get one vendor price list error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createVendorPriceList = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const vendorId = toInt(req.body.vendor_id);
    if (vendorId == null) {
      await transaction.rollback();
      return res.status(400).json({ error: 'vendor_id is required' });
    }

    const vendor = await Vendor.findByPk(vendorId, { transaction });
    if (!vendor) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const status = normalizeStatus(req.body.status, 'active');
    if (!status) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid status. Allowed values are: active, inactive, archived' });
    }

    const priceList = await VendorPriceList.create({
      vendor_id: vendorId,
      version_name: req.body.version_name || null,
      status,
      file_path: normalizeFilePath(req.body),
    }, { transaction });

    const mappedItems = mapItems(req.body.items).map((item) => ({ ...item, price_list_id: priceList.price_list_id }));
    await bulkInsertItems(mappedItems, transaction);

    await appendPriceListIdToVendor(vendorId, priceList.price_list_id, transaction);

    await transaction.commit();

    return res.status(201).json({
      message: 'Price list created successfully',
      price_list: priceList,
      items_count: mappedItems.length,
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Create vendor price list error:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
};

export const updateVendorPriceList = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const id = toInt(req.params.id);
    if (id == null) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid id' });
    }

    const row = await VendorPriceList.findByPk(id, { transaction });
    if (!row) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Price list not found' });
    }

    const updates = {};
    if (req.body.version_name !== undefined) updates.version_name = req.body.version_name || null;
    if (req.body.status !== undefined) {
      const status = normalizeStatus(req.body.status, 'active');
      if (!status) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Invalid status. Allowed values are: active, inactive, archived' });
      }
      updates.status = status;
    }
    if (req.body.filename !== undefined || req.body.file_path !== undefined) {
      updates.file_path = normalizeFilePath(req.body);
    }

    if (Object.keys(updates).length > 0) {
      await row.update(updates, { transaction });
    }

    if (Array.isArray(req.body.items)) {
      await VendorPriceListItem.destroy({ where: { price_list_id: id }, transaction });
      const mappedItems = mapItems(req.body.items).map((item) => ({ ...item, price_list_id: id }));
      await bulkInsertItems(mappedItems, transaction);
    }

    await transaction.commit();

    return res.status(200).json({
      message: 'Price list updated successfully',
      price_list: row,
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Update vendor price list error:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
};

export const deleteVendorPriceList = async (req, res) => {
  const transaction = await sequelize.transaction();
  let filePathToDelete = null;

  try {
    const id = toInt(req.params.id);
    if (id == null) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid id' });
    }

    const row = await VendorPriceList.findByPk(id, { transaction });
    if (!row) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Price list not found' });
    }

    filePathToDelete = row.file_path;

    await VendorPriceListItem.destroy({ where: { price_list_id: id }, transaction });
    await row.destroy({ transaction });
    await removePriceListIdFromVendor(row.vendor_id, id, transaction);

    await transaction.commit();
    await safeUnlinkUploadedFile(filePathToDelete);

    return res.status(200).json({ message: 'Price list deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('Delete vendor price list error:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
};

export const updateVendorPriceListStatus = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (id == null) return res.status(400).json({ error: 'Invalid id' });

    const status = normalizeStatus(req.body?.status);
    if (!status) {
      return res.status(400).json({ error: 'Invalid status. Allowed values are: active, inactive, archived' });
    }

    const row = await VendorPriceList.findByPk(id);
    if (!row) return res.status(404).json({ error: 'Price list not found' });

    await row.update({ status });

    return res.status(200).json({
      message: 'Status updated successfully',
      price_list: row,
    });
  } catch (error) {
    console.error('Update vendor price list status error:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
};
