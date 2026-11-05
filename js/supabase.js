/**
 * mgm Oktoberfest 2026 - Supabase Integration Module
 * Handles database operations for registrations and live stats.
 */

const SUPABASE_CONFIG = {
  url: 'https://jijngdphviddhdtnyhwr.supabase.co',
  key: 'sb_publishable_dP8FnIPTiNNLJZgo84_47A_Yni1UnRm'
};

let _supabaseClient = null;

/**
 * Get or initialize the Supabase client instance
 */
function getSupabaseClient() {
  if (!_supabaseClient && window.supabase) {
    _supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
  }
  return _supabaseClient;
}

/**
 * Submit event registration to Supabase
 * @param {Object} registrationData
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function submitRegistration(registrationData) {
  // Event has concluded - no database writes needed
  return { 
    success: false, 
    error: 'Sự kiện đã kết thúc, cảm ơn bạn! / The event has ended, thank you!' 
  };
}

/**
 * Check if an email is already registered
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function checkEmailRegistered(email) {
  return false;
}

/**
 * Fetch live attendee count
 * @returns {Promise<{total: number, danang: number, hcmc: number}>}
 */
async function fetchAttendeeCount() {
  return { total: 200, danang: 100, hcmc: 100 };
}

// Expose on window for global access
window.OktoberfestDB = {
  getSupabaseClient,
  submitRegistration,
  checkEmailRegistered,
  fetchAttendeeCount
};
