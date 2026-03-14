async function test() {
  try {
    const resInfo = await fetch('http://localhost:3000/api/v1/public/book/salon-lucija-premium-5');
    const infoData = await resInfo.json();
    console.log('Business Info Services:', infoData.data.services.length);
    
    if (infoData.data.services.length > 0) {
      const sId = infoData.data.services[0].id;
      console.log('Using service ID:', sId);
      
      const resAvail = await fetch('http://localhost:3000/api/v1/public/book/salon-lucija-premium-5/availability?date=2026-03-14&service_id=' + sId);
      const availData = await resAvail.json();
      console.log('Availability response:', JSON.stringify(availData, null, 2));
    }
  } catch(e) {
    console.error(e);
  }
}
test();
