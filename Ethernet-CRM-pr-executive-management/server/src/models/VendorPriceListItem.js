import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const VendorPriceListItem = sequelize.define('VendorPriceListItem', {
  item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  price_list_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  items_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  hsn_code: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  item_code: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  product_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  size_inch: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  size_mm: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  price_per_pic: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: true,
  },
  discount_price: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: true,
  },
  net_price: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: true,
  },
}, {
  tableName: 'vendor_price_list_items',
  timestamps: false,
  underscored: true,
});

export default VendorPriceListItem;
