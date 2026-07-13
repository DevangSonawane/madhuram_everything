import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import sequelize from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import poRoutes from './routes/poRoutes.js';
import dcRoutes from './routes/dcRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import boqRoutes from './routes/boqRoutes.js';
import mirRoutes from './routes/mirRoutes.js';
import itrRoutes from './routes/itrRoutes.js';
import sampleRoutes from './routes/sampleRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import vendorPriceListRoutes from './routes/vendorPriceListRoutes.js';
import prRoutes from './routes/prRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
// Base URL in doc is https://api.madhuram.enterprises
// Endpoints are /api/auth/...
app.use('/api/auth', authRoutes);
app.use('/api/po', poRoutes);
app.use('/api/dc', dcRoutes);
app.use('/api', projectRoutes);
app.use('/api/boq', boqRoutes);
app.use('/api/mir', mirRoutes);
app.use('/api/itr', itrRoutes);
app.use('/api/sample', sampleRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/vendor-price-list', vendorPriceListRoutes);
app.use('/api/pr', prRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const ensureUserRoleEnum = async () => {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'app_users'
       AND COLUMN_NAME = 'role'
     LIMIT 1`
  );

  const columnType = rows?.[0]?.COLUMN_TYPE || '';
  if (!columnType) return;
  const targetEnum = "enum('admin','operational_manager','po_officer','labour')";
  const normalizedType = String(columnType).toLowerCase().replace(/\s+/g, '');
  if (normalizedType === targetEnum) return;

  // Migrate legacy role value before shrinking enum.
  await sequelize.query(
    `UPDATE app_users SET role = 'operational_manager' WHERE role = 'itr_staff'`
  );

  await sequelize.query(
    `ALTER TABLE app_users
     MODIFY COLUMN role ENUM('admin', 'operational_manager', 'po_officer', 'labour') NOT NULL`
  );
  console.log('✅ Updated app_users.role enum and migrated legacy itr_staff to operational_manager.');
};

// Database Sync and Server Start
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected.');

    await ensureUserRoleEnum();
    
    // Sync models (alter: true updates schema if needed, force: false preserves data)
    // Using alter to ensure new columns like project_list and username are added
    await sequelize.sync({ alter: true });
    console.log('✅ Database synced.');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server start error:', error);
  }
};

startServer();
