import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const VendorPriceList = sequelize.define('VendorPriceList', {
  price_list_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  version_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'archived'),
    allowNull: false,
    defaultValue: 'active',
  },
  file_path: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'vendor_price_lists',
  timestamps: true,
  underscored: true,
});

export default VendorPriceList;
