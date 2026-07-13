import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { jsonTextField } from '../utils/jsonField.js';

const MIR = sequelize.define('MIR', {
  mir_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  project_name: DataTypes.STRING,
  project_code: DataTypes.STRING,
  client_name: DataTypes.STRING,
  pmc: DataTypes.STRING,
  contractor: DataTypes.STRING,
  vendor_code: DataTypes.STRING,
  challan_no: DataTypes.STRING,
  mir_refrence_no: DataTypes.STRING,
  material_code: DataTypes.STRING,
  inspection_date_time: DataTypes.STRING,
  client_submission_date: DataTypes.STRING,
  refrence_docs_attached: DataTypes.STRING,
  mir_submited: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  dynamic_field: jsonTextField(DataTypes, 'dynamic_field', () => []),
  po_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  items: jsonTextField(DataTypes, 'items', () => []),
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'mirs',
  timestamps: true,
  underscored: true,
});

export default MIR;
