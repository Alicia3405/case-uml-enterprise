/**
 * Copia texto al portapapeles de manera universal en navegadores.
 * Soporta HTTP sin SSL (ej. IP directa http://3.85.188.197:4200) donde navigator.clipboard es undefined.
 */
export function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => resolve(true))
        .catch(() => resolve(fallbackCopyTextToClipboard(text)));
    } else {
      resolve(fallbackCopyTextToClipboard(text));
    }
  });
}

function fallbackCopyTextToClipboard(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Evitar deslazamiento de la pantalla en dispositivos móviles
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy error:', err);
    return false;
  }
}
