# Production Environment Variables

Create a `.env` file in the server root directory with the following variables:

```env
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Database Configuration
DB_HOST=your_database_host
DB_PORT=3306
DB_NAME=your_database_name
DB_USER=your_db_user
DB_PASSWORD=your_secure_db_password

# JWT Configuration - CHANGE THESE IN PRODUCTION!
JWT_SECRET=your_super_secret_jwt_key_min_32_characters_long
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_characters_long
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# CORS Configuration (comma-separated for multiple origins)
CORS_ORIGIN=https://your-production-domain.com,https://www.your-production-domain.com

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
SMTP_FROM_NAME=Your Company Name
SMTP_CC_EMAIL=
SMTP_BCC_EMAIL=
SMTP_REJECT_UNAUTHORIZED=true

# File Upload Configuration
MAX_FILE_SIZE=52428800
UPLOAD_DIR=./uploads

# Logging
LOG_LEVEL=info
LOG_DIR=./logs

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Important Security Notes:

1. **JWT Secrets**: Must be at least 32 characters long and randomly generated
2. **Database Password**: Use a strong, unique password
3. **CORS Origin**: Only include your production frontend domains
4. **Never commit `.env` file**: It should be in `.gitignore`

## Generating Secure Secrets:

```bash
# Generate JWT secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate refresh secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
