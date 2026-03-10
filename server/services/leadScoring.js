/**
 * Calculates a lead score from 0-100 based on intake data.
 * Higher score = more qualified, more urgent, more likely to convert.
 */
function calculateLeadScore(leadData) {
  let score = 0;

  // Case type scoring (some cases are higher value)
  const caseTypeScores = {
    divorce: 25,
    custody: 30,
    domestic_violence: 35,
    support: 20,
    paternity: 15,
    adoption: 20,
    other: 10,
  };
  score += caseTypeScores[leadData.case_type] || 10;

  // Urgency scoring
  const urgencyScores = {
    high: 30,
    medium: 20,
    low: 10,
  };
  score += urgencyScores[leadData.urgency] || 10;

  // Contact info completeness
  if (leadData.caller_name) score += 5;
  if (leadData.caller_phone) score += 5;
  if (leadData.caller_email) score += 10;

  // Appointment booked = strong intent
  if (leadData.appointment_booked) score += 15;

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Returns a label based on score
 */
function getScoreLabel(score) {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

module.exports = { calculateLeadScore, getScoreLabel };
