import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { jsonTextField } from '../utils/jsonField.js';

const Project = sequelize.define('Project', {
  project_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  project_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  project_startdate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  product_duration: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  client_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  floor: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  estimate_value: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  wo_number: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  work_order_file: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  work_order_information: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  pr_po_tracking: jsonTextField(DataTypes, 'pr_po_tracking', () => []),
  samples: jsonTextField(DataTypes, 'samples', () => []),
  mas_file: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ml_management: jsonTextField(DataTypes, 'ml_management', () => ({ ml_task: '' })),
  user_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'projects',
  timestamps: true,
  underscored: true,
});

export default Project;
