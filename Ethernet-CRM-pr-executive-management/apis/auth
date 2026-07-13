
📘 Madhuram API – Auth & Users Documentation
🔗 Base URL
Production
https://api.madhuram.enterprises

Allowed Roles
admin
operational_manager
po_officer
labour


🔐 AUTH APIs

1️⃣ Signup
Endpoint
POST /api/auth/signup

Request Body
{
    "name": "Admin",
    "username": "Admin",
    "email": "superadmin@gmail.com",
    "phone_number": "79001224499",
    "role": "admin",
    "project": [
        "Project-a"
    ],
    "password": "2024"
}



Success Response (201)
{
  "token": "JWT_TOKEN",
  "user": {
    "user_id": "ff45bff1-9ee9-46c3-8c14-fb48e4199690",
    "username": "Admin",
    "name": "Admin",
    "email": "admin@gmail.com",
    "phone_number": "789456123",
    "role": "admin",
    "project_list": ["project-a"]
  }
}


Error Responses
Status
Message
400
username, email, phone_number, password, and role are required
400
invalid role
409
email already exists
409
phone number already exists
500
JWT_SECRET is not configured
500
failed to sign up


2️⃣ Login
Endpoint
POST /api/auth/login

Request Body
{
  "email": "admin@gmail.com",
  "password": "Admin@123"
}


Success Response (200)
{
  "token": "JWT_TOKEN",
  "user": {
    "user_id": "c9c7d500-5728-4b82-bb96-d683ad781082",
    "username": "Admin",
    "name": "Admin",
    "email": "admin@gmail.com",
    "phone_number": "7900122449",
    "role": "admin",
    "project_list": ["project-a"]
  },
  "message": "login successful"
}


Error Responses
Status
Message
400
email and password are required
401
invalid credentials
401
password does not match
500
JWT_SECRET is not configured
500
failed to log in


3️⃣ Logout
Endpoint
POST /api/auth/logout

Request
No body required.
Success Response
{
  "message": "logged out successfully"
}

ℹ️ Logout is client-side only.
Frontend should remove the JWT from storage.

4️⃣ Forgot Password
Endpoint
POST /api/auth/forgot-password

Request Body
{
  "email_id": "admin@gmail.com",
  "password_change": "NewPassword@123",
  "re_typepassword": "NewPassword@123"
}


Success Response (200)
{
  "message": "password updated successfully"
}


Error Responses
Status
Message
400
email_id, password_change, and re_typepassword are required
400
password does not match
401
email not found
500
failed to update password


👥 USERS APIs

5️⃣ Get All Users
Endpoint
GET /api/auth/users

Success Response (200)
[
  {
    "user_id": "uuid",
    "name": "Admin",
    "email": "admin@gmail.com",
    "phone_number": "789456123",
    "role": "admin",
    "project_list": ["project-a"]
  }
]


6️⃣ Update User
Endpoint
PUT /api/auth/users/:id

URL Param
id = user_id

Request Body
{
  "username": "Admin Updated",
  "email": "admin@gmail.com",
  "phone_number": "789456123",
  "role": "admin",
  "project_list": ["project-a", "project-b"]
}


Success Response (200)
{
  "user_id": "uuid",
  "name": "Admin Updated",
  "email": "admin@gmail.com",
  "phone_number": "789456123",
  "role": "admin",
  "project_list": ["project-a", "project-b"]
}


Error Responses
Status
Message
400
username, email and role are required
404
user not found
500
failed to update user


7️⃣ Delete User
Endpoint
DELETE /api/auth/users/:id

Success Response (200)
{
  "message": "user deleted successfully"
}

Error Responses
Status
Message
404
user not found
500
failed to delete user


✅ Health Check
GET /health

Response:
{ "status": "ok" }

