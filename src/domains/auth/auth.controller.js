/**
 * Auth Controller
 * Handles HTTP request/response logic for user authentication.
 */
const authService = require('./auth.service');

async function signup(req, res, next) {
  try {
    const { email, password, name, business_name, industry } = req.body;
    const result = await authService.signup({ email, password, name, business_name, industry });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function signin(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.signin({ email, password });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    await authService.changePassword(req.user.id, current_password, new_password);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, signin, getMe, changePassword };