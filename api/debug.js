const { getVertexCredentials, getVertexAccessToken } = require('../lib/vertex');

module.exports = async (req, res) => {
  const envVal = process.env.GCP_SERVICE_ACCOUNT_KEY;
  const creds = getVertexCredentials();

  let tokenSuccess = false;
  let tokenErr = null;

  if (creds) {
    try {
      const token = await getVertexAccessToken(creds);
      tokenSuccess = !!token;
    } catch (e) {
      tokenErr = e.message;
    }
  }

  return res.status(200).json({
    env_present: !!envVal,
    env_length: envVal ? envVal.length : 0,
    env_prefix: envVal ? envVal.substring(0, 15) : null,
    creds_parsed: !!creds,
    project_id: creds ? creds.project_id : null,
    client_email: creds ? creds.client_email : null,
    token_success: tokenSuccess,
    token_error: tokenErr
  });
};
