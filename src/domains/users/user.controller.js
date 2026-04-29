const userService = require('./user.service');

async function getMe(req, res, next) {
  try {
    const profile = await userService.getMyProfile(req.user.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const profile = await userService.updateMyProfile(req.user.id, req.body);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    await userService.changeMyPassword(req.user.id, req.body.current_password, req.body.new_password);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  updateMe,
  changePassword,
};
