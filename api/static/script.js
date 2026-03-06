// Configuração do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const statusOCR = document.getElementById('statusOCR');

// Inicializa o Tesseract com Scheduler (Múltiplos núcleos) para velocidade
let scheduler = Tesseract.createScheduler();

async function initOCR() {
    try {
        const worker1 = await Tesseract.createWorker('por');
        const worker2 = await Tesseract.createWorker('por');
        scheduler.addWorker(worker1);
        scheduler.addWorker(worker2);
        statusOCR.innerHTML = '<span style="color: #4ade80">● Motor de visão turbo pronto (Cérebro v7)</span>';
        return scheduler;
    } catch (e) {
        console.error("Erro ao iniciar Tesseract:", e);
        statusOCR.innerHTML = '<span style="color: #ef4444">● Erro no motor de visão</span>';
    }
}

const workerPromise = initOCR();

// --- NOVOS ELEMENTOS DE CÂMERA ---
const btnShowCamera = document.getElementById('btnShowCamera');
const btnShowUpload = document.getElementById('btnShowUpload');
const uploadSection = document.getElementById('uploadSection');
const cameraModal = document.getElementById('cameraModal');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const video = document.getElementById('video');
const captureBtn = document.getElementById('captureBtn');
const cameraStatus = document.getElementById('cameraStatus');
let stream = null;

// Alternar Interface
if (btnShowCamera) {
    btnShowCamera.onclick = async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            video.srcObject = stream;
            cameraModal.style.display = 'block';
        } catch (err) {
            alert("Não foi possível acessar a câmera: " + err);
        }
    };
}

const stopCamera = () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    cameraModal.style.display = 'none';
};

if (closeCameraBtn) closeCameraBtn.onclick = stopCamera;

// Capturar e Ler via Câmera
if (captureBtn) {
    captureBtn.onclick = async () => {
        cameraStatus.innerText = "🌀 Processando Visão v5...";
        captureBtn.disabled = true;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const thumbUrl = canvas.toDataURL('image/jpeg', 0.8);

        try {
            const { data: { text } } = await scheduler.addJob('recognize', canvas);
            const extracted = parseText(text);

            const tableBody = document.getElementById('tableBody');
            document.getElementById('resultsArea').style.display = 'block';

            addTableRow({
                file: `Captura Câmera ${new Date().toLocaleTimeString()}`,
                date: extracted.date,
                value: extracted.value,
                thumb: thumbUrl
            }, "Scanner Digital", tableBody);

            stopCamera();
            captureBtn.disabled = false;
            cameraStatus.innerText = "Centralize o comprovante na área pontilhada";
        } catch (err) {
            console.error(err);
            alert("Erro ao processar imagem da câmera.");
            captureBtn.disabled = false;
        }
    };
}

// Upload de Arquivos
if (dropZone && fileInput) {
    dropZone.onclick = () => fileInput.click();
    fileInput.addEventListener('change', updateFileCount);

    // Suporte a Arrastar e Soltar (Drag & Drop)
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.background = "rgba(99, 102, 241, 0.1)";
            dropZone.style.borderColor = "#4f46e5";
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.background = "";
            dropZone.style.borderColor = "";
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            fileInput.files = files;
            updateFileCount();
        }
    }, false);

    function updateFileCount() {
        const countDisplay = document.getElementById('fileCount');
        countDisplay.innerText = fileInput.files.length > 0 ?
            `${fileInput.files.length} arquivo(s) PDF selecionado(s).` : "";
    }

    const uploadForm = document.getElementById('uploadForm');
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const files = fileInput.files;
        if (files.length === 0) return alert("Selecione os PDFs.");

        const btnText = document.getElementById('btnText');
        const loader = document.getElementById('btnLoader');
        const submitBtn = document.getElementById('submitBtn');
        const resultsArea = document.getElementById('resultsArea');
        const tableBody = document.getElementById('tableBody');
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');

        btnText.innerText = "Iniciando...";
        loader.style.display = "block";
        submitBtn.disabled = true;
        progressContainer.style.display = "block";
        resultsArea.style.display = "block";
        tableBody.innerHTML = "";

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const totalPages = pdf.numPages;

                // Tenta via servidor (arquivos digitais)
                let serverData = null;
                if (file.size < 4000000) {
                    const formData = new FormData();
                    formData.append('files', file);
                    const response = await fetch('/api/process', { method: 'POST', body: formData });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.data && result.data[0]) {
                            serverData = result.data[0];
                        }
                    }
                }

                for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                    const percent = ((i * totalPages + pageNum) / (files.length * totalPages)) * 100;
                    progressBar.style.width = `${percent}%`;
                    btnText.innerText = `Auditando: ${file.name.substring(0, 10)}...`;
                    progressBar.style.width = `${percent}%`;

                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 3.0 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    const thumbUrl = canvas.toDataURL('image/jpeg', 0.8);

                    let extracted;
                    let method = "Visão OCR";

                    if (pageNum === 1 && serverData && serverData.date !== "Não encontrada" && serverData.value !== "Não encontrado") {
                        extracted = serverData;
                        method = "Digital";
                    } else {
                        const { data: { text } } = await scheduler.addJob('recognize', canvas);
                        extracted = parseText(text);
                    }

                    addTableRow({
                        file: totalPages > 1 ? `${file.name} (Pág. ${pageNum})` : file.name,
                        date: extracted.date,
                        value: extracted.value,
                        thumb: thumbUrl
                    }, method, tableBody);
                }

            } catch (err) {
                console.error("Erro no arquivo:", file.name, err);
                addTableRow({ file: file.name, date: "Erro", value: "Falha" }, "Falha", tableBody);
            }
        }

        progressBar.style.width = "100%";
        btnText.innerText = "Concluído!";
        loader.style.display = "none";
        submitBtn.disabled = false;
        setTimeout(() => {
            btnText.innerText = "Processar Comprovantes";
            progressContainer.style.display = "none";
        }, 3000);
    });
}

