document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLoginSubmit();
    });
  }
});
const API_URL = '/api/apps-script';
let currentInventory = [];
let selectedItemId = null;

// Page View Navigation
function showView(viewId) {
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });
  
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
  }
}
  
  if (viewId === 'view-inventory' || viewId === 'view-dashboard') {
    loadInventoryData();
  }
}

// 1. Authentication Handlers
async function handleLoginSubmit() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

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
      alert('OTP code sent to your email!');
    } else {
      alert(result.message || 'Login failed.');
    }
  } catch (err) {
    alert('Error connecting to backend: ' + err.message);
  }
}

async function handleVerifyOtpSubmit() {
  const otp = document.getElementById('login-otp').value;

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
    alert('Error verifying OTP: ' + err.message);
  }
}

// 2. Fetch & Render Inventory Data
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
      renderInventoryList(currentInventory);
      updateDashboardStats(currentInventory);
      populateTransactionDropdowns(currentInventory);
    }
  } catch (err) {
    console.error('Failed to fetch inventory:', err);
  }
}

function renderInventoryList(items) {
  const container = document.getElementById('inventory-list-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (items.length === 0) {
    container.innerHTML = '<div class="item-row">No items found.</div>';
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'item-row';
    if (selectedItemId === item.id) row.style.borderColor = '#000';
    
    const isLow = Number(item.quantity) <= Number(item.reorderLevel || 2);
    const statusText = isLow ? 'low stock' : 'In Stock';
    
    row.innerHTML = `
      <span><strong>${item.name}</strong></span>
      <span>${item.quantity}</span>
      <span>${item.unitCost || 'pcs'}</span>
      <span style="color: ${isLow ? 'red' : 'green'}; font-weight: bold;">${statusText}</span>
    `;
    
    row.onclick = () => {
      selectedItemId = item.id;
      renderInventoryList(items);
    };
    
    container.appendChild(row);
  });
}

function updateDashboardStats(items) {
  const totalItems = items.length;
  const lowStockItems = items.filter(i => Number(i.quantity) <= Number(i.reorderLevel || 2)).length;

  if (document.getElementById('stat-total-items')) {
    document.getElementById('stat-total-items').innerText = totalItems;
  }
  if (document.getElementById('stat-low-stock')) {
    document.getElementById('stat-low-stock').innerText = lowStockItems;
  }
}

// 3. Transactions (Stock In / Stock Out)
function openTransaction(type) {
  showView('view-transaction');
  const typeSelect = document.getElementById('trans-type');
  if (typeSelect) typeSelect.value = type;
  updateStockCalculations();
}

function populateTransactionDropdowns(items) {
  const select = document.getElementById('trans-item-select');
  if (!select) return;
  select.innerHTML = '';
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.name;
    select.appendChild(opt);
  });
  updateStockCalculations();
}

function updateStockCalculations() {
  const select = document.getElementById('trans-item-select');
  if (!select || !select.value) return;
  
  const item = currentInventory.find(i => i.id.toString() === select.value.toString());
  if (!item) return;

  const currentQty = Number(item.quantity);
  const transQty = Number(document.getElementById('trans-qty').value || 0);
  const type = document.getElementById('trans-type').value;

  const updatedQty = type === 'Stock In' ? currentQty + transQty : currentQty - transQty;

  document.getElementById('calc-current-stock').innerText = `${currentQty} ${item.unitCost || 'units'}`;
  document.getElementById('calc-updated-stock').innerText = `${updatedQty} ${item.unitCost || 'units'}`;
}

async function submitTransaction() {
  const select = document.getElementById('trans-item-select');
  if (!select.value) return;

  const item = currentInventory.find(i => i.id.toString() === select.value.toString());
  const transQty = Number(document.getElementById('trans-qty').value || 0);
  const type = document.getElementById('trans-type').value;

  const updatedQty = type === 'Stock In' ? Number(item.quantity) + transQty : Number(item.quantity) - transQty;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addItem',
        item: {
          id: item.id,
          name: item.name,
          category: item.category || 'General',
          quantity: updatedQty,
          reorderLevel: item.reorderLevel || 2,
          unitCost: item.unitCost || 0
        }
      })
    });
    
    const res = await response.json();
    if (res.ok) {
      alert('Transaction completed successfully!');
      showView('view-dashboard');
    } else {
      alert('Transaction failed: ' + res.message);
    }
  } catch (err) {
    alert('Error submitting transaction: ' + err.message);
  }
}

function logout() {
  location.reload();
}
