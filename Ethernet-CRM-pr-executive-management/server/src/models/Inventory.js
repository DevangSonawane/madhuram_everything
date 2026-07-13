import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Inventory = sequelize.define('Inventory', {
  inventory_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  brand: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  quantity: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: false,
  },
  current_quantity: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: true,
    defaultValue: null,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: false,
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  width: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: true,
  },
  height: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: true,
  },
  stockin: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  billing: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  source_dc_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  source_po_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  source_pr_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  source_sample_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
}, {
  tableName: 'inventories',
  timestamps: true,
  underscored: true,
});

export default Inventory;