// Inteligência de extração (Cérebro do Sistema v9 - Ultra Precisão)
function parseText(text) {
    // Normalização inicial ultra-limpa preservando estrutura lógica
    let cleanText = text.replace(/\n/g, '  ').replace(/\\/g, '/').replace(/\|/g, ' ');
    const upperText = cleanText.toUpperCase();
    console.log("%c🧠 Cérebro v9: Iniciando auditoria de ultra precisão...", "color: #818cf8; font-weight: bold;");

    // --- 1. AUDITORIA DE DATA ---
    let date = "Não encontrada";
    const datePattern = /(\d{1,2})[\s./-]*([01]?\d)[\s./-]*(\d{2,4})/g;
    let match;
    const dateCandidates = [];

    // Palavras que indicam uma data de pagamento/transação (Alta Confiança)
    const highConfKeywords = ["PAGAMENTO", "REALIZADO", "EFETUADO", "TRANSAÇÃO", "OPERAÇÃO", "DATA DA OPERAÇÃO", "DATA DO PAGAMENTO"];
    // Palavras que indicam emissão (Média Confiança)
    const medConfKeywords = ["EMISSÃO", "EMITIDO", "DATA:"];
    // Palavras que indicam ruído (Baixa Confiança)
    const lowConfKeywords = ["NASCIMENTO", "VALIDADE", "VENCIMENTO", "VENCTO", "CADASTRO"];

    while ((match = datePattern.exec(cleanText)) !== null) {
        let dia = match[1].padStart(2, '0');
        let mes = match[2].padStart(2, '0');
        let ano = match[3];

        if (ano.length === 2) ano = "20" + ano;
        if (ano.length === 3 && ano.startsWith('1')) ano = ano.substring(1);
        if (ano.length === 4 && parseInt(ano) < 2000) ano = "20" + ano.substring(2);

        const d = parseInt(dia), m = parseInt(mes), a = parseInt(ano);
        const currentYear = new Date().getFullYear();

        // Filtro de sanidade: Dia 1-31, Mês 1-12, Ano coerente (2020 até ano atual + 1)
        if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && a >= 2020 && a <= currentYear + 1) {
            const context = cleanText.substring(Math.max(0, match.index - 40), match.index + 20).toUpperCase();
            let weight = 0;

            highConfKeywords.forEach(k => { if (context.includes(k)) weight += 15; });
            medConfKeywords.forEach(k => { if (context.includes(k)) weight += 5; });
            lowConfKeywords.forEach(k => { if (context.includes(k)) weight -= 10; });

            // Datas no final do texto costumam ser data de impressão/emissão, peso menor
            const positionWeight = (1 - (match.index / cleanText.length)) * 5;
            weight += positionWeight;

            // Se for o ano atual, ganha um bônus
            if (a === currentYear) weight += 5;

            dateCandidates.push({ str: `${dia}/${mes}/${ano}`, weight, pos: match.index });
        }
    }

    if (dateCandidates.length > 0) {
        // Ordena por peso (maior primeiro) e depois por posição (mais cedo no texto se empatar)
        dateCandidates.sort((a, b) => b.weight - a.weight || a.pos - b.pos);
        date = dateCandidates[0].str;
        console.log(`📅 Data selecionada (Peso: ${dateCandidates[0].weight.toFixed(1)}): ${date}`);
    }

    // --- 2. AUDITORIA DE VALOR (Anti-Ruído e Anti-Imposto) ---
    let value = "Não encontrado";
    const trashTerms = ["UNIT", "APROX", "TRIB", "IMPOSTO", "ICMS", "DESC", "QTDE", "CÓDIGO", "ITEM", "VLR", "VL.UNIT", "VL.TOTAL", "TROCO", "BASE", "ALÍQUOTA", "FCP"];
    const totalAnchors = [
        "VALOR TOTAL R\\$", "VALOR TOTAL", "TOTAL A PAGAR", "VALOR A PAGAR",
        "VALOR PAGO", "TOTAL PAGO", "PAGO R\\$", "CARTÃO", "DINHEIRO", "TOTAL R\\$",
        "TOTAL RS", "SUBTOTAL R\\$", "VALOR LÍQUIDO", "PAGO RS", "VALOR RECEBIDO"
    ];

    // PASSO A: Busca por Âncora + Proximidade
    for (const anchor of totalAnchors) {
        const regex = new RegExp(`${anchor}\\s*[:=]?\\s*(?:RS|R\\$|S|B|8|B\\$|R\\$|\\$)?\\s*([\\d.]+[,.]\\d{2})\\b`, 'i');
        const m = cleanText.match(regex);
        if (m) {
            const candidateStr = m[1].replace('.', ',');
            const valNum = parseFloat(candidateStr.replace(',', '.'));
            if (valNum > 0.50 && valNum < 500000) {
                value = candidateStr;
                console.log(`💎 Valor Master encontrado (${anchor}): R$ ${value}`);
                return { date, value };
            }
        }
    }

    // PASSO B: Varredura Geral com Auditoria de "Lixo"
    const moneyPattern = /\b([\d.]+[,.]\d{2})\b/g;
    const cleanCandidates = [];
    while ((match = moneyPattern.exec(cleanText)) !== null) {
        const valStr = match[1].replace('.', ',');
        const valNum = parseFloat(valStr.replace(',', '.'));
        const rawPart = match[0].replace(/[.,-]/g, '');
        if (rawPart.length >= 11) continue;

        const context = cleanText.substring(Math.max(0, match.index - 50), match.index).toUpperCase();
        const isTrash = trashTerms.some(term => context.includes(term));
        const isBank = ["001", "237", "033", "341", "104"].includes(valStr.split(',')[0]) && context.includes("BANCO");

        if (!isTrash && !isBank && valNum > 1.0) {
            cleanCandidates.push({ str: valStr, num: valNum, pos: match.index });
        }
    }

    if (cleanCandidates.length > 0) {
        cleanCandidates.sort((a, b) => b.num - a.num || a.pos - b.pos);
        value = cleanCandidates[0].str;
    }

    if (value !== "Não encontrado" && !value.includes(',')) value = value.replace('.', ',');
    return { date, value };
}

