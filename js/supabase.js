/**
 * mgm Oktoberfest 2026 - Supabase Integration Module
 * Handles database operations for registrations and live stats.
 */

const SUPABASE_CONFIG = {
  url: 'https://jijngdphviddhdtnyhwr.supabase.co',
  key: 'sb_publishable_2hS5dPOE3HEpGW_pPz3cIA_7Pjhuzve' // Cần cập nhật Anon key của project jijngdphviddhdtnyhwr
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
  const client = getSupabaseClient();
  
  if (!client) {
    // Fallback: direct REST API fetch if Supabase SDK is still loading
    try {
      const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/oktoberfest_registrations`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(registrationData)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 409 || errData.code === '23505') {
          return { success: false, error: 'Email này đã được đăng ký trước đó rồi!' };
        }
        return { success: false, error: errData.message || 'Không thể lưu đăng ký. Vui lòng thử lại sau.' };
      }

      const result = await response.json();
      return { success: true, data: result[0] || result };
    } catch (err) {
      console.error('Registration fetch error:', err);
      return { success: false, error: 'Lỗi kết nối máy chủ. Vui lòng thử lại.' };
    }
  }

  try {
    const { data, error } = await client
      .from('oktoberfest_registrations')
      .insert([registrationData])
      .select();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Email này đã được đăng ký trước đó rồi!' };
      }
      return { success: false, error: error.message || 'Lỗi khi gửi đăng ký.' };
    }

    return { success: true, data: data[0] };
  } catch (err) {
    console.error('Supabase submitRegistration error:', err);
    return { success: false, error: 'Đã xảy ra lỗi không mong muốn.' };
  }
}

/**
 * Check if an email is already registered
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function checkEmailRegistered(email) {
  const client = getSupabaseClient();
  const normalizedEmail = (email || '').trim().toLowerCase();
  
  if (!normalizedEmail) return false;

  try {
    if (client) {
      const { data, error } = await client
        .from('oktoberfest_registrations')
        .select('id')
        .eq('email', normalizedEmail)
        .limit(1);
      return !error && data && data.length > 0;
    } else {
      const response = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/oktoberfest_registrations?email=eq.${encodeURIComponent(normalizedEmail)}&select=id`,
        {
          headers: {
            'apikey': SUPABASE_CONFIG.key,
            'Authorization': `Bearer ${SUPABASE_CONFIG.key}`
          }
        }
      );
      const data = await response.json();
      return Array.isArray(data) && data.length > 0;
    }
  } catch (e) {
    console.warn('Check email error:', e);
    return false;
  }
}

/**
 * Fetch live attendee count
 * @returns {Promise<{total: number, danang: number, hcmc: number}>}
 */
async function fetchAttendeeCount() {
  try {
    const response = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/oktoberfest_registrations?select=office`,
      {
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': `Bearer ${SUPABASE_CONFIG.key}`
        }
      }
    );
    if (!response.ok) return { total: 0, danang: 0, hcmc: 0 };
    const list = await response.json();
    if (!Array.isArray(list)) return { total: 0, danang: 0, hcmc: 0 };

    const danang = list.filter(r => r.office === 'danang').length;
    const hcmc = list.filter(r => r.office === 'hcmc').length;
    return { total: list.length, danang, hcmc };
  } catch (e) {
    return { total: 0, danang: 0, hcmc: 0 };
  }
}

// Expose on window for global access
window.OktoberfestDB = {
  getSupabaseClient,
  submitRegistration,
  checkEmailRegistered,
  fetchAttendeeCount
};
