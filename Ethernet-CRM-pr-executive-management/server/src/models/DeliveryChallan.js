import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const DeliveryChallan = sequelize.define('DeliveryChallan', {
  dc_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  po_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  po_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  challan_number: {
    type: DataTypes.STRING,
    allowNull: false
  },
  items: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('items');
      try {
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },
    set(value) {
      if (value == null) {
        this.setDataValue('items', null);
        return;
      }
      const items = typeof value === 'string' ? value : JSON.stringify(value);
      this.setDataValue('items', items);
    }
  },
  challan_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  work_order_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  order_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  total_po_items: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  total_challan_items: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'incomplete'
  }
}, {
  tableName: 'delivery_challans',
  timestamps: true,
  underscored: true
});

export default DeliveryChallan;
