function doPost(e) {
    try {
        var data = JSON.parse(e.postData.contents);
        var sheetName = "Página1";

        // ID da sua pasta do Google Drive
        var folderId = "1uKJmiN97zEsLWMuas2zGK605qcJDsqM2";

        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

        if (sheet.getLastRow() === 0) {
            sheet.appendRow(["Data de Registro", "Arquivo", "Data do Comprovante", "Valor", "Link no Drive"]);
        }

        var fileUrl = "Sem arquivo";

        if (data.base64 && data.base64.includes(",")) {
            try {
                var folder = DriveApp.getFolderById(folderId.trim());

                // Extração do Base64
                var parts = data.base64.split(",");
                var contentType = parts[0].split(":")[1].split(";")[0] || "image/jpeg";
                var bytes = Utilities.base64Decode(parts[1]);

                // Limpeza extra do nome do arquivo
                var fileName = (data.file || "Comprovante").replace(/[\\\/:*?"<>|]/g, '-');

                // Criando o arquivo
                var blob = Utilities.newBlob(bytes, contentType, fileName);
                var file = folder.createFile(blob);

                // Deixa o arquivo público para visualização
                file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
                fileUrl = file.getUrl();
            } catch (err) {
                fileUrl = "Erro Drive: " + err.toString();
            }
        }

        sheet.appendRow([new Date(), data.file, data.date, data.value, fileUrl]);

        return ContentService.createTextOutput(JSON.stringify({ "status": "success", "url": fileUrl }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}
