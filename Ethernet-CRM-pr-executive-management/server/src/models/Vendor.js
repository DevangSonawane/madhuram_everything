import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { jsonTextField } from '../utils/jsonField.js';

const Vendor = sequelize.define('Vendor', {
  vendor_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  vendor_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  vendor_company_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  vendor_email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mobile_number: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'blocked'),
    allowNull: false,
    defaultValue: 'active',
  },
  price_list_ids: jsonTextField(DataTypes, 'price_list_ids', () => []),
}, {
  tableName: 'vendors',
  timestamps: true,
  underscored: true,
});

export default Vendor;
