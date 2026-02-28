import Business from "./Business.js";

async function testBusinessCreate() {
    console.log('\n---\n');
try {
  console.log('TEST 17: Adding 50 SMS credits...');
  
  const before = await Business.getById(5);
  console.log('  Balance before:', before.sms_credits);
  
  const success = await Business.addCredits(5, 50);
  
  if (success) {
    const after = await Business.getById(5);
    console.log('  Balance after:', after.sms_credits);
    
    if (after.sms_credits === before.sms_credits + 50) {
      console.log('✅ TEST 17 PASSED! Credits added correctly');
    } else {
      console.log('❌ TEST 17 FAILED: Balance mismatch');
    }
  }
} catch (error) {
  console.error('❌ TEST 17 FAILED:', error.message);
}

}

testBusinessCreate();


