function doPost(e) {
    try {
        var data = JSON.parse(e.postData.contents);
        var sheetName = "Página1"; // Nome da página na sua planilha

        // ATENÇÃO: Se quiser salvar as fotos no Drive, coloque o ID da pasta abaixo.
        // Se deixar como está, ele salvará apenas os dados na planilha.
        var folderId = "ID_DA_PASTA_DO_GOOGLE_DRIVE";

        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

        // Cria cabeçalhos se a planilha estiver vazia
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(["Data de Registro", "Arquivo", "Data do Comprovante", "Valor", "Link no Drive"]);
            sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#f3f4f6");
        }

        var fileUrl = "Sem arquivo";
        if (data.base64 && folderId !== "ID_DA_PASTA_DO_GOOGLE_DRIVE") {
            try {
                var folder = DriveApp.getFolderById(folderId);
                var bytes = Utilities.base64Decode(data.base64.split(",")[1]);
                var blob = Utilities.newBlob(bytes, "image/jpeg", data.file);
                var file = folder.createFile(blob);
                fileUrl = file.getUrl();
            } catch (err) {
                fileUrl = "Erro Drive: " + err.toString();
            }
        }

        // Adiciona a linha com os dados
        sheet.appendRow([new Date(), data.file, data.date, data.value, fileUrl]);

        return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": err.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}