function addTableRow(data, method, tableBody) {
    const tr = document.createElement('tr');
    tr.className = 'clickable-row';
    if (data.thumb) tr.dataset.thumb = data.thumb;

    tr.innerHTML = `
        <td style="font-weight: 500;">📄 ${data.file}</td>
        <td><div class="editable-cell" contenteditable="true">${data.date}</div></td>
        <td style="color: #4ade80; font-weight: 700;">R$ <div class="editable-cell" contenteditable="true" style="color: #4ade80;">${data.value}</div></td>
        <td><span class="badge-ocr">${method}</span></td>
        <td>
            <button class="btn btn-delete" style="padding: 8px; background: #ef4444; font-size: 16px; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;" title="Excluir digitalização">
                🗑️
            </button>
        </td>
    `;

    // Click na linha para ver o comprovante (exceto no botão de excluir e células editáveis)
    tr.onclick = (e) => {
        if (e.target.classList.contains('editable-cell') || e.target.closest('.btn-delete')) return;
        if (data.thumb) {
            document.getElementById('modalImage').src = data.thumb;
            document.getElementById('modalTitle').innerText = `Comprovante: ${data.file}`;
            document.getElementById('previewModal').style.display = 'block';
        }
    };

    // Lógica do botão excluir
    tr.querySelector('.btn-delete').onclick = (e) => {
        e.stopPropagation();
        if (confirm("Deseja realmente excluir esta digitalização?")) {
            tr.remove();
            // Se a tabela ficar vazia, oculta a área de resultados
            if (tableBody.children.length === 0) {
                document.getElementById('resultsArea').style.display = 'none';
            }
        }
    };

    tableBody.appendChild(tr);
}

// Fechamento Modal
const modal = document.getElementById('previewModal');
if (modal) {
    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) closeBtn.onclick = () => modal.style.display = "none";
    window.addEventListener('click', (e) => { if (e.target == modal) modal.style.display = "none"; });
    window.addEventListener('keydown', (e) => { if (e.key === "Escape") modal.style.display = "none"; });
}

