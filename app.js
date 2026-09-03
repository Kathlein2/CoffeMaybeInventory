let state = {
  token: localStorage.getItem("cm_token"),
  username: localStorage.getItem("cm_username"),
  items: []
};

const $ = id => document.getElementById(id);

async function api(action, data = {}) {
  const response = await fetch("/api/apps-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      token: state.token,
      ...data
    })
  });

  const result = await response.json();

  if (!result.ok && result.authRequired) {
    logout();
    throw new Error(result.message || "Session expired.");
  }

  return result;
}

function showMessage(id, text, ok = false) {
  const el = $(id);
  el.textContent = text || "";
  el.style.color = ok ? "#287a3e" : "#9b2c2c";
}

function show(page) {
  ["loginPage", "otpPage", "appPage"].forEach(id => $(id).classList.add("hidden"));
  $(page).classList.remove("hidden");
}

async function login(event) {
  event.preventDefault();
  showMessage("loginMessage", "Checking login...");

  try {
    const result = await api("login", {
      username: $("username").value.trim(),
      password: $("password").value
    });

    if (!result.ok) {
      showMessage("loginMessage", result.message);
      return;
    }

    state.username = $("username").value.trim();
    localStorage.setItem("cm_username", state.username);
    state.token = result.pendingToken;

    show("otpPage");
    showMessage("otpMessage", result.message, true);
  } catch (e) {
    showMessage("loginMessage", e.message);
  }
}

async function verifyOtp(event) {
  event.preventDefault();
  showMessage("otpMessage", "Verifying...");

  try {
    const result = await api("verifyOtp", {
      pendingToken: state.token,
      otp: $("otp").value.trim()
    });

    if (!result.ok) {
      showMessage("otpMessage", result.message);
      return;
    }

    state.token = result.token;
    localStorage.setItem("cm_token", state.token);
    show("appPage");
    $("userBadge").textContent = "Inventory Manager: " + state.username;
    await loadDashboard();
  } catch (e) {
    showMessage("otpMessage", e.message);
  }
}

async function loadDashboard() {
  const result = await api("dashboard");
  if (!result.ok) {
    showMessage("appMessage", result.message);
    return;
  }

  state.items = result.inventory || [];
  renderInventory(result.inventory || []);
  renderAudit(result.audit || []);

  $("lowStockThreshold").value = result.config.lowStockThreshold;
  updateStats(result.inventory || [], Number(result.config.lowStockThreshold));
}

function updateStats(items, threshold) {
  $("totalItems").textContent = items.length;
  $("lowStock").textContent = items.filter(x => Number(x.quantity) <= threshold).length;
  $("totalUnits").textContent = items.reduce((sum, x) => sum + Number(x.quantity || 0), 0);
}

function renderInventory(items) {
  const body = $("inventoryBody");
  body.innerHTML = "";

  items.forEach(item => {
    const row = document.createElement("tr");
    const low = Number(item.quantity) <= Number($("lowStockThreshold").value || 0);

    row.innerHTML = `
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td class="${low ? "low" : ""}">${item.quantity}</td>
      <td>${item.reorderLevel}</td>
      <td>₱${Number(item.unitCost).toFixed(2)}</td>
      <td>
        <button onclick="editItem('${item.id}')">Edit</button>
        <button class="secondary" onclick="deleteItem('${item.id}')">Delete</button>
      </td>
    `;
    body.appendChild(row);
  });
}

function renderAudit(rows) {
  $("auditBody").innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.datetime)}</td>
      <td>${escapeHtml(r.username)}</td>
      <td>${escapeHtml(r.action)}</td>
      <td>${escapeHtml(r.details)}</td>
    </tr>
  `).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

$("addBtn").addEventListener("click", () => {
  $("itemForm").reset();
  $("itemId").value = "";
  $("dialogTitle").textContent = "Add Inventory Item";
  $("itemDialog").showModal();
});

$("cancelDialog").addEventListener("click", () => $("itemDialog").close());

$("itemForm").addEventListener("submit", async event => {
  event.preventDefault();

  const data = {
    id: $("itemId").value,
    name: $("itemName").value.trim(),
    category: $("itemCategory").value.trim(),
    quantity: Number($("itemQuantity").value),
    reorderLevel: Number($("itemReorder").value),
    unitCost: Number($("itemCost").value)
  };

  const result = await api(data.id ? "updateItem" : "addItem", { item: data });

  if (!result.ok) {
    alert(result.message);
    return;
  }

  $("itemDialog").close();
  showMessage("appMessage", "Inventory saved.", true);
  await loadDashboard();
});

window.editItem = function(id) {
  const item = state.items.find(x => String(x.id) === String(id));
  if (!item) return;

  $("itemId").value = item.id;
  $("itemName").value = item.name;
  $("itemCategory").value = item.category;
  $("itemQuantity").value = item.quantity;
  $("itemReorder").value = item.reorderLevel;
  $("itemCost").value = item.unitCost;
  $("dialogTitle").textContent = "Edit Inventory Item";
  $("itemDialog").showModal();
};

window.deleteItem = async function(id) {
  if (!confirm("Delete this inventory item?")) return;

  const result = await api("deleteItem", { id });
  if (!result.ok) {
    alert(result.message);
    return;
  }

  showMessage("appMessage", "Item deleted.", true);
  await loadDashboard();
};

$("configForm").addEventListener("submit", async event => {
  event.preventDefault();

  const result = await api("updateConfig", {
    lowStockThreshold: Number($("lowStockThreshold").value)
  });

  showMessage("appMessage", result.message, result.ok);
  if (result.ok) await loadDashboard();
});

$("logoutBtn").addEventListener("click", logout);

function logout() {
  state.token = null;
  state.username = null;
  localStorage.removeItem("cm_token");
  localStorage.removeItem("cm_username");
  $("loginForm").reset();
  $("otpForm").reset();
  show("loginPage");
}

$("loginForm").addEventListener("submit", login);
$("otpForm").addEventListener("submit", verifyOtp);

if (state.token && state.username) {
  show("appPage");
  $("userBadge").textContent = "Inventory Manager: " + state.username;
  loadDashboard().catch(() => logout());
} else {
  show("loginPage");
}
