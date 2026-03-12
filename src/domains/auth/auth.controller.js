/**
 * Auth Controller
 * Handles HTTP request/response logic for user authentication
 * and multi-step onboarding flow.
 *
 * Flow:
 *   POST /signup           → Step 1: Create account (email+password)
 *   POST /google           → Step 1: Create account (Google OAuth)
 *   POST /signin           → Sign in existing user
 *   POST /onboarding/step2 → Step 2: Organization contact info
 *   POST /onboarding/step3 → Step 3: Organization address
 *   POST /onboarding/step4 → Step 4: Logo upload
 *   POST /onboarding/step5 → Step 5: AI business number
 *   POST /onboarding/skip5 → Skip step 5
 *   GET  /me               → Get current user profile
 *   PATCH /change-password  → Change password
 */
const authService = require('./auth.service');

async function signup(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.signup({ email, password });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function googleSignup(req, res, next) {
  try {
    const { google_id, email, first_name, last_name } = req.body;
    const result = await authService.googleSignup({ google_id, email, first_name, last_name });
    res.status(result.is_new ? 201 : 200).json(result);
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

async function onboardingStep2(req, res, next) {
  try {
    const result = await authService.onboardingStep2(req.user.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function onboardingStep3(req, res, next) {
  try {
    const result = await authService.onboardingStep3(req.user.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function onboardingStep4(req, res, next) {
  try {
    const result = await authService.onboardingStep4(req.user.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function onboardingStep5(req, res, next) {
  try {
    const result = await authService.onboardingStep5(req.user.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function skipStep5(req, res, next) {
  try {
    const result = await authService.skipStep5(req.user.id);
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

module.exports = {
  signup,
  googleSignup,
  signin,
  onboardingStep2,
  onboardingStep3,
  onboardingStep4,
  onboardingStep5,
  skipStep5,
  getMe,
  changePassword,
};