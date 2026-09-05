const API_URL = '/api/apps-script';
let currentInventory = [];

// DOM Initializer
document.addEventListener('DOMContentLoaded', () => {
  // Bind Form Submit Listeners directly
  const step1Form = document.getElementById('login-step-1');
  if (step1Form) {
    step1Form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLoginSubmit();
    });
  }

  const step2Form = document.getElementById('login-step-2');
  if (step2Form) {
    step2Form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleVerifyOtpSubmit();
    });
  }
});

// View Navigation Handler
function showView(viewId) {
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add('active');
  }

  if (viewId === 'view-dashboard' || viewId === 'view-inventory') {
    loadInventoryData();
  }
}

// 1. Step 1 Login Submission
async function handleLoginSubmit() {
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');

  if (!usernameInput || !passwordInput) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    alert('Please enter both username and password.');
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username, password })
    });
    const result = await response.json();

    if (result.ok) {
      document.getElementById('login-step-1').classList.add('hidden');
      document.getElementById('login-step-2').classList.remove('hidden');
      alert('Verification code sent to your email!');
    } else {
      alert(result.message || 'Invalid credentials.');
    }
  } catch (err) {
    alert('Backend connection error: ' + err.message);
  }
}

// 2. Step 2 OTP Verification
async function handleVerifyOtpSubmit() {
  const otpInput = document.getElementById('login-otp');
  if (!otpInput) return;

  const otp = otpInput.value.trim();
  if (!otp) {
    alert('Please enter the verification code.');
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verifyOtp', otp })
    });
    const result = await response.json();

    if (result.ok) {
      // Hide login, reveal main application dashboard
      showView('view-dashboard');
    } else {
      alert(result.message || 'Invalid OTP code.');
    }
  } catch (err) {
    alert('Verification error: ' + err.message);
  }
}

// 3. Load Data from Google Sheets
async function loadInventoryData() {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getItems' })
    });
    const result = await response.json();

    if (result.ok) {
      currentInventory = result.items || [];
      const totalItemsElem = document.getElementById('stat-total-items');
      if (totalItemsElem) {
        totalItemsElem.innerText = currentInventory.length;
      }
    }
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

// 4. Reset & Logout
function logout() {
  location.reload();
}
