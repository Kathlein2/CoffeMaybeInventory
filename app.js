const API_URL = '/api/apps-script';

let currentInventory = [
  { id: 1, name: 'Arabica Beans', category: 'Coffee Beans', quantity: 25, unit: 'kg' },
  { id: 2, name: 'Whole Milk', category: 'Dairy', quantity: 8, unit: 'L' }
];

let editingItemId = null;

// Initialize Event Listeners on Load
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

  const transForm = document.getElementById('transaction-form');
  if (transForm) {
    transForm.addEventListener('submit', handleTransactionSubmit);
  }

  const itemForm = document.getElementById('item-form');
  if (itemForm) {
    itemForm.addEventListener('submit', saveItem);
  }

  renderInventoryTables();
  populateDropdowns();
  if (dashRows) {
    dashRows.innerHTML = currentInventory.map(item => `
      <tr style="border-bottom: 1px solid #f2ebe4;">
        <td style="padding: 12px 10px; font-weight: 600;">${item.name}</td>
        <td style="padding: 12px 10px; color: #666;">${item.category}</td>
        <td style="padding: 12px 10px;">${item.quantity}</td>
        <td style="padding: 12px 10px;">${item.unit || 'pcs'}</td>
        <td style="padding: 12px 10px;">
          <button onclick="openEditModal('${item.id}')" style="background: #8b5a36; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 4px;">✏️ Edit</button>
          <button onclick="deleteItem('${item.id}')" style="background: #a93226; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">🗑️ Delete</button>
        </td>
      </tr>
    `).join('');
  }
});

// Navigation Controller
function showView(viewId) {
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add('active');
  }

  if (viewId === 'view-dashboard' || viewId === 'view-inventory' || viewId === 'view-transactions') {
    populateDropdowns();
    loadInventoryData();
  }
}

// Populate Item Dropdowns for Select Controls
function populateDropdowns() {
  const transSelect = document.getElementById('trans-item-select');
  if (transSelect) {
    transSelect.innerHTML = currentInventory.length
      ? currentInventory.map(item => `<option value="${item.name}">${item.name} (${item.quantity} ${item.unit || 'pcs'})</option>`).join('')
      : '<option value="">No items available</option>';
  }

  const editSelect = document.getElementById('item-name-select');
  if (editSelect) {
    editSelect.innerHTML = currentInventory.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
  }
}

// ================= CRUD & TABLE RENDERING =================

function renderInventoryTables() {
  const dashRows = document.getElementById('dashboard-inventory-rows');
  const fullRows = document.getElementById('full-inventory-rows');

  if (fullRows) {
    fullRows.innerHTML = currentInventory.map(item => `
      <tr style="border-bottom: 1px solid #f2ebe4;">
        <td style="padding: 12px; font-weight: 600;">${item.name}</td>
        <td style="padding: 12px; color: #666;">${item.category}</td>
        <td style="padding: 12px;">${item.quantity}</td>
        <td style="padding: 12px;">${item.unit || 'pcs'}</td>
        <td style="padding: 12px;">
          <button onclick="openEditModal(${item.id})" style="background: #8b5a36; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; margin-right: 4px;">✏️ Edit</button>
          <button onclick="deleteItem(${item.id})" style="background: #a93226; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer;">🗑️ Delete</button>
        </td>
      </tr>
    `).join('');
  }

  if (dashRows) {
    dashRows.innerHTML = currentInventory.slice(0, 5).map(item => `
      <tr style="border-bottom: 1px solid #f2ebe4;">
        <td style="padding: 12px 10px; font-weight: 600;">${item.name}</td>
        <td style="padding: 12px 10px; color: #666;">${item.category}</td>
        <td style="padding: 12px 10px;">${item.quantity}</td>
        <td style="padding: 12px 10px;">${item.unit || 'pcs'}</td>
      </tr>
    `).join('');
  }

  const totalItemsElem = document.getElementById('stat-total-items');
  if (totalItemsElem) {
    totalItemsElem.innerText = `${currentInventory.length} Total Items`;
  }
}