// Exportar PDF
document.getElementById('downloadPDF').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let imageAdded = false;
    document.querySelectorAll('#tableBody tr').forEach((tr) => {
        const thumb = tr.dataset.thumb;
        if (thumb) {
            if (imageAdded) doc.addPage();
            const fileName = tr.querySelector('td').innerText.replace('📄 ', '');
            const date = tr.querySelector('td:nth-child(2) .editable-cell').innerText;
            const value = tr.querySelector('td:nth-child(3) .editable-cell').innerText;
            doc.setFontSize(12);
            doc.text(`${fileName} - ${date} - R$ ${value}`, 15, 15);
            const imgProps = doc.getImageProperties(thumb);
            const pdfWidth = doc.internal.pageSize.getWidth() - 30;
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            doc.addImage(thumb, 'JPEG', 15, 25, pdfWidth, Math.min(pdfHeight, 250));
            imageAdded = true;
        }
    });
    if (!imageAdded) return alert("Nenhum item!");
    doc.save("Comprovantes.pdf");
});

// Exportar Excel
document.getElementById('downloadExcel').addEventListener('click', () => {
    const data = [["Arquivo", "Data", "Valor"]];
    document.querySelectorAll('#tableBody tr').forEach(tr => {
        const file = tr.querySelectorAll('td')[0].innerText.replace('📄 ', '');
        const date = tr.querySelector('td:nth-child(2) .editable-cell').innerText;
        const val = tr.querySelector('td:nth-child(3) .editable-cell').innerText.replace('R$ ', '');
        data.push([file, date, val]);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reembolsos");
    XLSX.writeFile(wb, "Relatorio.xlsx");
});

// --- INTEGRAÇÃO GOOGLE SHEETS/DRIVE ---
const syncBtn = document.getElementById('syncGoogle');
const googleConfig = document.getElementById('googleConfig');
const appsScriptUrlInput = document.getElementById('appsScriptUrl');

// URL Padrão do Maicon
const DEFAULT_URL = "https://script.google.com/macros/s/AKfycby_CXsMBXCnPGIunrXTdQOCxUsPCyxV6EVKARa-ORFF1tSk0uKE6xpRmZq0C-8-WpWF/exec";

// Carregar URL salva ou usar a padrão
const savedUrl = localStorage.getItem('appsScriptUrl');
appsScriptUrlInput.value = savedUrl ? savedUrl : DEFAULT_URL;

// Se for a primeira vez, salva a padrão no localStorage também
if (!savedUrl) {
    localStorage.setItem('appsScriptUrl', DEFAULT_URL);
}

appsScriptUrlInput.onchange = () => {
    localStorage.setItem('appsScriptUrl', appsScriptUrlInput.value);
};

syncBtn.onclick = async () => {
    if (googleConfig.style.display === 'none') {
        googleConfig.style.display = 'block';
        return;
    }

    const url = appsScriptUrlInput.value;
    if (!url) {
        alert("Por favor, insira a URL do seu Google Apps Script primeiro.");
        return;
    }

    const rows = document.querySelectorAll('#tableBody tr');
    if (rows.length === 0) {
        alert("Não há dados para sincronizar.");
        return;
    }

    syncBtn.disabled = true;
    syncBtn.innerText = "⏳ Sincronizando...";

    let successCount = 0;
    let failCount = 0;

    for (const tr of rows) {
        const file = tr.querySelectorAll('td')[0].innerText.replace('📄 ', '');
        const date = tr.querySelector('td:nth-child(2) .editable-cell').innerText;
        const value = tr.querySelector('td:nth-child(3) .editable-cell').innerText.replace('R$ ', '');
        const base64 = tr.dataset.thumb;

        try {
            const response = await fetch(url, {
                method: 'POST',
                // Truque técnico: usamos text/plain para ignorar restrições de CORS do navegador,
                // já que o Apps Script consegue ler o conteúdo de qualquer forma.
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ file, date, value, base64: base64 || "" })
            });

            successCount++;
            tr.style.opacity = '0.5';
            tr.style.background = 'rgba(74, 222, 128, 0.1)';
        } catch (err) {
            console.error("Erro ao sincronizar linha:", err);
            failCount++;
        }
    }

    syncBtn.disabled = false;
    syncBtn.innerText = "🚀 Sincronizar Google Drive/Sheets";
    alert(`Sincronização concluída!\nSucessos: ${successCount}\nFalhas: ${failCount}\n\nNota: Se você usou uma URL nova, verifique se deu permissão no Google Scripts.`);
};
