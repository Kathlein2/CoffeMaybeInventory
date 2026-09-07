let currentInventory = [
  { id: '1', name: 'Coffee Powder', quantity: 8, unit: 'kg', category: 'Beans', status: 'In Stock' },
  { id: '2', name: 'Fresh Milk', quantity: 2, unit: 'L', category: 'Dairy', status: 'Low Stock' },
  { id: '3', name: 'Milk tea powder', quantity: 7, unit: 'kg', category: 'Powder', status: 'In Stock' },
  { id: '4', name: 'Tapioca Pearls', quantity: 10, unit: 'packs', category: 'Toppings', status: 'In Stock' },
  { id: '5', name: 'Brown Sugar', quantity: 6, unit: 'kg', category: 'Syrups', status: 'In Stock' },
  { id: '6', name: 'Coffee Syrup', quantity: 5, unit: 'bottles', category: 'Syrups', status: 'In Stock' }
];

let selectedItemId = null;
let editingItemId = null;

document.addEventListener('DOMContentLoaded', () => {
  const step1 = document.getElementById('login-step-1');
  if (step1) step1.addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('app-layout').classList.remove('hidden');
    renderInventory();
  });

  const transForm = document.getElementById('transaction-form');
  if (transForm) transForm.addEventListener('submit', handleTransaction);

  const itemForm = document.getElementById('item-form');
  if (itemForm) itemForm.addEventListener('submit', saveItem);

  renderInventory();
  populateDropdowns();
});

function navigateTo(viewId) {
  document.querySelectorAll('.sub-view').forEach(view => view.classList.add('hidden'));
  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('active');
}

function renderInventory() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  tbody.innerHTML = currentInventory.map(item => `
    <tr class="${selectedItemId === item.id ? 'selected' : ''}" onclick="selectRow('${item.id}')">
      <td><strong>${item.name}</strong></td>
      <td>${item.quantity}</td>
      <td>${item.unit}</td>
      <td><span style="color: ${item.quantity <= 3 ? '#a93226' : '#27ae60'}; font-weight: bold;">${item.quantity <= 3 ? 'Low Stock' : 'In Stock'}</span></td>
    </tr>
  `).join('');

  document.getElementById('stat-total-items').innerText = currentInventory.length;
  document.getElementById('stat-low-stock').innerText = currentInventory.filter(i => i.quantity <= 3).length;
}

function selectRow(id) {
  selectedItemId = id;
  renderInventory();
}

function filterInventory() {
  const query = document.getElementById('inventory-search').value.toLowerCase();
  const rows = document.querySelectorAll('#inventory-table-body tr');
  
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

function populateDropdowns() {
  const select = document.getElementById('trans-item-select');
  if (!select) return;

  select.innerHTML = currentInventory.map(item => `
    <option value="${item.id}">${item.name} (${item.quantity} ${item.unit})</option>
  `).join('');
}

function openTransactionModal(type) {
  navigateTo('view-transactions');
  const typeSelect = document.getElementById('trans-type');
  if (typeSelect) typeSelect.value = type;
}

function handleTransaction(e) {
  e.preventDefault();
  const itemId = document.getElementById('trans-item-select').value;
  const qty = parseFloat(document.getElementById('trans-quantity').value);
  const type = document.getElementById('trans-type').value;

  currentInventory = currentInventory.map(item => {
    if (item.id === itemId) {
      const updatedQty = type === 'IN' ? item.quantity + qty : Math.max(0, item.quantity - qty);
      return { ...item, quantity: updatedQty };
    }
    return item;
  });

  renderInventory();
  populateDropdowns();
  alert('Transaction saved successfully!');
  navigateTo('view-dashboard');
}

function openAddModal() {
  editingItemId = null;
  document.getElementById('modal-title').innerText = 'Add Item';
  document.getElementById('item-form').reset();
  document.getElementById('crud-modal').classList.remove('hidden');
}

function openSelectedEdit() {
  if (!selectedItemId) {
    alert('Please select an item from the table first.');
    return;
  }
  const item = currentInventory.find(i => i.id === selectedItemId);
  if (!item) return;

  editingItemId = item.id;
  document.getElementById('modal-title').innerText = 'Edit Item';
  document.getElementById('item-name-input').value = item.name;
  document.getElementById('item-category').value = item.category;
  document.getElementById('item-qty').value = item.quantity;
  document.getElementById('item-unit').value = item.unit;

  document.getElementById('crud-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('crud-modal').classList.add('hidden');
}

function saveItem(e) {
  e.preventDefault();
  const name = document.getElementById('item-name-input').value;
  const category = document.getElementById('item-category').value;
  const quantity = parseFloat(document.getElementById('item-qty').value);
  const unit = document.getElementById('item-unit').value;

  if (editingItemId) {
    currentInventory = currentInventory.map(i => i.id === editingItemId ? { ...i, name, category, quantity, unit } : i);
  } else {
    currentInventory.push({ id: String(Date.now()), name, category, quantity, unit, status: 'In Stock' });
  }

  renderInventory();
  populateDropdowns();
  closeModal();
}

function deleteSelected() {
  if (!selectedItemId) {
    alert('Please select an item to delete.');
    return;
  }
  if (confirm('Delete selected item?')) {
    currentInventory = currentInventory.filter(i => i.id !== selectedItemId);
    selectedItemId = null;
    renderInventory();
    populateDropdowns();
  }
}

function logout() {
  location.reload();
}
