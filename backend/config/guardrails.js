// Live guardrail settings — in-memory, editable by merchant via dashboard
// upsellAgent and retryAgent import these at call-time (not at require-time)
// so changes take effect immediately without restart

const settings = {
  max_upsell_discount_pct:  30,    // max discount % the upsell agent may offer
  max_auto_approve_inr:   5000,    // orders above this need manual approval
  max_reminders_per_order:   3,    // campaign agent: max reminder attempts
  retry_enabled:          true,    // allow retry agent to run
};

function get()              { return { ...settings }; }
function update(patch)      { Object.assign(settings, patch); return get(); }

module.exports = { get, update };
