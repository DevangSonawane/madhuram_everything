import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PurchaseOrder = sequelize.define('PurchaseOrder', {
  po_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sample_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  company_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  company_subtitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  company_email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  company_gst: {
    type: DataTypes.STRING,
    allowNull: true
  },
  indent_no: {
    type: DataTypes.STRING,
    allowNull: true
  },
  indent_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  order_no: {
    type: DataTypes.STRING,
    allowNull: true
  },
  po_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  vendor_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  site: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contact_person: {
    type: DataTypes.STRING,
    allowNull: true
  },
  vendor_address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  primary_contact_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  primary_contact_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  secondary_contact_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  secondary_contact_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  items: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('items');
      try {
        return raw ? JSON.parse(raw) : [];
      } catch (err) {
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
  discount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0
  },
  discount_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0
  },
  after_discount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0
  },
  cgst: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    defaultValue: 0
  },
  cgst_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0
  },
  sgst: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
    defaultValue: 0
  },
  sgst_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    defaultValue: 0
  },
  total_amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: true,
    defaultValue: 0
  },
  delivery: {
    type: DataTypes.STRING,
    allowNull: true
  },
  payment: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'created'
  }
}, {
  tableName: 'pos',
  timestamps: true,
  underscored: true
});

export default PurchaseOrder;
