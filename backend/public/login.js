const loginForm = document.querySelector('#loginForm');
const btnLogin = document.querySelector('#btnLogin');

function showToast(message, type='error', duration=5000){
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const icon = type === 'error'? '❌':
    type === 'success' ? '✅' : '⚠️';
  console.log(icon);

  const toastIcon = document.createElement("span");
  toastIcon.textContent = icon;
  toastIcon.classList.add('toast-icon');

  const toastMessage = document.createElement("span");
  toastMessage.textContent = message;
  toastMessage.classList.add('toast-message');

  const toastClose = document.createElement("button");
  toastClose.classList.add('toast-close');
  toastClose.textContent = '✕';
  toastClose.setAttribute('aria-label', 'Zatvori poruku');
  toastClose.setAttribute('type', 'button');

  const fragment = document.createDocumentFragment();
  fragment.appendChild(toastIcon);
  fragment.appendChild(toastMessage);
  fragment.appendChild(toastClose);
  
  toast.appendChild(fragment);
  
  const toastContainer = document.querySelector('#toastContainer');
  toastContainer.appendChild(toast);

  setTimeout(()=> toast.classList.add('show'),10);

  toastClose.addEventListener('click', ()=>{
    toast.classList.remove('show');
    setTimeout(()=> toast.remove(), 300) // OVDJE STAVLJENO 300ms ZBOG CSS TRANSITIONA KOJI TRAJE 0.3s
  });

  const autoClose = setTimeout(()=>{
    toast.classList.remove('show');
    setTimeout(()=> toast.remove(), 300)
  }, duration);

}

loginForm.addEventListener('submit', async(e)=>{
    e.preventDefault();
    btnLogin.disabled = true;
    const email = document.querySelector('[name="email"]').value;
    const password = document.querySelector('[name="password"]').value;

    try{
        const response = await fetch('/api/v1/auth/login',{
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email,password})   
        });
        const result = await response.json();
        console.log('Login response:', result);  // Debug
        if(result.success){
            showToast('Uspješno ste se logirali!', 'success', 3000);
            setTimeout(()=>{
                window.location.href = '/dashboard';
            },3000);
            return;
        }

        if (!result.verified && result.redirectTo === '/verify-email') {
            showToast(result.message, 'info', 3000);
            setTimeout(() => {
                window.location.href = '/verify-email';
            }, 3000);
            return;
        }

        if(result.code === 'AUTH' && result.error.includes('Email')){
          showToast(result.error, 'error', 5000);
          return;
        }
        if(result.code === 'AUTH' && result.error.includes('Lozinka')){
          showToast(result.error, 'error', 5000);
          return;
        }

        if(result.code === 'DATABASE' || result.code === 'INTERNAL'){
          showToast('Greška u sustavu! Pokušajte ponovno kasnije.','error', 6000);
          console.error('Server error:', result);
          return;
        }

        if(result.code === 'DATABASE' || result.code === 'INTERNAL'){
          showToast('Greška u sustavu! Pokušajte ponovno kasnije.','error', 6000);
          console.error('Server error:', result);
          return;
        }
    }
    catch(error){
        console.error('Server error:',error);
        showToast('Greška u sustavu! Pokušajte ponovno kasnije.','error', 6000);
        return;
    }
    finally{
        btnLogin.disabled = false;
    }

})