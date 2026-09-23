import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UmlVisionService, VisionScanResult } from '../../services/uml-vision.service';

@Component({
  selector: 'app-uml-vision-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './uml-vision-modal.component.html',
  styleUrl: './uml-vision-modal.component.css'
})
export class UmlVisionModalComponent {
  private visionService = inject(UmlVisionService);

  // Eventos de salida
  close = output<void>();
  diagramDetected = output<VisionScanResult>();

  // Estados del modal
  selectedImageBase64 = signal<string | null>(null);
  selectedFileName = signal<string>('');
  extractedText = signal<string>('');
  isScanning = signal<boolean>(false);
  scanResult = signal<VisionScanResult | null>(null);
  errorMessage = signal<string | null>(null);
  selectedTab = signal<'PREVIEW' | 'DETECTED_TABLE' | 'RAW_TEXT'>('PREVIEW');
  engineMode = signal<'LOCAL_2D' | 'GEMINI_VISION'>('LOCAL_2D');
  geminiApiKey = signal<string>(typeof localStorage !== 'undefined' ? (localStorage.getItem('gemini_vision_key') || '') : '');
  showGeminiConfig = signal<boolean>(false);

  setEngineMode(mode: 'LOCAL_2D' | 'GEMINI_VISION'): void {
    this.engineMode.set(mode);
    if (mode === 'GEMINI_VISION' && !this.geminiApiKey()) {
      this.showGeminiConfig.set(true);
    }
  }

  saveGeminiKey(key: string): void {
    this.geminiApiKey.set(key);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gemini_vision_key', key.trim());
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedFileName.set(file.name);
      this.visionService.fileToBase64(file).then((base64: string) => {
        this.selectedImageBase64.set(base64);
        this.scanResult.set(null);
        this.extractedText.set('');
        this.errorMessage.set(null);
        this.selectedTab.set('PREVIEW');
      }).catch((err: any) => {
        this.errorMessage.set('Error al procesar la imagen: ' + (err?.message || err));
      });
    }
  }

  procesarPizarra(): void {
    const base64 = this.selectedImageBase64();
    if (!base64) {
      this.errorMessage.set('Por favor selecciona una foto o captura del diagrama.');
      return;
    }

    this.isScanning.set(true);
    this.errorMessage.set(null);

    // No pasar extractedText para obligar a que el motor OCR analice fielmente la imagen actual
    this.visionService.scanWhiteboardImage(
      base64, 
      this.selectedFileName(), 
      undefined,
      this.engineMode() === 'GEMINI_VISION',
      this.geminiApiKey()
    ).subscribe({
      next: (result) => {
        this.isScanning.set(false);
        this.scanResult.set(result);
        if (result.rawTextExtracted) {
          this.extractedText.set(result.rawTextExtracted);
        }
        this.selectedTab.set('DETECTED_TABLE');
      },
      error: (err) => {
        this.isScanning.set(false);
        this.errorMessage.set('Error al digitalizar imagen: ' + (err?.message || 'Error desconocido'));
      }
    });
  }

  autoCorregirTexto(): void {
    const raw = this.extractedText();
    if (!raw.trim()) return;
    const cleaned = this.visionService.cleanTextTypos(raw);
    this.extractedText.set(cleaned);
    const result = this.visionService.parseUmlFromRawText(
      cleaned, 
      this.selectedImageBase64() || '', 
      'Texto Corregido Automáticamente'
    );
    this.scanResult.set(result);
  }

  actualizarDesdeTexto(): void {
    const text = this.extractedText().trim();
    if (!text) {
      this.errorMessage.set('El texto está vacío. Escribe al menos el nombre de la clase.');
      return;
    }
    const cleaned = this.visionService.cleanTextTypos(text);
    this.extractedText.set(cleaned);
    const result = this.visionService.parseUmlFromRawText(
      cleaned, 
      this.selectedImageBase64() || '', 
      'Editor de Texto UML'
    );
    this.scanResult.set(result);
    this.selectedTab.set('DETECTED_TABLE');
  }

  inyectarAlLienzo(): void {
    const res = this.scanResult();
    if (res) {
      this.diagramDetected.emit(res);
      this.close.emit();
    }
  }

  cerrar(): void {
    this.close.emit();
  }
}

