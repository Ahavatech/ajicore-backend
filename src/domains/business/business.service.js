const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { NotFoundError, ValidationError } = require('../../utils/errors');

const PROFILE_FIELDS = [
  'name',
  'industry',
  'business_structure',
  'company_email',
  'company_type',
  'company_phone',
  'owner_phone',
  'street',
  'city',
  'postal_code',
  'country',
  'logo_url',
  'timezone',
  'business_hours',
  'service_area_description',
  'home_base_zip',
  'service_radius_miles',
  'cost_per_mile_over_radius',
  'dedicated_phone_number',
  'ai_phone_number',
  'ai_phone_country',
  'ai_phone_area_code',
  'ai_receptionist_name',
  'voice_gender',
  'ai_business_description',
  'unknown_service_handling',
  'unknown_service_call_fee',
];

const DEFAULT_ALERT_SETTINGS = {
  missed_calls: true,
  inbound_sms: true,
  failed_checkins: true,
  overdue_invoices: true,
  expiring_quotes: true,
};

const DEFAULT_AUTOMATION_SETTINGS = {
  team_checkins_enabled: true,
  invoice_reminders_enabled: true,
  quote_follow_ups_enabled: true,
  default_check_in_frequency_hours: 1,
};

const DEFAULT_COMMUNICATION_SETTINGS = {
  send_booking_confirmations: true,
  send_job_updates: true,
  send_invoice_reminders: true,
  missed_call_text_back: true,
};

function sanitizeBusiness(business) {
  if (!business) return business;
  const { internal_api_token, ...safe } = business;
  return safe;
}

function buildProfilePayload(business) {
  return {
    business_id: business.id,
    profile: {
      name: business.name,
      industry: business.industry,
      business_structure: business.business_structure || '',
      company_email: business.company_email || '',
      company_type: business.company_type || '',
      company_phone: business.company_phone || '',
      owner_phone: business.owner_phone || '',
      street: business.street || '',
      city: business.city || '',
      postal_code: business.postal_code || '',
      country: business.country || '',
      logo_url: business.logo_url || '',
      timezone: business.timezone || 'UTC',
      business_hours: business.business_hours || {},
      service_area_description: business.service_area_description || '',
      home_base_zip: business.home_base_zip || '',
      service_radius_miles: business.service_radius_miles ?? null,
      cost_per_mile_over_radius: business.cost_per_mile_over_radius ?? null,
      dedicated_phone_number: business.dedicated_phone_number || '',
      ai_phone_number: business.ai_phone_number || '',
      ai_phone_country: business.ai_phone_country || '',
      ai_phone_area_code: business.ai_phone_area_code || '',
      ai_receptionist_name: business.ai_receptionist_name || '',
      voice_gender: business.voice_gender || null,
      ai_business_description: business.ai_business_description || '',
      unknown_service_handling: business.unknown_service_handling,
      unknown_service_call_fee: business.unknown_service_call_fee ?? null,
    },
  };
}

function mergeSettings(defaults, currentSettings, overrideSettings) {
  return {
    ...defaults,
    ...(currentSettings && typeof currentSettings === 'object' ? currentSettings : {}),
    ...(overrideSettings && typeof overrideSettings === 'object' ? overrideSettings : {}),
  };
}

function getSettingsOverride(data) {
  const source = data.settings && typeof data.settings === 'object' ? data.settings : data;
  const {
    business_id,
    quote_expiry_days,
    payment_follow_up_days,
    payment_interval,
    ai_receptionist_name,
    voice_gender,
    ai_business_description,
    unknown_service_handling,
    unknown_service_call_fee,
    ...settings
  } = source;

  return settings;
}

async function getBusinessRecord(businessId) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    throw new NotFoundError('Business');
  }

  return business;
}

async function getProfile(businessId) {
  const business = await getBusinessRecord(businessId);
  return buildProfilePayload(sanitizeBusiness(business));
}

async function updateProfile(data) {
  if (!data.business_id) {
    throw new ValidationError('business_id is required.');
  }

  const updateData = {};
  const source = data.profile && typeof data.profile === 'object'
    ? { ...data.profile, ...data }
    : data;

  for (const field of PROFILE_FIELDS) {
    if (source[field] !== undefined) {
      updateData[field] = source[field];
    }
  }

  const business = await prisma.business.update({
    where: { id: data.business_id },
    data: updateData,
  });

  return buildProfilePayload(sanitizeBusiness(business));
}

