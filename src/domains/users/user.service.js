const prisma = require('../../lib/prisma');
const authService = require('../auth/auth.service');
const { NotFoundError, ValidationError } = require('../../utils/errors');

function mapProfile(user) {
  return {
    id: user.id,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    email: user.email,
    phone_number: user.phone_number || '',
    avatar_url: user.avatar_url || '',
  };
}

async function getMyProfile(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User');
  }

  return mapProfile(user);
}

async function updateMyProfile(userId, data) {
  const allowedFields = ['first_name', 'last_name', 'phone_number', 'avatar_url'];
  const updateData = {};

  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      updateData[field] = data[field] || null;
    }
  });

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('At least one profile field must be provided.');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  if (updatedUser.staff_id) {
    const staffUpdate = {};
    const fullName = [updatedUser.first_name, updatedUser.last_name].filter(Boolean).join(' ').trim();

    if (fullName) {
      staffUpdate.name = fullName;
    }
    if (updateData.phone_number !== undefined) {
      staffUpdate.phone = updatedUser.phone_number;
    }

    if (Object.keys(staffUpdate).length > 0) {
      await prisma.staff.update({
        where: { id: updatedUser.staff_id },
        data: staffUpdate,
      }).catch(() => {});
    }
  }

  return mapProfile(updatedUser);
}

async function changeMyPassword(userId, currentPassword, newPassword) {
  await authService.changePassword(userId, currentPassword, newPassword);
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
};
