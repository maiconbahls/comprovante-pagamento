import os
import re
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from pypdf import PdfReader

template_dir = os.path.join(os.path.dirname(__file__), 'templates')
static_dir = os.path.join(os.path.dirname(__file__), 'static')

app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
app.secret_key = os.environ.get("SECRET_KEY", "uma_chave_secreta_super_segura")

CREDENCIAIS_ACESSO = {
    "gestao": "gestao"
}

def extract_data_from_pdf(pdf_file):
    # Tenta extrair texto normal (vetorial)
    reader = PdfReader(pdf_file)
    text = ""
    try:
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    except Exception as e:
        print(f"Erro ao ler PDF: {e}")
    
    # Limpeza básica de texto
    text = text.replace('\xa0', ' ').replace('\n', '  ')
    
    # Busca de Data (Cérebro v9 Server)
    date_val = "Não encontrada"
    # Matches DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
    date_candidates = re.findall(r"(\d{2}[./-]\d{2}[./-]\d{4})", text)
    
    if date_candidates:
        # Priorização básica por palavras-chave próximas
        best_date = date_candidates[0]
        keywords = ["PAGAMENTO", "REALIZADO", "EFETUADO", "DATA", "TRANSAÇÃO"]
        
        for d in date_candidates:
            # Pega um contexto de 50 chars antes da data
            pos = text.find(d)
            context = text[max(0, pos-50):pos].upper()
            if any(k in context for k in keywords):
                best_date = d
                break
        date_val = best_date

    # Busca de Valor
    val_patterns = [
        r"(?:VALOR|TOTAL|PAGO|VALOR RECEBIDO|R\$)\s*:?\s*R?\$\s*((?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})",
        r"((?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})"
    ]
    
    val = "Não encontrado"
    for pattern in val_patterns:
        value_match = re.search(pattern, text, re.IGNORECASE)
        if value_match:
            found_val = value_match.group(1)
            if len(found_val) < 15:
                val = found_val
                break

    return date_val, val


@app.route('/')
def home():
    if 'logged_in' in session:
        return render_template('dashboard.html')
    return redirect(url_for('login_page'))

@app.route('/login', methods=['GET', 'POST'])
def login_page():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username in CREDENCIAIS_ACESSO and CREDENCIAIS_ACESSO[username] == password:
            session['logged_in'] = True
            return redirect(url_for('home'))
        else:
            return render_template('login.html', error="Usuário ou senha incorretos.")
            
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login_page'))

@app.route('/api/process', methods=['POST'])
def process():
    try:
        if 'logged_in' not in session:
            return jsonify({"error": "Não autorizado"}), 401

        if 'files' not in request.files:
            return jsonify({"error": "Nenhum arquivo enviado"}), 400
            
        files = request.files.getlist('files')
        extracted_data = []
        
        for file in files:
            if file.filename == '':
                continue
            if file.filename.endswith('.pdf'):
                try:
                    file.seek(0)
                    date_val, val = extract_data_from_pdf(file)
                    extracted_data.append({
                        "file": file.filename,
                        "date": date_val,
                        "value": val
                    })
                except Exception as e:
                    extracted_data.append({
                        "file": file.filename,
                        "date": "Erro",
                        "value": "Erro no PDF"
                    })

        return jsonify({"message": "Sucesso", "data": extracted_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=3000)
