import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const BOQ = sequelize.define('BOQ', {
  boq_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  item_no: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  item_code: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  floor: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  quantity: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: true,
  },
  rate: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: true,
  },
  amount: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: true,
  },
  boq_file: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'boqs',
  timestamps: true,
  underscored: true,
});

export default BOQ;
