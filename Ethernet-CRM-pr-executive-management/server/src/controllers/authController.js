import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { DatabaseError, ValidationError, UniqueConstraintError } from 'sequelize';

const VALID_ROLES = ['admin', 'operational_manager', 'po_officer', 'labour'];

const normalizeText = (value) => {
  if (value == null) return '';
  return String(value).trim();
};

const formatUserResponse = (user) => ({
  // Backward-compatible fallback for older rows where username might be missing.
  username: normalizeText(user.username) || normalizeText(user.name),
  user_id: user.id,
  name: user.name,
  email: user.email,
  phone_number: user.phone_number,
  role: user.role,
  project_list: user.project_list,
  access_control: user.access_control ?? null,
});

const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    }, 
    process.env.JWT_SECRET || 'default_secret', 
    { expiresIn: '24h' }
  );
};

const createUserRecord = async ({ name, username, email, phone_number, role, project, password }) => {
  if (!name || !username || !email || !phone_number || !password || !role) {
    return { error: { status: 400, message: 'username, email, phone_number, password, and role are required' } };
  }

  if (!VALID_ROLES.includes(role)) {
    return { error: { status: 400, message: 'invalid role' } };
  }

  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) return { error: { status: 409, message: 'email already exists' } };

  const existingPhone = await User.findOne({ where: { phone_number } });
  if (existingPhone) return { error: { status: 409, message: 'phone number already exists' } };

  const user = await User.create({
    name,
    username,
    email,
    phone_number,
    role,
    project_list: Array.isArray(project) ? project : [],
    password
  });

  return { user };
};

// 1. Signup
export const signup = async (req, res) => {
  try {
    const { name, username, email, phone_number, role, project, password } = req.body;
    const result = await createUserRecord({ name, username, email, phone_number, role, project, password });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }
    const { user } = result;

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: formatUserResponse(user)
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'failed to sign up' });
  }
};

// Create user via management endpoint (admin / operational manager)
export const createUser = async (req, res) => {
  try {
    const { name, username, email, phone_number, role, project, password } = req.body;
    const result = await createUserRecord({ name, username, email, phone_number, role, project, password });
    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    return res.status(201).json(formatUserResponse(result.user));
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ message: 'failed to create user' });
  }
};

// 2. Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'invalid credentials' });
    }

    const isMatch = await user.isValidPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'password does not match' });
    }

    const token = generateToken(user);

    res.status(200).json({
      token,
      user: formatUserResponse(user),
      message: 'login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'failed to log in' });
  }
};

// 3. Logout
export const logout = async (req, res) => {
  res.status(200).json({ message: 'logged out successfully' });
};

// 4. Forgot Password
export const forgotPassword = async (req, res) => {
  try {
    const { email_id, password_change, re_typepassword } = req.body;

    if (!email_id || !password_change || !re_typepassword) {
      return res.status(400).json({ message: 'email_id, password_change, and re_typepassword are required' });
    }

    if (password_change !== re_typepassword) {
      return res.status(400).json({ message: 'password does not match' });
    }

    const user = await User.findOne({ where: { email: email_id } });
    if (!user) {
      return res.status(401).json({ message: 'email not found' });
    }

    user.password = password_change;
    await user.save();

    res.status(200).json({ message: 'password updated successfully' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'failed to update password' });
  }
};

// 5. Get All Users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    const formattedUsers = users.map((user) => formatUserResponse(user));

    res.status(200).json(formattedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'failed to fetch users' });
  }
};

// 6. Get User By ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'user not found' });
    }

    res.status(200).json(formatUserResponse(user));
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({ message: 'failed to fetch user' });
  }
};

// 7. Update User
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, phone_number, role, project, project_list } = req.body;
    const normalizedUsername = normalizeText(username);
    const normalizedEmail = normalizeText(email);
    const normalizedPhone = normalizeText(phone_number);
    const normalizedRole = normalizeText(role);

    if (!normalizedUsername || !normalizedEmail || !normalizedPhone || !normalizedRole) {
      return res.status(400).json({ message: 'username, email, phone_number and role are required' });
    }
    if (!VALID_ROLES.includes(normalizedRole)) {
      return res.status(400).json({ message: 'invalid role' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'user not found' });
    }

    user.name = normalizedUsername; // Map username in body to name in DB as per doc implication
    user.username = normalizedUsername; // Also update username field
    user.email = normalizedEmail;
    user.phone_number = normalizedPhone;
    user.role = normalizedRole;
    const projects = Array.isArray(project) ? project : project_list;
    if (Array.isArray(projects)) user.project_list = projects;

    await user.save();

    res.status(200).json(formatUserResponse(user));

  } catch (error) {
    console.error('Update user error:', error);
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({ message: 'email or phone number already exists' });
    }
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message || 'validation failed' });
    }
    if (error instanceof DatabaseError) {
      const sqlMessage = error?.parent?.sqlMessage || error.message || '';
      if (sqlMessage.includes('role') && sqlMessage.includes('Data truncated')) {
        return res.status(400).json({
          message: 'invalid role in database enum; ensure app_users.role supports operational_manager'
        });
      }
    }
    res.status(500).json({ message: 'failed to update user' });
  }
};

// 7b. Update User Access Control
export const updateUserAccessControl = async (req, res) => {
  try {
    const { id } = req.params;
    const { access_control } = req.body;

    if (access_control == null || typeof access_control !== 'object') {
      return res.status(400).json({ message: 'access_control must be an object' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'user not found' });
    }

    user.access_control = access_control;
    await user.save();

    res.status(200).json(formatUserResponse(user));
  } catch (error) {
    console.error('Update access control error:', error);
    res.status(500).json({ message: 'failed to update access control' });
  }
};

// 8. Delete User
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ message: 'user not found' });
    }

    await user.destroy();
    res.status(200).json({ message: 'user deleted successfully' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'failed to delete user' });
  }
};
