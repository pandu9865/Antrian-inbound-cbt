const inbound = require("./inbound");

// Dedicated route for Vercel Cron. The actual authorization and sync logic
// remain in the main API so manual and scheduled sync follow one code path.
module.exports = (req, res) => {
  req.query = { ...(req.query || {}), action: "cron_sync_superset" };
  return inbound(req, res);
};
