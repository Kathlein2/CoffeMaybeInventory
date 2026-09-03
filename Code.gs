const CONFIG = {
  SHEET_ID: "PASTE_YOUR_GOOGLE_SHEET_ID_HERE",
  OTP_EXPIRY_MINUTES: 10,
  SESSION_MINUTES: 60,
  MAX_FAILED_LOGINS: 5,
  LOCK_MINUTES: 15
};

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const result = route(body);
    return json(result);
  } catch (err) {
    return json({ ok: false, message: "Server error: " + err.message });
  }
}

function route(body) {
  switch (body.action) {
    case "login": return login(body);
    case "verifyOtp": return verifyOtp(body);
    case "dashboard": return dashboard(body);
    case "addItem": return addItem(body);
    case "updateItem": return updateItem(body);
    case "deleteItem": return deleteItem(body);
    case "updateConfig": return updateConfig(body);
    default: return { ok: false, message: "Unknown action." };
  }
}

function getSS() {
  return SpreadsheetApp.openById(CONFIG.SHEET_ID);
}

function getSheet(name) {
  const sh = getSS().getSheetByName(name);
  if (!sh) throw new Error("Missing sheet: " + name);
  return sh;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sha256(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    text,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function hashPassword(password, salt) {
  return sha256(salt + ":" + password);
}

function randomToken() {
  return Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
}

function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function now() {
  return new Date();
}

function formatDate(date) {
  return Utilities.formatDate(
    new Date(date),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );
}

function findUser(username) {
  const sh = getSheet("Users");
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === String(username).toLowerCase()) {
      return {
        row: i + 1,
        id: values[i][0],
        username: values[i][1],
        passwordHash: values[i][2],
        salt: values[i][3],
        role: values[i][4],
        failedAttempts: Number(values[i][5] || 0),
        lockedUntil: values[i][6] ? new Date(values[i][6]) : null,
        email: values[i][7]
      };
    }
  }
  return null;
}

function login(body) {
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!username || !password) {
    return { ok: false, message: "Username and password are required." };
  }

  const user = findUser(username);

  if (!user || user.role !== "Inventory Manager") {
    return { ok: false, message: "Invalid credentials or unauthorized role." };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > now().getTime()) {
    return {
      ok: false,
      message: "Account temporarily locked. Try again later."
    };
  }

  if (user.lockedUntil) {
    updateUserSecurity(user.row, 0, "");
  }

  if (hashPassword(password, user.salt) !== user.passwordHash) {
    const failed = user.failedAttempts + 1;

    if (failed >= CONFIG.MAX_FAILED_LOGINS) {
      const until = new Date(now().getTime() + CONFIG.LOCK_MINUTES * 60000);
      updateUserSecurity(user.row, 0, until);
      audit(username, "LOGIN_LOCK", "Account locked after repeated failed attempts.");
      return { ok: false, message: "Too many failed attempts. Account locked temporarily." };
    }

    updateUserSecurity(user.row, failed, "");
    return {
      ok: false,
      message: "Invalid username or password. Attempts remaining: " +
        (CONFIG.MAX_FAILED_LOGINS - failed)
    };
  }

  updateUserSecurity(user.row, 0, "");

  const pendingToken = randomToken();
  const otp = randomOtp();
  const expires = new Date(now().getTime() + CONFIG.OTP_EXPIRY_MINUTES * 60000);

  getSheet("OTP").appendRow([
    pendingToken,
    user.username,
    otp,
    expires,
    false
  ]);

  // Sends the code to the email stored in the Users sheet.
  MailApp.sendEmail({
    to: user.email,
    subject: "Coffee Maybe Inventory Verification Code",
    body: "Your verification code is: " + otp +
      "\n\nThis code expires in " + CONFIG.OTP_EXPIRY_MINUTES + " minutes."
  });

  audit(username, "LOGIN_PASSWORD_OK", "Password accepted; verification code issued.");

  return {
    ok: true,
    pendingToken,
    message: "A verification code was sent to the registered email."
  };
}

function verifyOtp(body) {
  const token = String(body.pendingToken || "");
  const otp = String(body.otp || "").trim();

  const sh = getSheet("OTP");
  const values = sh.getDataRange().getValues();

  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === token) {
      const username = values[i][1];
      const code = String(values[i][2]);
      const expires = new Date(values[i][3]);
      const used = values[i][4] === true || String(values[i][4]).toLowerCase() === "true";

      if (used) return { ok: false, message: "Code already used." };
      if (expires.getTime() < now().getTime()) {
        return { ok: false, message: "Verification code expired." };
      }
      if (code !== otp) {
        return { ok: false, message: "Invalid verification code." };
      }

      sh.getRange(i + 1, 5).setValue(true);

      const sessionToken = randomToken();
      getSheet("Sessions").appendRow([
        sessionToken,
        username,
        new Date(now().getTime() + CONFIG.SESSION_MINUTES * 60000)
      ]);

      audit(username, "LOGIN_SUCCESS", "Two-step verification completed.");

      return { ok: true, token: sessionToken };
    }
  }

  return { ok: false, message: "Verification request not found." };
}

function requireManager(token) {
  if (!token) {
    return { ok: false, message: "Authentication required.", authRequired: true };
  }

  const sh = getSheet("Sessions");
  const values = sh.getDataRange().getValues();

  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === token) {
      const expires = new Date(values[i][2]);

      if (expires.getTime() < now().getTime()) {
        return { ok: false, message: "Session expired.", authRequired: true };
      }

      const user = findUser(values[i][1]);
      if (!user || user.role !== "Inventory Manager") {
        return { ok: false, message: "Unauthorized.", authRequired: true };
      }

      return { ok: true, user };
    }
  }

  return { ok: false, message: "Invalid session.", authRequired: true };
}

function dashboard(body) {
  const auth = requireManager(body.token);
  if (!auth.ok) return auth;

  return {
    ok: true,
    inventory: readInventory(),
    config: readConfig(),
    audit: readAudit()
  };
}

function readInventory() {
  const values = getSheet("Inventory").getDataRange().getValues();

  return values.slice(1).filter(r => r[0]).map(r => ({
    id: String(r[0]),
    name: r[1],
    category: r[2],
    quantity: Number(r[3] || 0),
    reorderLevel: Number(r[4] || 0),
    unitCost: Number(r[5] || 0),
    updatedAt: r[6] ? formatDate(r[6]) : ""
  }));
}

function addItem(body) {
  const auth = requireManager(body.token);
  if (!auth.ok) return auth;

  const item = validateItem(body.item);
  const id = "INV-" + Date.now();

  getSheet("Inventory").appendRow([
    id, item.name, item.category, item.quantity,
    item.reorderLevel, item.unitCost, now()
  ]);

  audit(auth.user.username, "ADD_ITEM", JSON.stringify(item));
  return { ok: true, message: "Item added.", id };
}

function updateItem(body) {
  const auth = requireManager(body.token);
  if (!auth.ok) return auth;

  const item = validateItem(body.item);
  const sh = getSheet("Inventory");
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(item.id)) {
      sh.getRange(i + 1, 2, 1, 6).setValues([[
        item.name, item.category, item.quantity,
        item.reorderLevel, item.unitCost, now()
      ]]);

      audit(auth.user.username, "UPDATE_ITEM", "Updated " + item.id);
      return { ok: true, message: "Item updated." };
    }
  }

  return { ok: false, message: "Item not found." };
}

function deleteItem(body) {
  const auth = requireManager(body.token);
  if (!auth.ok) return auth;

  const sh = getSheet("Inventory");
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(body.id)) {
      sh.deleteRow(i + 1);
      audit(auth.user.username, "DELETE_ITEM", "Deleted " + body.id);
      return { ok: true, message: "Item deleted." };
    }
  }

  return { ok: false, message: "Item not found." };
}

function validateItem(item) {
  item = item || {};

  const name = String(item.name || "").trim();
  const category = String(item.category || "").trim();
  const quantity = Number(item.quantity);
  const reorderLevel = Number(item.reorderLevel);
  const unitCost = Number(item.unitCost);

  if (!name || !category) throw new Error("Name and category are required.");
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Invalid quantity.");
  if (!Number.isFinite(reorderLevel) || reorderLevel < 0) throw new Error("Invalid reorder level.");
  if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error("Invalid unit cost.");

  return {
    id: String(item.id || ""),
    name, category, quantity, reorderLevel, unitCost
  };
}

function readConfig() {
  const sh = getSheet("Config");
  const value = sh.getRange("B2").getValue();
  return { lowStockThreshold: Number(value || 5) };
}

function updateConfig(body) {
  const auth = requireManager(body.token);
  if (!auth.ok) return auth;

  const value = Number(body.lowStockThreshold);

  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    return { ok: false, message: "Configuration value is outside the allowed range." };
  }

  getSheet("Config").getRange("B2").setValue(value);
  audit(
    auth.user.username,
    "CONFIG_CHANGE",
    "Low-stock threshold changed to " + value
  );

  return { ok: true, message: "Configuration updated and recorded in the audit log." };
}

function updateUserSecurity(row, failedAttempts, lockedUntil) {
  const sh = getSheet("Users");
  sh.getRange(row, 6).setValue(failedAttempts);
  sh.getRange(row, 7).setValue(lockedUntil || "");
}

function audit(username, action, details) {
  getSheet("AuditLog").appendRow([
    now(),
    username,
    action,
    details
  ]);
}

function readAudit() {
  const values = getSheet("AuditLog").getDataRange().getValues();

  return values.slice(1).reverse().slice(0, 100).map(r => ({
    datetime: r[0] ? formatDate(r[0]) : "",
    username: r[1],
    action: r[2],
    details: r[3]
  }));
}
