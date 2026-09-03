function setupCoffeeMaybeSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  const definitions = {
    Users: [
      ["id", "username", "passwordHash", "salt", "role", "failedAttempts", "lockedUntil", "email"],
      ["U001", "manager", "REPLACE_WITH_HASH", "REPLACE_WITH_SALT", "Inventory Manager", 0, "", "YOUR_EMAIL_HERE"]
    ],
    Inventory: [
      ["id", "name", "category", "quantity", "reorderLevel", "unitCost", "updatedAt"],
      ["INV-001", "Coffee Beans", "Raw Materials", 20, 5, 350, new Date()],
      ["INV-002", "Milk", "Dairy", 15, 5, 95, new Date()],
      ["INV-003", "Sugar", "Sweeteners", 8, 3, 80, new Date()]
    ],
    Config: [
      ["setting", "value"],
      ["lowStockThreshold", 5]
    ],
    AuditLog: [
      ["datetime", "username", "action", "details"]
    ],
    OTP: [
      ["pendingToken", "username", "otp", "expires", "used"]
    ],
    Sessions: [
      ["token", "username", "expires"]
    ]
  };

  Object.keys(definitions).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);

    sh.clearContents();

    const data = definitions[name];
    sh.getRange(1, 1, data.length, data[0].length).setValues(data);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, data[0].length);
  });
}

function createPasswordHashForSetup() {
  const password = Browser.inputBox(
    "Create Manager Password",
    "Enter the password you want to use:",
    Browser.Buttons.OK_CANCEL
  );

  if (password === "cancel") return;

  const salt = randomToken().slice(0, 24);
  const hash = hashPassword(password, salt);

  Logger.log("SALT: " + salt);
  Logger.log("HASH: " + hash);
  Logger.log("Copy both values into Users!D2 and Users!C2.");
}
