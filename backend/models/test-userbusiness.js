import UserBusiness from './UserBusiness.js';

async function test() {
// ✅ TEST 10: Get users in business
try {
  console.log('TEST 10: Getting users in business 5...');
  const users = await UserBusiness.getBusinessUsers(5);
  
  if (Array.isArray(users) && users.length > 0) {
    console.log(`✅ TEST 10 PASSED! Found ${users.length} user(s):`);
    users.forEach(u => {
      console.log(`  - ${u.user_first_name} ${u.user_last_name} (${u.user_email}) - Role: ${u.role}`);
    });
  } else {
    console.log('⚠️ Business has no users');
  }
} catch (error) {
  console.error('❌ TEST 10 FAILED:', error.message);
}
  
  process.exit(0);
}

test();