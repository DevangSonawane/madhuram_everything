# Express.js + MySQL + Sequelize Boilerplate

A production-ready boilerplate for building RESTful APIs with Express.js, MySQL, and Sequelize ORM using ES6 modules.

## Features

- ✅ Express.js with ES6 import/export
- ✅ MySQL database with Sequelize ORM
- ✅ JWT authentication & authorization
- ✅ Password hashing with bcryptjs
- ✅ Input validation with express-validator
- ✅ Error handling middleware
- ✅ CORS and Helmet security
- ✅ Environment variable configuration
- ✅ RESTful API structure
- ✅ User CRUD operations example

## Project Structure

```
├── src/
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   └── userController.js    # User CRUD logic
│   ├── middleware/
│   │   ├── auth.js              # Authentication & authorization
│   │   ├── errorHandler.js      # Error handling
│   │   └── validator.js         # Validation middleware
│   ├── models/
│   │   ├── User.js              # User model
│   │   └── index.js             # Models index
│   ├── routes/
│   │   ├── authRoutes.js        # Auth routes
│   │   ├── userRoutes.js        # User routes
│   │   └── index.js             # Routes index
│   ├── app.js                   # Express app setup
│   └── server.js                # Server entry point
├── .env.example                 # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## Installation

1. **Clone or create the project directory:** 

2. **Initialize npm and install dependencies:**
   ```bash
   npm init -y
   npm install express sequelize mysql2 dotenv cors helmet express-validator bcryptjs jsonwebtoken
   npm install --save-dev nodemon
   ```

3. **Create the folder structure:**
   ```bash
   mkdir -p src/{config,controllers,middleware,models,routes}
   ```

4. **Copy all the provided files to their respective locations**

5. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your database credentials and JWT secret.

6. **Create MySQL database:**
   ```sql
   CREATE DATABASE your_database_name;
   ```

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development

DB_HOST=sql12.freesqldatabase.com
DB_PORT=3306
DB_NAME=sql12802617
DB_USER=sql12802617
DB_PASSWORD=icVrDqtJTJ

JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:3000
```

## Running the Application

**Development mode (with nodemon):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

### Binding to LAN / Android / Emulator

- The server now binds to `HOST=0.0.0.0` by default, so a single process serves:
  - `http://localhost:3000` (web/desktop)
  - `http://10.0.2.2:3000` (Android emulator loopback)
  - `http://<your-LAN-IP>:3000` (physical devices on the same Wi‑Fi)
- Use the `HOST` env var if you need to force a specific interface:

```bash
HOST=127.0.0.1 PORT=3000 npm start
```

During startup the console logs every reachable base URL so you can copy/paste the one you need into the Flutter `ApiConfig.overrideBaseUrl`.

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/profile` - Get current user profile (protected)

### Users (Admin only)
- `GET /api/v1/users` - Get all users (admin only)
- `GET /api/v1/users/:id` - Get user by ID
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user (admin only)

### Health Check
- `GET /api/v1/health` - Check server health
- `GET /` - API welcome message

## API Usage Examples

### Register a new user
```bash
curl -X POST http://localhost: