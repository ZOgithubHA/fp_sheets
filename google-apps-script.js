/**
 * ==============================================================================
 * Google Apps Script для автоматической синхронизации IT Asset & Google Таблицы
 * ДВУСТОРОННИЙ УЧЕТ: Лист сотрудников («Лист1») + Лист прихода («Склад»)
 * + АВТОМАТИЧЕСКОЕ СОХРАНЕНИЕ ФОТО НАКЛАДНЫХ В GOOGLE ДИСК:
 * Папка: Karta_FP > накладной (ID: 1wqjqxxPkJ5lpszva5LzaC88XFKiOO6HJ)
 * Ссылка: https://drive.google.com/drive/folders/1wqjqxxPkJ5lpszva5LzaC88XFKiOO6HJ?hl=ru
 * ==============================================================================
 * 
 * 📌 ПОШАГОВАЯ ИНСТРУКЦИЯ (КУДА СКОПИРОВАТЬ И ВСТАВИТЬ):
 * 
 * 1. Откройте вашу Google Таблицу в браузере.
 * 2. В верхнем меню выберите: «Расширения» (Extensions) → «Apps Script».
 * 3. В открывшемся редакторе удалите весь старый код (нажмите Ctrl + A, затем Delete).
 * 4. Вставьте ПОЛНОСТЬЮ этот обновленный код (нажмите Ctrl + V).
 * 5. Нажмите значок «Сохранить» 💾 (или клавиши Ctrl + S).
 * 
 * 6. ⚠️ КАК ПОЛУЧИТЬ ПРАВИЛЬНУЮ ССЫЛКУ ВЕБ-ПРИЛОЖЕНИЯ:
 *    - В правом верхнем углу нажмите синюю кнопку «Развернуть» (Deploy)
 *    - Выберите: «Новое развертывание» (New deployment)
 *    - Слева нажмите на значок шестерёнки ⚙️ «Выберите тип» → «Веб-приложение» (Web app)
 *    - Заполните поля:
 *        • Описание: IT Учет + Склад + Google Drive
 *        • Выполнять от имени: «Меня» (Me)
 *        • ❗ У КОГО ЕСТЬ ДОСТУП: выберите «ВСЕ» (Anyone)! (Это очень важно!)
 *    - Нажмите синюю кнопку «Развернуть» (Deploy).
 *    - Если Google запросит доступ к Таблицам и Диску (Drive), нажмите «Предоставить доступ» (Authorize access) 
 *      → выберите свой Google аккаунт → «Дополнительно» (Advanced) → «Перейти к проекту (небезопасно)».
 *    - Скопируйте полученный URL веб-приложения (он заканчивается на /exec).
 * 
 * 7. Вставьте этот URL в поле в интерфейсе сайта (вкладка «Склад» или Telegram-бот) и нажмите «Сохранить».
 * ==============================================================================
 */

// 📁 Конфигурация Google Диска для накладных и документов
var GOOGLE_DRIVE_FOLDER_ID = "1wqjqxxPkJ5lpszva5LzaC88XFKiOO6HJ";
var GOOGLE_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1wqjqxxPkJ5lpszva5LzaC88XFKiOO6HJ?hl=ru";

// Регламентированные колонки листа «Склад» (8 колонок)
var WAREHOUSE_HEADERS = [
  "№ П/П",
  "Типы",
  "Марка и модели",
  "Единица измерения (м, шт.)",
  "Запись документа",
  "Кто принял",
  "Движение товаров",
  "Основание"
];

// Регламентированные колонки листа сотрудников «Лист1» (10 колонок)
var EMPLOYEE_HEADERS = [
  "Идентификатор ПК",
  "Имя пользователя",
  "Должность",
  "Тип",
  "Марка",
  "S/N",
  "Отметка времени",
  "Кто выдал",
  "Движения",
  "Запись"
];

