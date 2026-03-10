const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;

if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your_')) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('Supabase connected');
} else {
  console.log('Supabase not configured - using local storage fallback');
}

module.exports = supabase;
