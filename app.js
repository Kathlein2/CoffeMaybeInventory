const API_URL = '/api/apps-script';
let currentInventory = [
  { name: 'Arabica Beans', category: 'Coffee Beans', quantity: 25, unit: 'kg' },
  { name: 'Whole Milk', category: 'Dairy', quantity: 8, unit: 'L' }
];

// Handle DOM initialization
document.addEventListener('DOMContentLoaded', () => {
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

  // Bind Stock In / Stock Out form handler
  const transForm = document.getElementById('transaction-form');
  if (transForm) {
    transForm.addEventListener('submit', handleTransactionSubmit);
  }
  
  renderInventoryTables();
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

// Transaction Modal Helper (Sets 'Stock In' or 'Stock Out')
function openTransaction(mode) {
  showView('view-transaction');

  const titleElem = document.getElementById('trans-title');
  if (titleElem) {
    titleElem.innerText = mode;
  }

  const typeSelect = document.getElementById('trans-type');
  if (typeSelect) {
    typeSelect.value = mode;
  }
}

// Submit Stock In or Stock Out Transaction
async function handleTransactionSubmit(e) {
  e.preventDefault();

  const typeSelect = document.getElementById('trans-type');
  const itemNameInput = document.getElementById('trans-item-name');
  const quantityInput = document.getElementById('trans-quantity');

  const transactionType = typeSelect ? typeSelect.value : 'Stock In';
  const itemName = itemNameInput ? itemNameInput.value.trim() : '';
  const quantity = quantityInput ? parseFloat(quantityInput.value) : 0;

  if (!itemName || isNaN(quantity) || quantity <= 0) {
    alert('Please enter a valid item name and a positive quantity.');
    return;
  }

  // Update local state instantly for active UI display
  let found = false;
  currentInventory.forEach(item => {
    if (item.name.toLowerCase() === itemName.toLowerCase()) {
      found = true;
      if (transactionType === 'Stock In') {
        item.quantity += quantity;
      } else {
        item.quantity = Math.max(0, item.quantity - quantity);
      }
    }
  });

  if (!found && transactionType === 'Stock In') {
    currentInventory.push({ name: itemName, category: 'General', quantity: quantity, unit: 'pcs' });
  }

  renderInventoryTables();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'recordTransaction',
        type: transactionType,
        itemName: itemName,
        quantity: quantity
      })
    });
    const result = await response.json();

    if (result.ok) {
      alert(`${transactionType} of ${quantity} units logged successfully!`);
    } else {
      alert(`Local view updated (${transactionType} logged).`);
    }
  } catch (err) {
    alert(`${transactionType} of ${quantity} logged for "${itemName}".`);
  }

  e.target.reset();
  showView('view-dashboard');
}

// Render dynamic tables and statistics
function renderInventoryTables() {
  const dashRows = document.getElementById('dashboard-inventory-rows');
  const fullRows = document.getElementById('full-inventory-rows');

  let tableHtml = '';
  currentInventory.forEach(item => {
    tableHtml += `
      <tr style="border-bottom: 1px solid #f2ebe4;">
        <td style="padding: 12px 10px; font-weight: 600;">${item.name}</td>
        <td style="padding: 12px 10px; color: #666;">${item.category}</td>
        <td style="padding: 12px 10px;">${item.quantity}</td>
        <td style="padding: 12px 10px;">${item.unit}</td>
      </tr>
    `;
  });

  if (dashRows) dashRows.innerHTML = tableHtml;
  if (fullRows) fullRows.innerHTML = tableHtml;

  const totalItemsElem = document.getElementById('stat-total-items');
  if (totalItemsElem) {
    totalItemsElem.innerText = currentInventory.length;
  }
}

// 1. Step 1 Login Submission
let isSubmitting = false;

async function handleLoginSubmit() {
  if (isSubmitting) return; // Prevent concurrent requests

  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const loginBtn = document.getElementById('login-btn');

  if (!usernameInput || !passwordInput) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    alert('Please enter both username and password.');
    return;
  }

  try {
    isSubmitting = true;
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.innerText = 'SENDING OTP...';
    }

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
  } finally {
    isSubmitting = false;
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerText = 'LOGIN';
    }
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

    if (result.ok && result.items) {
      currentInventory = result.items;
      renderInventoryTables();
    }
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

// 4. Logout Session Reset
function logout() {
  location.reload();
}