/**
 * Меню в Google Таблице при открытии
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu("📦 ИТ Склад & Диск")
    .addItem("📁 Открыть папку накладных на Google Диске", "openDriveFolder")
    .addItem("🔄 Проверить синхронизацию (Лист1 + Склад)", "testConnection")
    .addItem("ℹ️ Статус Webhook и остатков", "showStatusDialog")
    .addToUi();
}

function openDriveFolder() {
  var html = '<div style="font-family:sans-serif;padding:15px;line-height:1.6;">' +
    '<h3>📁 Папка накладных на Google Диске:</h3>' +
    '<p><a href="' + GOOGLE_DRIVE_FOLDER_URL + '" target="_blank" style="display:inline-block;padding:10px 16px;background:#10b981;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Перейти в папку накладных ↗</a></p>' +
    '<p style="color:#64748b;font-size:12px;">ID папки: ' + GOOGLE_DRIVE_FOLDER_ID + '</p>' +
    '</div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(400).setHeight(180), "Google Диск");
}

function showStatusDialog() {
  var ctx = getSheets();
  var whLast = ctx.warehouseSheet.getLastRow();
  var empLast = ctx.employeeSheet.getLastRow();
  var msg = "Статус Google Таблицы:\n\n" +
    "• Лист «Склад»: " + whLast + " строк\n" +
    "• Лист «" + ctx.employeeSheet.getName() + "»: " + empLast + " строк\n" +
    "• Папка Google Диска подключена (ID: " + GOOGLE_DRIVE_FOLDER_ID + ")\n\n" +
    "Система полностью готова к приему фото накладных и синхронизации остатков!";
  SpreadsheetApp.getUi().alert("Статус системы", msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Получить целевую папку на Google Диске для сохранения фото накладных и документов
 */
function getDriveFolder() {
  try {
    if (GOOGLE_DRIVE_FOLDER_ID) {
      return DriveApp.getFolderById(GOOGLE_DRIVE_FOLDER_ID);
    }
  } catch (e) {
    Logger.log("Поиск папки по ID не удался: " + e.toString());
  }

  // Запасной поиск папки по имени
  var folders = DriveApp.getFoldersByName("накладной");
  if (folders.hasNext()) {
    return folders.next();
  }

  var kartaFolders = DriveApp.getFoldersByName("Karta_FP");
  if (kartaFolders.hasNext()) {
    var kf = kartaFolders.next();
    var sub = kf.getFoldersByName("накладной");
    if (sub.hasNext()) return sub.next();
    return kf.createFolder("накладной");
  }

  return DriveApp.getRootFolder();
}

/**
 * Сохранение фото/файла накладной прямо в Google Диск
 * @param {string} base64Data - строка base64 изображения
 * @param {string} fileName - желаемое имя файла
 * @param {string} mimeType - mime-тип файла (по умолчанию image/jpeg)
 * @returns {object} { fileId, fileUrl, fileName, folderUrl }
 */
function saveFileToDrive(base64Data, fileName, mimeType) {
  try {
    if (!base64Data || typeof base64Data !== "string") return null;

    var cleanBase64 = base64Data;
    if (cleanBase64.indexOf(",") > -1) {
      cleanBase64 = cleanBase64.split(",")[1];
    }

    var mType = mimeType || "image/jpeg";
    var ext = mType.indexOf("png") > -1 ? ".png" : (mType.indexOf("pdf") > -1 ? ".pdf" : ".jpg");
    var fName = fileName || ("накладная_" + Utilities.formatDate(new Date(), "GMT+5", "yyyy-MM-dd_HH-mm-ss") + ext);

    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mType, fName);

    var folder = getDriveFolder();
    var file = folder.createFile(blob);

    // Разрешаем просмотр по ссылке
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log("Не удалось установить публичный доступ (корпоративные настройки): " + shareErr.toString());
    }

    var fileUrl = file.getUrl();
    Logger.log("✅ Файл сохранен на Google Диск: " + fileUrl);

    return {
      fileId: file.getId(),
      fileUrl: fileUrl,
      fileName: file.getName(),
      folderUrl: GOOGLE_DRIVE_FOLDER_URL
    };
  } catch (err) {
    Logger.log("❌ Ошибка при сохранении на Google Диск: " + err.toString());
    return {
      error: err.toString()
    };
  }
}

