function doPost(e) {
    try {
        var data = JSON.parse(e.postData.contents);
        var sheetName = "Página1";
        var folderId = "1uKJmiN97zEsLWMuas2zGK605qcJDsqM2";

        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

        if (sheet.getLastRow() === 0) {
            sheet.appendRow(["Data de Registro", "Arquivo", "Data do Comprovante", "Valor", "Link no Drive"]);
        }

        var folder = DriveApp.getFolderById(folderId.trim());

        // --- LÓGICA DE LOTE (Múltiplos itens -> 1 PDF unico) ---
        if (data.isBatch) {
            var fileUrl = "Sem arquivo";

            // 1. Salva o PDF único se houver
            if (data.pdfBase64 && data.pdfBase64.includes(",")) {
                var bytes = Utilities.base64Decode(data.pdfBase64.split(",")[1]);
                var blob = Utilities.newBlob(bytes, "application/pdf", data.pdfName);
                var file = folder.createFile(blob);
                file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                fileUrl = file.getUrl();
            }

            // 2. Registra todos os itens na planilha apontando para o mesmo PDF
            data.items.forEach(function (item) {
                sheet.appendRow([new Date(), item.file, item.date, item.value, fileUrl]);
            });

            return ContentService.createTextOutput(JSON.stringify({ "status": "success" })).setMimeType(ContentService.MimeType.JSON);
        }

        // --- LÓGICA INDIVIDUAL (Legado/Fallback) ---
        var fileUrl = "Sem arquivo";
        if (data.base64 && data.base64.includes(",")) {
            var parts = data.base64.split(",");
            var contentType = parts[0].split(":")[1].split(";")[0] || "image/jpeg";
            var bytes = Utilities.base64Decode(parts[1]);
            var fileName = (data.file || "Comprovante").replace(/[\\\/:*?"<>|]/g, '-');
            var blob = Utilities.newBlob(bytes, contentType, fileName);
            var file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            fileUrl = file.getUrl();
        }

        sheet.appendRow([new Date(), data.file, data.date, data.value, fileUrl]);
        return ContentService.createTextOutput(JSON.stringify({ "status": "success", "url": fileUrl })).setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}