function openAddModal() {
  editingItemId = null;
  const modalTitle = document.getElementById('modal-title');
  const itemForm = document.getElementById('item-form');
  const modal = document.getElementById('crud-modal');
  const nameInput = document.getElementById('item-name-input');
  const nameSelect = document.getElementById('item-name-select');

  if (modalTitle) modalTitle.innerText = '➕ Add New Item';
  if (itemForm) itemForm.reset();

  if (nameInput) nameInput.style.display = 'block';
  if (nameSelect) nameSelect.style.display = 'none';

  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}

function openEditModal(id) {
  const item = currentInventory.find(i => i.id === id);
  if (!item) return;

  editingItemId = id;
  const modalTitle = document.getElementById('modal-title');
  const modal = document.getElementById('crud-modal');
  const nameInput = document.getElementById('item-name-input');
  const nameSelect = document.getElementById('item-name-select');

  if (modalTitle) modalTitle.innerText = '✏️ Edit Item';

  if (nameInput) {
    nameInput.value = item.name;
    nameInput.style.display = 'block';
  }
  if (nameSelect) nameSelect.style.display = 'none';

  document.getElementById('item-category').value = item.category;
  document.getElementById('item-qty').value = item.quantity;
  document.getElementById('item-unit').value = item.unit || 'pcs';

  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}

function closeModal() {
  const modal = document.getElementById('crud-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

async function saveItem(e) {
  e.preventDefault();

  const name = document.getElementById('item-name-input').value.trim();
  const category = document.getElementById('item-category').value.trim();
  const quantity = parseInt(document.getElementById('item-qty').value, 10);
  const unit = document.getElementById('item-unit').value.trim();

  if (editingItemId) {
    currentInventory = currentInventory.map(item =>
      item.id === editingItemId ? { ...item, name, category, quantity, unit } : item
    );
  } else {
    const newItem = { id: Date.now(), name, category, quantity, unit };
    currentInventory.push(newItem);
  }

  renderInventoryTables();
  populateDropdowns();
  closeModal();

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: editingItemId ? 'updateItem' : 'addItem',
        id: editingItemId,
        name,
        category,
        quantity,
        unit
      })
    });
  } catch (err) {
    console.warn('API Sync issue, local state updated.', err);
  }
}

async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) return;

  currentInventory = currentInventory.filter(item => item.id !== id);
  renderInventoryTables();
  populateDropdowns();

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteItem', id })
    });
  } catch (err) {
    console.warn('API Delete issue, local state updated.', err);
  }
}

// ================= STOCK MOVEMENTS =================

async function handleTransactionSubmit(e) {
  e.preventDefault();

  const typeSelect = document.getElementById('trans-type');
  const itemSelect = document.getElementById('trans-item-select');
  const quantityInput = document.getElementById('trans-quantity');

  const transactionType = typeSelect ? typeSelect.value : 'IN';
  const itemName = itemSelect ? itemSelect.value : '';
  const quantity = quantityInput ? parseFloat(quantityInput.value) : 0;

  if (!itemName || isNaN(quantity) || quantity <= 0) {
    alert('Please select an item and enter a valid positive quantity.');
    return;
  }

  currentInventory.forEach(item => {
    if (item.name.toLowerCase() === itemName.toLowerCase()) {
      if (transactionType === 'IN') {
        item.quantity += quantity;
      } else {
        item.quantity = Math.max(0, item.quantity - quantity);
      }
    }
  });

  renderInventoryTables();
  populateDropdowns();

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'recordTransaction',
        type: transactionType,
        itemName,
        quantity
      })
    });
  } catch (err) {
    console.warn('Backend sync issue, recorded locally.', err);
  }

  e.target.reset();
  showView('view-dashboard');
}

// ================= AUTHENTICATION & API =================

let isSubmitting = false;

async function handleLoginSubmit() {
  if (isSubmitting) return;

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
      populateDropdowns();
    }
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

function logout() {
  location.reload();
}s
