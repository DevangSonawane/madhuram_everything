# Environment Variables Configuration

Copy this content to create your `.env` file in the server root directory.

```env
# Server Configuration
PORT=3000
NODE_ENV=development
HOST=0.0.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Email Configuration (SMTP)
# For Gmail: Use App Password (not regular password)
# Enable 2FA and generate App Password at: https://myaccount.google.com/apppasswords
# For other providers: Use their SMTP settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=madhuramenterprises1234@gmail.com
SMTP_PASS=your-app-password-or-password
SMTP_FROM_EMAIL=madhuramenterprises1234@gmail.com
SMTP_FROM_NAME=Madhuram Enterprises
SMTP_CC_EMAIL=
SMTP_BCC_EMAIL=
SMTP_REJECT_UNAUTHORIZED=true

# Company Information (for email templates)
COMPANY_NAME=Your Company Name

# File Upload Configuration
MAX_FILE_SIZE=10485760
MAX_FILES=10
UPLOAD_PATH=./uploads

# API Configuration
API_BASE_URL=http://localhost:3000/api/v1

# Logging
LOG_LEVEL=info
```

## Email Configuration Guide

### Gmail Setup:
1. Enable 2-Factor Authentication on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an App Password for "Mail"
4. Use the generated password in `SMTP_PASS`

### Other Email Providers:
- **Outlook/Hotmail**: `smtp-mail.outlook.com`, port `587`
- **Yahoo**: `smtp.mail.yahoo.com`, port `587`
- **Custom SMTP**: Use your provider's SMTP settings

## Production Checklist:
- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper `CORS_ORIGIN` for your domain
- [ ] Set up proper email SMTP credentials
- [ ] Configure database connection for production
- [ ] Set up file upload directory with proper permissions
- [ ] Configure `COMPANY_NAME` for email templates