async function getAlerts(businessId) {
  const business = await getBusinessRecord(businessId);
  return {
    business_id: business.id,
    settings: mergeSettings(DEFAULT_ALERT_SETTINGS, business.alert_settings),
  };
}

async function updateAlerts(data) {
  if (!data.business_id) {
    throw new ValidationError('business_id is required.');
  }

  const business = await getBusinessRecord(data.business_id);
  const settings = mergeSettings(DEFAULT_ALERT_SETTINGS, business.alert_settings, getSettingsOverride(data));

  const updated = await prisma.business.update({
    where: { id: data.business_id },
    data: { alert_settings: settings },
  });

  return {
    business_id: updated.id,
    settings: mergeSettings(DEFAULT_ALERT_SETTINGS, updated.alert_settings),
  };
}

async function getAutomation(businessId) {
  const business = await getBusinessRecord(businessId);
  return {
    business_id: business.id,
    settings: {
      ...mergeSettings(DEFAULT_AUTOMATION_SETTINGS, business.automation_settings),
      quote_expiry_days: business.quote_expiry_days ?? 30,
      payment_follow_up_days: business.payment_follow_up_days || [],
      payment_interval: business.payment_interval || '',
    },
  };
}

async function updateAutomation(data) {
  if (!data.business_id) {
    throw new ValidationError('business_id is required.');
  }

  const business = await getBusinessRecord(data.business_id);
  const settings = mergeSettings(DEFAULT_AUTOMATION_SETTINGS, business.automation_settings, getSettingsOverride(data));

  const updated = await prisma.business.update({
    where: { id: data.business_id },
    data: {
      automation_settings: settings,
      quote_expiry_days: data.quote_expiry_days ?? business.quote_expiry_days,
      payment_follow_up_days: data.payment_follow_up_days ?? business.payment_follow_up_days,
      payment_interval: data.payment_interval ?? business.payment_interval,
    },
  });

  return {
    business_id: updated.id,
    settings: {
      ...mergeSettings(DEFAULT_AUTOMATION_SETTINGS, updated.automation_settings),
      quote_expiry_days: updated.quote_expiry_days ?? 30,
      payment_follow_up_days: updated.payment_follow_up_days || [],
      payment_interval: updated.payment_interval || '',
    },
  };
}

async function getCommunication(businessId) {
  const business = await getBusinessRecord(businessId);
  return {
    business_id: business.id,
    settings: {
      ...mergeSettings(DEFAULT_COMMUNICATION_SETTINGS, business.communication_settings),
      ai_receptionist_name: business.ai_receptionist_name || '',
      voice_gender: business.voice_gender || null,
      ai_business_description: business.ai_business_description || '',
      unknown_service_handling: business.unknown_service_handling,
      unknown_service_call_fee: business.unknown_service_call_fee ?? null,
    },
  };
}

async function updateCommunication(data) {
  if (!data.business_id) {
    throw new ValidationError('business_id is required.');
  }

  const business = await getBusinessRecord(data.business_id);
  const settings = mergeSettings(DEFAULT_COMMUNICATION_SETTINGS, business.communication_settings, getSettingsOverride(data));

  const updated = await prisma.business.update({
    where: { id: data.business_id },
    data: {
      communication_settings: settings,
      ai_receptionist_name: data.ai_receptionist_name ?? business.ai_receptionist_name,
      voice_gender: data.voice_gender ?? business.voice_gender,
      ai_business_description: data.ai_business_description ?? business.ai_business_description,
      unknown_service_handling: data.unknown_service_handling ?? business.unknown_service_handling,
      unknown_service_call_fee: data.unknown_service_call_fee ?? business.unknown_service_call_fee,
    },
  });

  return {
    business_id: updated.id,
    settings: {
      ...mergeSettings(DEFAULT_COMMUNICATION_SETTINGS, updated.communication_settings),
      ai_receptionist_name: updated.ai_receptionist_name || '',
      voice_gender: updated.voice_gender || null,
      ai_business_description: updated.ai_business_description || '',
      unknown_service_handling: updated.unknown_service_handling,
      unknown_service_call_fee: updated.unknown_service_call_fee ?? null,
    },
  };
}

module.exports = {
  getProfile,
  updateProfile,
  getAlerts,
  updateAlerts,
  getAutomation,
  updateAutomation,
  getCommunication,
  updateCommunication,
};