/**
 * Получить ссылки на оба взаимосвязанных листа: «Склад» и «Лист1»
 */
function getSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Поиск или создание листа «Склад»
  var warehouseSheet = ss.getSheetByName("Склад");
  if (!warehouseSheet) {
    warehouseSheet = ss.insertSheet("Склад");
    warehouseSheet.appendRow(WAREHOUSE_HEADERS);
    warehouseSheet.getRange(1, 1, 1, WAREHOUSE_HEADERS.length).setFontWeight("bold").setBackground("#e2e8f0");
    warehouseSheet.setFrozenRows(1);
  }

  // 2. Поиск листа сотрудников: «Лист1 (копия)», «Лист1» или первый лист
  var employeeSheet = ss.getSheetByName("Лист1 (копия)") || ss.getSheetByName("Лист1");
  if (!employeeSheet) {
    var allSheets = ss.getSheets();
    for (var i = 0; i < allSheets.length; i++) {
      if (allSheets[i].getName() !== "Склад") {
        employeeSheet = allSheets[i];
        break;
      }
    }
  }
  if (!employeeSheet) {
    employeeSheet = ss.insertSheet("Лист1");
    employeeSheet.appendRow(EMPLOYEE_HEADERS);
    employeeSheet.getRange(1, 1, 1, EMPLOYEE_HEADERS.length).setFontWeight("bold").setBackground("#e2e8f0");
    employeeSheet.setFrozenRows(1);
  }

  return {
    ss: ss,
    warehouseSheet: warehouseSheet,
    employeeSheet: employeeSheet
  };
}

/**
 * Тест связи через кнопку «Выполнить»
 */
function testConnection() {
  try {
    var ctx = getSheets();
    var whLast = ctx.warehouseSheet.getLastRow();
    var empLast = ctx.employeeSheet.getLastRow();
    var driveFolder = getDriveFolder();

    Logger.log("=================================================");
    Logger.log("✅ ТЕСТ УСПЕШНО ПРОЙДЕН! Связь с Google Таблицей и Диском отличная.");
    Logger.log("📦 Лист «Склад»: строк = " + whLast + " (Колонок: " + WAREHOUSE_HEADERS.length + ")");
    Logger.log("👥 Лист сотрудников («" + ctx.employeeSheet.getName() + "»): строк = " + empLast);
    Logger.log("📁 Папка Google Диска: «" + driveFolder.getName() + "» (ID: " + driveFolder.getId() + ")");
    Logger.log("🔗 Оба листа строго взаимосвязаны с Google Диском!");
    Logger.log("=================================================");
    return "OK";
  } catch (err) {
    Logger.log("❌ Ошибка при проверке: " + err.toString());
    throw err;
  }
}

function test() {
  return testConnection();
}

/**
 * Форматирование текущей даты и времени
 */
function getNowFormatted() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+5", "dd.MM.yyyy HH:mm:ss");
}

/**
 * GET-запросы (Ping, чтение остатков склада, проверка)
 */
