import { Injectable } from '@angular/core';

export interface ZipFileEntry {
  path: string;
  content: string | Uint8Array;
}

@Injectable({
  providedIn: 'root'
})
export class ZipPackerService {

  // Tabla precalculada para algoritmo CRC32 estándar IEEE 802.3
  private crcTable: Uint32Array = this.generateCrcTable();

  private generateCrcTable(): Uint32Array {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    return table;
  }

  private calculateCrc32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc = this.crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /**
   * Empaqueta un conjunto de archivos en un archivo binario .ZIP estándar en memoria
   */
  async createZip(files: ZipFileEntry[]): Promise<Blob> {
    const encoder = new TextEncoder();
    const localHeaders: Uint8Array[] = [];
    const centralDirectoryHeaders: Uint8Array[] = [];

    let currentOffset = 0;

    // Normalizar fecha y hora DOS para encabezados ZIP (estándar FAT)
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    for (const file of files) {
      const normalizedPath = file.path.replace(/\\/g, '/').replace(/^\//, '');
      const pathBytes = encoder.encode(normalizedPath);
      const dataBytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
      const crc = this.calculateCrc32(dataBytes);
      const dataLength = dataBytes.length;

      // 1. Encabezado Local de Archivo (Local File Header - 30 bytes + path + data)
      // Firma: 0x04034b50
      const localHeader = new Uint8Array(30 + pathBytes.length + dataLength);
      const lv = new DataView(localHeader.buffer);

      lv.setUint32(0, 0x04034b50, true); // Firma local file header
      lv.setUint16(4, 20, true);         // Versión necesaria para extraer (2.0)
      lv.setUint16(6, 0x0800, true);     // Flags (bit 11 = UTF-8 filenames)
      lv.setUint16(8, 0, true);          // Método de compresión (0 = Store / sin compresión)
      lv.setUint16(10, dosTime, true);   // Hora modificación DOS
      lv.setUint16(12, dosDate, true);   // Fecha modificación DOS
      lv.setUint32(14, crc, true);       // CRC-32
      lv.setUint32(18, dataLength, true); // Tamaño comprimido
      lv.setUint32(22, dataLength, true); // Tamaño sin comprimir
      lv.setUint16(26, pathBytes.length, true); // Longitud del nombre
      lv.setUint16(28, 0, true);         // Longitud de campos extra

      localHeader.set(pathBytes, 30);
      localHeader.set(dataBytes, 30 + pathBytes.length);

      localHeaders.push(localHeader);

      // 2. Encabezado del Directorio Central (Central Directory Header - 46 bytes + path)
      // Firma: 0x02014b50
      const cdHeader = new Uint8Array(46 + pathBytes.length);
      const cv = new DataView(cdHeader.buffer);

      cv.setUint32(0, 0x02014b50, true); // Firma central directory header
      cv.setUint16(4, 20, true);         // Versión creada por
      cv.setUint16(6, 20, true);         // Versión necesaria para extraer
      cv.setUint16(8, 0x0800, true);     // Flags (UTF-8)
      cv.setUint16(10, 0, true);         // Método de compresión (0 = Store)
      cv.setUint16(12, dosTime, true);   // Hora DOS
      cv.setUint16(14, dosDate, true);   // Fecha DOS
      cv.setUint32(16, crc, true);       // CRC-32
      cv.setUint32(20, dataLength, true); // Tamaño comprimido
      cv.setUint32(24, dataLength, true); // Tamaño sin comprimir
      cv.setUint16(28, pathBytes.length, true); // Longitud del nombre
      cv.setUint16(30, 0, true);         // Extra field length
      cv.setUint16(32, 0, true);         // File comment length
      cv.setUint16(34, 0, true);         // Disk number start
      cv.setUint16(36, 0, true);         // Internal file attributes
      cv.setUint32(38, 0, true);         // External file attributes
      cv.setUint32(42, currentOffset, true); // Offset relativo del local header

      cdHeader.set(pathBytes, 46);
      centralDirectoryHeaders.push(cdHeader);

      currentOffset += localHeader.length;
    }

    const centralDirectoryOffset = currentOffset;
    let centralDirectorySize = 0;
    for (const cd of centralDirectoryHeaders) {
      centralDirectorySize += cd.length;
    }

    // 3. Registro de Fin del Directorio Central (End of Central Directory Record - 22 bytes)
    // Firma: 0x06054b50
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);

    ev.setUint32(0, 0x06054b50, true); // Firma EOCD
    ev.setUint16(4, 0, true);          // Número de disco
    ev.setUint16(6, 0, true);          // Disco donde comienza el directorio central
    ev.setUint16(8, files.length, true); // Número de entradas en este disco
    ev.setUint16(10, files.length, true); // Total de entradas en el directorio central
    ev.setUint32(12, centralDirectorySize, true); // Tamaño del directorio central
    ev.setUint32(16, centralDirectoryOffset, true); // Offset del directorio central
    ev.setUint16(20, 0, true);         // Longitud comentario ZIP

    // Unir todas las partes en un único Blob de tipo ZIP
    const totalParts: Uint8Array[] = [...localHeaders, ...centralDirectoryHeaders, eocd];
    return new Blob(totalParts as any, { type: 'application/zip' });
  }

  /**
   * Dispara la descarga de un Blob en el navegador
   */
  downloadBlob(blob: Blob, filename: string): void {
    if (typeof window === 'undefined') return;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 250);
  }

  /**
   * Descarga un archivo de texto plano (JSON, SQL, Java, etc.)
   */
  downloadText(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8'): void {
    const blob = new Blob([content], { type: mimeType });
    this.downloadBlob(blob, filename);
  }
}
