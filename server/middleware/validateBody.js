/**
 * Validate and filter request body to only allow specified fields.
 * Prevents clients from overwriting sensitive fields like score, firm_id, etc.
 *
 * Usage: validateBody(['status', 'assigned_staff_id', 'follow_up_date', 'notes'])
 */
function validateBody(allowedFields) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const filtered = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        filtered[field] = req.body[field];
      }
    }

    if (Object.keys(filtered).length === 0) {
      return res.status(400).json({
        error: 'No valid fields provided',
        allowed_fields: allowedFields,
      });
    }

    req.body = filtered;
    next();
  };
}

module.exports = validateBody;
