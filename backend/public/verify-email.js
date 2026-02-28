// Countdown timer za resend button
let countdown = 30;
const resendBtn = document.querySelector('#resend-btn');
const countdownSpan = document.querySelector('#countdown');

// Pokreni countdown
const countdownInterval = setInterval(() => {
  countdown--;
  countdownSpan.textContent = countdown;
  
  if (countdown <= 0) {
    clearInterval(countdownInterval);
    resendBtn.disabled = false;
    resendBtn.textContent = 'Pošalji ponovno';
    resendBtn.classList.remove('disabled');
  }
}, 1000);

// Resend button click handler
resendBtn.addEventListener('click', async () => {
  try {
    resendBtn.disabled = true;
    resendBtn.textContent = 'Šaljem...';
    
    const response = await fetch('/api/v1/auth/resend-verification-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Prikaži success poruku
      const status = document.querySelector('#status');
      status.className = 'status success';
      status.textContent = '✓ Novi verification link poslan!';
      
      // Reset countdown
      countdown = 30;
      countdownSpan.textContent = countdown;
      resendBtn.textContent = `Pošalji ponovno za ${countdown}s`;
      resendBtn.classList.add('disabled');
      
      // Pokreni countdown ponovno
      const newCountdown = setInterval(() => {
        countdown--;
        countdownSpan.textContent = countdown;
        resendBtn.textContent = `Pošalji ponovno za ${countdown}s`;
        
        if (countdown <= 0) {
          clearInterval(newCountdown);
          resendBtn.disabled = false;
          resendBtn.textContent = 'Pošalji ponovno';
          resendBtn.classList.remove('disabled');
        }
      }, 1000);
      
    } else {
      throw new Error(data.message || 'Greška pri slanju');
    }
    
  } catch (error) {
    console.error('Resend error:', error);
    const status = document.getElementById('status');
    status.className = 'status error';
    status.innerHTML = '✗ Greška: ' + error.message;
    
    resendBtn.disabled = false;
    resendBtn.textContent = 'Pošalji ponovno';
  }
});

// Polling - provjeri je li email verificiran svakih 2 sekunde
const pollInterval = setInterval(async () => {
  try {
    const response = await fetch('/api/v1/auth/check-verification');
    const data = await response.json();
    console.log(data);
    
    if (data.verified) {
      // Email je verificiran!
      clearInterval(pollInterval);
      clearInterval(countdownInterval);  // Stop countdown
      
      // Prikaži success
      const status = document.getElementById('status');
      status.className = 'status success';
      status.innerHTML = '✓ Email je uspješno verificiran! Preusmeravamo...';
      
      // Redirect nakon 2 sekunde
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    }
  } catch (error) {
    console.error('Greška pri provjeri:', error);
  }
}, 2000);
