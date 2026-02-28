const registerForm = document.querySelector('#registerForm');
const btnRegister = document.querySelector('#btnRegister');
const phoneRegex = /^\+\d{1,3}[\d\s\-]{7,14}$/;
const inputs = registerForm.querySelectorAll('input');

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

async function loadCountries(){
  try{
    const response = await fetch('/api/v1/countries');
    const data = await response.json();
    console.log(data);
    const selectCountries = document.querySelector('[name="country_code"]');  
    const fragment = document.createDocumentFragment();

    data.countries.forEach(c=>{
      const option = document.createElement("option");
      option.value = c.country_code;
      option.textContent = c.name;
      fragment.appendChild(option);  
    })
    selectCountries.appendChild(fragment);
  } catch(error){
    console.error('Greška:',error);
  }
}
loadCountries();

function clearAllErrors() {
  document.querySelectorAll('input').forEach(input => {
    clearInputError(input);
  });
}

function clearInputError(input) {
  input.classList.remove('is-invalid');
  const errorMsg = input.closest('.form-group').querySelector('.error-message');
  if (errorMsg) {
    errorMsg.classList.add('hidden');
    errorMsg.textContent = '';
  }
}

function showInputError(input, message) {
  input.classList.add('is-invalid');
  const errorMsg = input.closest('.form-group').querySelector('.error-message');
  errorMsg.classList.remove('hidden');
  errorMsg.textContent = message;
  input.focus();
}

inputs.forEach(input => {
  input.addEventListener('focus', function() {
  if (this.classList.contains('is-invalid')) {
    clearInputError(this); 
  }
});
});

function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s\-]/g, '');
  return phoneRegex.test(cleaned) && cleaned.length >= 10 && cleaned.length <= 15;
}
registerForm.addEventListener("submit", async(e)=>{
    e.preventDefault();
    btnRegister.disabled = true;

    clearAllErrors();
    
    const password = document.querySelector('[name="password"]');
    if(password.value.length <8){
        console.log('Lozinka pre kratka.');
        showInputError(password, 'Lozinka mora sadržavati minimalno 8 znakova!')
        btnRegister.disabled = false;
        return;
    }

    const phone = document.querySelector('[name="phone_number"]');
    if (!phone.value || !isValidPhone(phone.value)) {
        console.log("Unesen pogresan broj mobitela");
        showInputError(phone, 'Unesite ispravno broj mobitela!');
        btnRegister.disabled = false;
        return;
    }

    const business_name = document.querySelector('[name="business_name"]');
    if(business_name.value.trim().length<3){
        console.log('Pogrešno unesen naziv firme');
        showInputError(business_name, 'Naziv firme mora imati minimalno 3 znaka');
        btnRegister.disabled = false;
        return;
    }

    /* Kod validacije ispravnog unosa lozinke i broja mobitela stavljamo na input klasu 'is-invalid' koja će nam trebati da taj input oznacimo nekako 
    te da fokus prebacimo na taj input i onda prilikom ponovnog pocetka pisanja, stavljamo opet hidden klasu span elementu koji prikazuje grešku*/

    const formData = new FormData(registerForm);
    const data = Object.fromEntries(formData);
    console.log(data);

    data.phone_number = phone.value.replace(/[\s\-]/g, '');
    console.log(data);
    try{
        const response = await fetch('/api/v1/auth/register', {
            method: 'POST',
            headers: {'Content-Type' : 'application/json'},
            body: JSON.stringify(data)
        })
        const result = await response.json();
        if(result.success){
          //showToast('Registracija uspješna', 'success', 3000);
          registerForm.reset();
          window.location.href = '/verify-email'
          return;
        }

        //AKO VEĆ POSTOJI UPISANI EMAIL ILI BROJ MOBITELA U BAZI
        if(result.code === 'CONFLICT' && result.error.includes('Email')){
          showToast('Email je već registriran', 'error', 5000);
          return;
        }
        if(result.code === 'CONFLICT' && result.error.includes('Broj mobitela')){
          showToast('Broj mobitela je već registriran', 'error', 5000);
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
    finally {
        btnRegister.disabled = false;
    }

})

