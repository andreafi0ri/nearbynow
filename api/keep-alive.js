// Supabase keep-alive ping
// Prevents free-tier project pausing after 7 days of inactivity.
// Runs every 5 days via Vercel Cron — well within the window.
// Remove this once upgraded to Supabase Pro.

const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { error } = await supabase
      .from("push_subscriptions")
      .select("id")
      .limit(1);

    if (error) {
      console.error("[keep-alive] query failed:", error);
      return res.status(500).json({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    console.log("[keep-alive] Supabase pinged successfully");
    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[keep-alive] error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
