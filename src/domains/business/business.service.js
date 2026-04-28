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

// ============================================
// Finance Settings
// ============================================

async function getFinanceSettings(businessId) {
  let settings = await prisma.businessFinanceSettings.findUnique({
    where: { business_id: businessId },
  });

  if (!settings) {
    // Create default finance settings if they don't exist
    settings = await prisma.businessFinanceSettings.create({
      data: {
        business_id: businessId,
      },
    });
  }

  return {
    business_id: settings.business_id,
    company_info: {
      name: settings.company_name || '',
      website: settings.company_website || '',
      email: settings.company_email || '',
      phone: settings.company_phone || '',
      logo: settings.company_logo_url || '',
      notes: settings.company_notes || '',
    },
    toggles: {
      website: settings.show_website,
      email: settings.show_email,
      phone: settings.show_phone,
      address: settings.show_address,
    },
    reminders: {
      before_3_days: settings.remind_before_3_days,
      on_due_date: settings.remind_on_due_date,
      after_3_days: settings.remind_after_3_days,
      after_7_days: settings.remind_after_7_days,
    },
    quotes_follow_up: {
      days_2: settings.quote_followup_days_2,
      days_3: settings.quote_followup_days_3,
      days_4: settings.quote_followup_days_4,
      days_7: settings.quote_followup_days_7,
    },
    default_due_date: settings.default_due_date,
    markup_percent: settings.markup_percent ?? 49,
    stripe_connected: !!settings.stripe_account_id,
    stripe_account_id: settings.stripe_account_id || null,
  };
}

async function updateFinanceSettings(businessId, data) {
  if (!businessId) {
    throw new ValidationError('business_id is required.');
  }

  let settings = await prisma.businessFinanceSettings.findUnique({
    where: { business_id: businessId },
  });

  if (!settings) {
    settings = await prisma.businessFinanceSettings.create({
      data: { business_id: businessId },
    });
  }

  const updateData = {};

  // Company Info
  if (data.company_info) {
    updateData.company_name = data.company_info.name;
    updateData.company_website = data.company_info.website;
    updateData.company_email = data.company_info.email;
    updateData.company_phone = data.company_info.phone;
    updateData.company_logo_url = data.company_info.logo;
    updateData.company_notes = data.company_info.notes;
  }

  // Toggles
  if (data.toggles) {
    updateData.show_website = data.toggles.website;
    updateData.show_email = data.toggles.email;
    updateData.show_phone = data.toggles.phone;
    updateData.show_address = data.toggles.address;
  }

  // Reminders
  if (data.reminders) {
    updateData.remind_before_3_days = data.reminders.before_3_days;
    updateData.remind_on_due_date = data.reminders.on_due_date;
    updateData.remind_after_3_days = data.reminders.after_3_days;
    updateData.remind_after_7_days = data.reminders.after_7_days;
  }

  // Quotes Follow-up
  if (data.quotes_follow_up) {
    updateData.quote_followup_days_2 = data.quotes_follow_up.days_2;
    updateData.quote_followup_days_3 = data.quotes_follow_up.days_3;
    updateData.quote_followup_days_4 = data.quotes_follow_up.days_4;
    updateData.quote_followup_days_7 = data.quotes_follow_up.days_7;
  }

  // Default Due Date
  if (data.default_due_date) {
    updateData.default_due_date = data.default_due_date;
  }
  if (data.markup_percent !== undefined) {
    updateData.markup_percent = Number(data.markup_percent);
  }

  const updated = await prisma.businessFinanceSettings.update({
    where: { business_id: businessId },
    data: updateData,
  });

  return {
    business_id: updated.business_id,
    company_info: {
      name: updated.company_name || '',
      website: updated.company_website || '',
      email: updated.company_email || '',
      phone: updated.company_phone || '',
      logo: updated.company_logo_url || '',
      notes: updated.company_notes || '',
    },
    toggles: {
      website: updated.show_website,
      email: updated.show_email,
      phone: updated.show_phone,
      address: updated.show_address,
    },
    reminders: {
      before_3_days: updated.remind_before_3_days,
      on_due_date: updated.remind_on_due_date,
      after_3_days: updated.remind_after_3_days,
      after_7_days: updated.remind_after_7_days,
    },
    quotes_follow_up: {
      days_2: updated.quote_followup_days_2,
      days_3: updated.quote_followup_days_3,
      days_4: updated.quote_followup_days_4,
      days_7: updated.quote_followup_days_7,
    },
    default_due_date: updated.default_due_date,
    markup_percent: updated.markup_percent ?? 49,
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
  getFinanceSettings,
  updateFinanceSettings,
};
