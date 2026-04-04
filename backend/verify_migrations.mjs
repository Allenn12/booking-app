import pool from './config/database.js';

async function verify() {
  try {
    const [businessCols] = await pool.query('SHOW COLUMNS FROM business');
    const [clientCols] = await pool.query('SHOW COLUMNS FROM clients');
    
    console.log('Business Columns:', businessCols.map(c => c.Field));
    console.log('Client Columns:', clientCols.map(c => c.Field));
    
    const expectedBusiness = ['description', 'logo_url', 'cover_image_url', 'instagram_url', 'facebook_url', 'currency', 'timezone'];
    const expectedClient = ['sms_marketing_consent', 'consent_given_at', 'consent_source'];
    
    const missingBusiness = expectedBusiness.filter(c => !businessCols.some(col => col.Field === c));
    const missingClient = expectedClient.filter(c => !clientCols.some(col => col.Field === c));
    
    if (missingBusiness.length === 0 && missingClient.length === 0) {
      console.log('✅ ALL COLUMNS VERIFIED SUCCESSFULLY.');
    } else {
      console.error('❌ MISSING COLUMNS:', { missingBusiness, missingClient });
    }
  } catch (err) {
    console.error('❌ Verification failed:', err);
  } finally {
    process.exit(0);
  }
}

verify();