function doGet(e) {
  try {
    var ctx = getSheets();
    var params = (e && e.parameter) ? e.parameter : {};

    if (params.action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "IT Asset Webhook is active (Лист1 & Склад + Google Drive)",
        employeeSheet: ctx.employeeSheet.getName(),
        employeeRows: ctx.employeeSheet.getLastRow(),
        warehouseSheet: ctx.warehouseSheet.getName(),
        warehouseRows: ctx.warehouseSheet.getLastRow(),
        driveFolderId: GOOGLE_DRIVE_FOLDER_ID,
        driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (params.action === "getWarehouse") {
      var whData = ctx.warehouseSheet.getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        rows: whData
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // По умолчанию возвращаем сводку по обоим листам и диску
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      employeeSheet: ctx.employeeSheet.getName(),
      employeeRows: ctx.employeeSheet.getLastRow(),
      warehouseRows: ctx.warehouseSheet.getLastRow(),
      driveFolderId: GOOGLE_DRIVE_FOLDER_ID,
      driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST-запросы: взаимосвязанные операции прихода, выдачи, возврата, загрузки фото в Google Диск
 */
function doPost(e) {
  try {
    var ctx = getSheets();
    var payload = {};

    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = (e && e.parameter) ? e.parameter : {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action || "appendRow";

    // 1. Прямая загрузка файла/фото на Google Диск
    if (action === "uploadToDrive" || action === "uploadInvoicePhoto") {
      return handleUploadToDrive(payload);
    }

    // 2. Оприходование на лист «Склад» (Приход по накладной + авто-сохранение фото в Диск)
    if (action === "appendWarehouseRow" || action === "warehouseReceipt") {
      return handleWarehouseReceipt(ctx, payload);
    }

    // 3. Пакетное оприходование на лист «Склад»
    if (action === "appendWarehouseRows") {
      return handleBatchWarehouseReceipt(ctx, payload);
    }

    // 4. Выдача техники со склада сотруднику (связка двух листов)
    if (action === "issueWarehouseItem") {
      return handleIssueWarehouseItem(ctx, payload);
    }

    // 5. Возврат техники от сотрудника на склад (связка двух листов)
    if (action === "returnEquipment") {
      return handleReturnEquipment(ctx, payload);
    }

    // 6. Обычное добавление записи сотрудника на Лист1
    if (action === "appendRow") {
      return handleAppendEmployeeRow(ctx, payload);
    }

    // 7. Полная синхронизация обоих листов или листа сотрудников
    if (action === "syncAll") {
      return handleSyncAll(ctx, payload);
    }

    // 8. Полная синхронизация только листа «Склад»
    if (action === "syncWarehouse") {
      return handleSyncWarehouse(ctx, payload);
    }

    // 9. Удаление строки со склада
    if (action === "deleteWarehouseRow") {
      return handleDeleteWarehouseRow(ctx, payload);
    }

    // 10. Удаление строки из листа сотрудников
    if (action === "deleteRow") {
      return handleDeleteEmployeeRow(ctx, payload);
    }

    // 11. Проверка связи
    if (action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Google Apps Script Webhook активен! Лист1, Склад и Google Диск подключены.",
        warehouseSheet: ctx.warehouseSheet.getName(),
        employeeSheet: ctx.employeeSheet.getName(),
        driveFolderId: GOOGLE_DRIVE_FOLDER_ID,
        driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Неизвестное действие: " + action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 1. Обработка прямой загрузки файла в Google Диск
 */
function handleUploadToDrive(payload) {
  var base64 = payload.fileBase64 || payload.photoBase64;
  if (!base64) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Отсутствуют данные файла (fileBase64)"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var fileName = payload.fileName || ("накладная_" + Utilities.formatDate(new Date(), "GMT+5", "yyyyMMdd_HHmmss") + ".jpg");
  var mimeType = payload.mimeType || "image/jpeg";

  var saved = saveFileToDrive(base64, fileName, mimeType);
  if (!saved || saved.error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: saved ? saved.error : "Не удалось сохранить файл на Google Диск"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Файл успешно сохранен в Google Диск!",
    fileId: saved.fileId,
    fileUrl: saved.fileUrl,
    fileName: saved.fileName,
    folderUrl: GOOGLE_DRIVE_FOLDER_URL
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 2. Оприходование на лист «Склад» в строгой 8-колоночной форме с авто-загрузкой фото в Google Диск
 */
function handleWarehouseReceipt(ctx, payload) {
  var ws = ctx.warehouseSheet;
  var lastRow = ws.getLastRow();
  var nextNum = lastRow > 1 ? lastRow : 1;

  var type = payload.type || payload.Типы || "Оборудование";
  var brand = payload.brand || payload["Марка и модели"] || payload.Марка || "—";
  var unit = payload.unit || payload["Единица измерения (м, шт.)"] || "Склад ИТ (В наличии)";
  var timeStr = payload.timestamp || payload["Запись документа"] || getNowFormatted();
  var receiver = payload.receiver || payload["Кто принял"] || "Зохид Зокиров";
  var movement = payload.movement || payload["Движение товаров"] || "Приход (Склад)";
  var baseDoc = payload.document || payload["Основание"] || payload.notes || "Приход";

  // Автоматическое сохранение фото в Google Диск если прикреплено фото
  var driveFileUrl = payload.driveFileUrl || payload.fileUrl || "";
  var photoBase64 = payload.photoBase64 || payload.fileBase64;

  if (!driveFileUrl && photoBase64) {
    var savedFile = saveFileToDrive(
      photoBase64,
      "накладная_" + type + "_" + brand + "_" + Utilities.formatDate(new Date(), "GMT+5", "yyyyMMdd_HHmmss") + ".jpg",
      payload.mimeType || "image/jpeg"
    );
    if (savedFile && savedFile.fileUrl) {
      driveFileUrl = savedFile.fileUrl;
    }
  }

  // Формируем основание: если есть ссылка на Google Диск, делаем удобную запись со ссылкой
  var finalDocument = baseDoc;
  if (driveFileUrl) {
    if (finalDocument.indexOf(driveFileUrl) === -1) {
      finalDocument = finalDocument + " [Фото в Google Диске: " + driveFileUrl + "]";
    }
  }

  var count = Math.max(1, Math.min(100, Number(payload.quantity) || 1));
  var addedRows = [];

  for (var i = 0; i < count; i++) {
    var rowNum = nextNum + i;
    var rowData = [
      rowNum,
      type,
      brand,
      unit,
      timeStr,
      receiver,
      movement,
      finalDocument
    ];
    ws.appendRow(rowData);
    addedRows.push(rowData);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Успешно оприходовано на лист «Склад»: " + count + " шт. «" + type + " " + brand + "»" + (driveFileUrl ? " (фото сохранено в Google Диск)" : ""),
    count: count,
    driveFileUrl: driveFileUrl,
    folderUrl: GOOGLE_DRIVE_FOLDER_URL,
    addedRows: addedRows
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 3. Пакетное оприходование массива позиций на лист «Склад»
 */
function handleBatchWarehouseReceipt(ctx, payload) {
  var ws = ctx.warehouseSheet;
  var rows = payload.rows || [];
  var lastRow = ws.getLastRow();
  var currentNum = lastRow > 1 ? lastRow : 1;
  var count = 0;

  var sharedDriveUrl = payload.driveFileUrl || "";
  if (!sharedDriveUrl && (payload.photoBase64 || payload.fileBase64)) {
    var saved = saveFileToDrive(
      payload.photoBase64 || payload.fileBase64,
      "накладная_пакет_" + Utilities.formatDate(new Date(), "GMT+5", "yyyyMMdd_HHmmss") + ".jpg",
      payload.mimeType || "image/jpeg"
    );
    if (saved && saved.fileUrl) {
      sharedDriveUrl = saved.fileUrl;
    }
  }

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var type = r.type || r.Типы || "Оборудование";
    var brand = r.brand || r["Марка и модели"] || "—";
    var doc = r.document || r["Основание"] || payload.document || "Приход";
    if (sharedDriveUrl && doc.indexOf(sharedDriveUrl) === -1) {
      doc = doc + " [Фото в Google Диске: " + sharedDriveUrl + "]";
    }
    var qty = Math.max(1, Number(r.quantity) || 1);

    for (var q = 0; q < qty; q++) {
      currentNum++;
      ws.appendRow([
        currentNum,
        type,
        brand,
        "Склад ИТ (В наличии)",
        getNowFormatted(),
        payload.receiver || "Зохид Зокиров",
        "Приход (Склад)",
        doc
      ]);
      count++;
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Оприходовано позиций на лист «Склад»: " + count,
    count: count,
    driveFileUrl: sharedDriveUrl,
    folderUrl: GOOGLE_DRIVE_FOLDER_URL
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 4. Выдача техники со склада сотруднику (двусторонняя связь Лист1 и Склад)
 */
function handleIssueWarehouseItem(ctx, payload) {
  var ws = ctx.warehouseSheet;
  var es = ctx.employeeSheet;

  var whRowIndex = Number(payload.warehouseRowIndex || payload.warehouseRowNumber || -1);
  var username = payload.username || "";
  var position = payload.position || "";
  var pcId = payload.pcId || "";
  var serialNumber = payload.serialNumber || "—";
  var issuer = payload.issuer || "Зохид Зокиров";
  var timeStr = payload.timestamp || getNowFormatted();
  var type = payload.type || "";
  var brand = payload.brand || "";
  var doc = payload.document || payload.notes || "";

  // 1) Обновляем статус на листе «Склад»
  if (whRowIndex > 0) {
    var whData = ws.getDataRange().getValues();
    for (var r = 1; r < whData.length; r++) {
      var numVal = Number(whData[r][0]);
      if (numVal === whRowIndex || r === whRowIndex) {
        if (!type) type = String(whData[r][1] || "");
        if (!brand) brand = String(whData[r][2] || "");
        if (!doc) doc = String(whData[r][7] || "");

        // Колонка D: Единица измерения -> Выдано: <ФИО>
        ws.getRange(r + 1, 4).setValue("Выдано: " + username);
        // Колонка G: Движение товаров -> Выдано: <ФИО> (<Должность>)
        ws.getRange(r + 1, 7).setValue("Выдано: " + username + (position ? " (" + position + ")" : ""));
        // Колонка H: Основание
        var oldDoc = String(whData[r][7] || "");
        ws.getRange(r + 1, 8).setValue(oldDoc + " [Выдано: " + username + " " + timeStr + "]");
        break;
      }
    }
  }

  // 2) Добавляем строку на лист сотрудников (Лист1) под нужным сотрудником
  var issueDocNote = "Выдано со склада" + (doc ? " (Основание: " + doc + ")" : "");
  var empRow = [
    pcId,
    username,
    position,
    type,
    brand,
    serialNumber,
    timeStr,
    issuer,
    "Выдано со склада",
    issueDocNote
  ];

  insertEmployeeRowSmart(es, empRow, username);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Техника «" + type + " " + brand + "» выдана сотруднику " + username + " и списана со склада!",
    issuedItem: empRow
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 5. Возврат техники от сотрудника на склад (двусторонняя связь Лист1 и Склад)
 */
function handleReturnEquipment(ctx, payload) {
  var ws = ctx.warehouseSheet;
  var es = ctx.employeeSheet;

  var username = payload.username || "";
  var position = payload.position || "";
  var type = payload.type || "";
  var brand = payload.brand || "";
  var timeStr = payload.timestamp || getNowFormatted();
  var receiver = payload.receiver || "Зохид Зокиров";
  var employeeRowIndex = Number(payload.employeeRowIndex || -1);

  // 1) На листе сотрудников отмечаем возврат
  var esData = es.getDataRange().getValues();
  if (employeeRowIndex > 0 && employeeRowIndex < esData.length) {
    es.getRange(employeeRowIndex + 1, 9).setValue("Сдал (Возврат на склад)");
    es.getRange(employeeRowIndex + 1, 10).setValue("Сдано на склад " + receiver + " " + timeStr);
  } else if (username) {
    for (var i = 1; i < esData.length; i++) {
      var rowUser = String(esData[i][1] || "").trim().toLowerCase();
      var rowType = String(esData[i][3] || "").trim().toLowerCase();
      if (rowUser.indexOf(username.toLowerCase()) !== -1 && (!type || rowType === type.toLowerCase())) {
        es.getRange(i + 1, 9).setValue("Сдал (Возврат на склад)");
        es.getRange(i + 1, 10).setValue("Сдано на склад " + receiver + " " + timeStr);
        if (!type) type = String(esData[i][3] || "");
        if (!brand) brand = String(esData[i][4] || "");
        if (!position) position = String(esData[i][2] || "");
        break;
      }
    }
  }

  // 2) На лист «Склад» добавляем новую строку возвращенного оборудования «В наличии»
  var whLast = ws.getLastRow();
  var nextNum = whLast > 1 ? whLast : 1;
  var whRow = [
    nextNum,
    type || "Оборудование",
    brand || "—",
    "Склад ИТ (В наличии)",
    timeStr,
    receiver,
    "Возврат на склад (от " + username + ")",
    "Возврат от сотрудника: " + username + (position ? " (" + position + ")" : "")
  ];
  ws.appendRow(whRow);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Техника «" + type + " " + brand + "» возвращена на Склад в наличии от " + username,
    warehouseRow: whRow
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Вставка строки сотрудника на Лист1 с группировкой под его блоком
 */
function insertEmployeeRowSmart(sheet, rowArray, targetUser) {
  var data = sheet.getDataRange().getValues();
  var u = String(targetUser || "").trim().toLowerCase();
  var targetIdx = -1;

  if (u) {
    for (var i = 1; i < data.length; i++) {
      var rowU = String(data[i][1] || "").trim().toLowerCase();
      if (rowU && (rowU === u || rowU.indexOf(u) !== -1 || u.indexOf(rowU) !== -1)) {
        targetIdx = i + 1;
      }
    }
  }

  if (targetIdx > 0) {
    sheet.insertRowAfter(targetIdx);
    sheet.getRange(targetIdx + 1, 1, 1, rowArray.length).setValues([rowArray]);
  } else {
    sheet.appendRow(rowArray);
  }
}

/**
 * 6. Добавление отдельной строки сотрудника на Лист1
 */
function handleAppendEmployeeRow(ctx, payload) {
  var es = ctx.employeeSheet;
  var row = [
    payload.pcId || "",
    payload.username || "",
    payload.position || "",
    payload.type || "",
    payload.brand || "",
    payload.serialNumber || "",
    payload.timestamp || getNowFormatted(),
    payload.issuer || "Зохид Зокиров",
    payload.movement || "Принял",
    payload.notes || ""
  ];

  insertEmployeeRowSmart(es, row, payload.username);

  // Если указано, что выдано из номера склада, отмечаем в листе «Склад»
  if (payload.fromWarehouseNumber || payload.fromWarehouseIndex) {
    var whNum = Number(payload.fromWarehouseNumber || payload.fromWarehouseIndex);
    var ws = ctx.warehouseSheet;
    var whData = ws.getDataRange().getValues();
    for (var r = 1; r < whData.length; r++) {
      if (Number(whData[r][0]) === whNum || r === whNum) {
        ws.getRange(r + 1, 4).setValue("Выдано: " + payload.username);
        ws.getRange(r + 1, 7).setValue("Выдано: " + payload.username);
        var old = String(whData[r][7] || "");
        ws.getRange(r + 1, 8).setValue(old + " [Выдано: " + payload.username + "]");
        break;
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Строка сотрудника успешно добавлена на лист " + es.getName(),
    row: row
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 7. Полная синхронизация: Лист1 + при наличии Лист Склад
 */
function handleSyncAll(ctx, payload) {
  var es = ctx.employeeSheet;
  var ws = ctx.warehouseSheet;

  // 1) Лист сотрудников
  if (payload.rows && payload.rows.length > 0) {
    var empRows = payload.rows;
    var empCols = payload.columns || EMPLOYEE_HEADERS;
    var empValues = [empCols];

    for (var r = 0; r < empRows.length; r++) {
      var item = empRows[r];
      var row = [];
      for (var c = 0; c < empCols.length; c++) {
        var key = empCols[c];
        var val = item[key] !== undefined ? item[key] : item[String(key).trim()];
        row.push(val !== undefined && val !== null ? val : "");
      }
      empValues.push(row);
    }

    es.clearContents();
    es.getRange(1, 1, empValues.length, empCols.length).setValues(empValues);
  }

  // 2) Лист «Склад»
  if (payload.warehouseRows && payload.warehouseRows.length > 0) {
    var whRows = payload.warehouseRows;
    var whCols = payload.warehouseColumns || WAREHOUSE_HEADERS;
    var whValues = [whCols];

    for (var w = 0; w < whRows.length; w++) {
      var wItem = whRows[w];
      var wRow = [];
      for (var k = 0; k < whCols.length; k++) {
        var wKey = whCols[k];
        var wVal = wItem[wKey] !== undefined ? wItem[wKey] : wItem[String(wKey).trim()];
        wRow.push(wVal !== undefined && wVal !== null ? wVal : "");
      }
      whValues.push(wRow);
    }

    ws.clearContents();
    ws.getRange(1, 1, whValues.length, whCols.length).setValues(whValues);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Оба листа («" + es.getName() + "» и «Склад») успешно синхронизированы!"
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 8. Полная перезапись листа «Склад»
 */
function handleSyncWarehouse(ctx, payload) {
  var ws = ctx.warehouseSheet;
  var rows = payload.warehouseRows || payload.rows || [];
  if (!rows || rows.length === 0) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Пустой массив строк для склада"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var cols = payload.warehouseColumns || WAREHOUSE_HEADERS;
  var values = [cols];

  for (var i = 0; i < rows.length; i++) {
    var item = rows[i];
    var r = [];
    for (var c = 0; c < cols.length; c++) {
      var k = cols[c];
      var v = item[k] !== undefined ? item[k] : item[String(k).trim()];
      r.push(v !== undefined && v !== null ? v : "");
    }
    values.push(r);
  }

  ws.clearContents();
  ws.getRange(1, 1, values.length, cols.length).setValues(values);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Лист «Склад» обновлен: " + rows.length + " строк."
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 9. Удаление строки из листа «Склад»
 */
function handleDeleteWarehouseRow(ctx, payload) {
  var ws = ctx.warehouseSheet;
  var data = ws.getDataRange().getValues();
  var targetNum = Number(payload.rowNumber || payload["№ П/П"] || -1);

  if (targetNum > 0) {
    for (var i = 1; i < data.length; i++) {
      if (Number(data[i][0]) === targetNum) {
        ws.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Строка № " + targetNum + " удалена с листа «Склад»"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "error",
    message: "Строка на складе не найдена"
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 10. Удаление строки из листа сотрудников
 */
function handleDeleteEmployeeRow(ctx, payload) {
  var es = ctx.employeeSheet;
  var data = es.getDataRange().getValues();
  var u = String(payload.username || "").trim().toLowerCase();
  var t = String(payload.type || "").trim().toLowerCase();
  var b = String(payload.brand || "").trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var rowU = String(data[i][1] || "").trim().toLowerCase();
    var rowT = String(data[i][3] || "").trim().toLowerCase();
    var rowB = String(data[i][4] || "").trim().toLowerCase();

    if (rowU === u && rowT === t && (!b || rowB === b)) {
      es.deleteRow(i + 1);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Строка удалена из листа сотрудников"
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "error",
    message: "Запись сотрудника не найдена для удаления"
  })).setMimeType(ContentService.MimeType.JSON);
}
