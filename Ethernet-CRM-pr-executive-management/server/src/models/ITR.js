import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { jsonTextField } from '../utils/jsonField.js';

const ITR = sequelize.define('ITR', {
  itr_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  project_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  project_name: DataTypes.STRING,
  project_code: DataTypes.STRING,
  client_name: DataTypes.STRING,
  pmc_engineer: DataTypes.STRING,
  contractor: DataTypes.STRING,
  vendor_code: DataTypes.STRING,
  material_code: DataTypes.STRING,
  itr_ref_no: DataTypes.STRING,
  wir_itr_submission_date_time: DataTypes.STRING,
  inspection_date_time: DataTypes.STRING,
  submitted_to: DataTypes.STRING,
  submitted_by: DataTypes.STRING,
  source: DataTypes.STRING,
  source_file_name: DataTypes.STRING,
  result_code: DataTypes.STRING,
  itr_submited: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  contractor_part: jsonTextField(DataTypes, 'contractor_part', () => ({})),
  lodha_pmc: jsonTextField(DataTypes, 'lodha_pmc', () => ({})),
  dynamic_field: jsonTextField(DataTypes, 'dynamic_field', () => []),
}, {
  tableName: 'itrs',
  timestamps: true,
  underscored: true,
});

export default ITR;
