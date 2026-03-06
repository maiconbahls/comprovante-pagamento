import sys
from pypdf import PdfReader
import re

def test_extraction(file_path):
    print(f"--- Testando arquivo: {file_path} ---")
    try:
        reader = PdfReader(file_path)
        text = ""
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
                print(f"Pagina {i+1}: Texto extraído ({len(page_text)} caracteres)")
            else:
                print(f"Pagina {i+1}: Nenhum texto extraído.")
        
        print("\n--- Texto Completo (Top 1000 chars) ---")
        print(text[:1000])
        print("--- Fim do texto ---\n")
        
        # Testando regexes
        date_match = re.search(r"(\d{2}[/-]\d{2}[/-]\d{4})", text)
        print(f"Data encontrada: {date_match.group(1) if date_match else 'NADA'}")
        
        val_patterns = [
            r"(?:VALOR|TOTAL|PAGO|VALOR RECEBIDO|R\$)\s*:?\s*R?\$\s*((?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})",
            r"((?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})"
        ]
        
        for p in val_patterns:
            m = re.search(p, text, re.I)
            print(f"Valor com pattern '{p}': {m.group(1) if m else 'NADA'}")

    except Exception as e:
        print(f"Erro no teste: {e}")

if __name__ == "__main__":
    test_extraction("CamScanner 27-01-2026 07.40.pdf")
