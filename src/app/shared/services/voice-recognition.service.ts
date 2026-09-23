import { Injectable, NgZone, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VoiceRecognitionService {
  recognition: any;
  isListening = signal<boolean>(false);
  transcript = signal<string>('');
  private interimTranscript = '';
  private finalizedPhrases: { [index: number]: string } = {};

  constructor(private zone: NgZone) {
    this.init();
  }

  init() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'es-ES'; // Default language

      this.recognition.onstart = () => {
        this.zone.run(() => {
          this.isListening.set(true);
        });
      };

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        // Reconstruimos la transcripción de forma limpia y sin estados persistentes desde 0 en cada evento.
        // Esto previene que índices desfasados dupliquen frases.
        for (let i = 0; i < event.results.length; ++i) {
          const resultText = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += ' ' + resultText.trim();
          } else {
            interim += resultText;
          }
        }

        let cleanFinal = final.trim();
        cleanFinal = this.deduplicatePhrases(cleanFinal);

        this.zone.run(() => {
          this.transcript.set(cleanFinal);
          this.interimTranscript = interim;
        });
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        this.zone.run(() => {
          this.isListening.set(false);
        });
      };

      this.recognition.onend = () => {
        this.zone.run(() => {
          this.isListening.set(false);
        });
      };
    } else {
      console.warn('Speech Recognition API no soportada en este navegador.');
    }
  }

  /**
   * Elimina duplicaciones consecutivas de palabras y frases comunes que algunos navegadores móviles
   * o virtuales (como WebKit/Chrome en Android/iOS) duplican por eco en las ráfagas de SpeechRecognition.
   */
  private deduplicatePhrases(text: string): string {
    if (!text) return '';
    const words = text.split(/\s+/);
    const result: string[] = [];
    
    for (let i = 0; i < words.length; i++) {
      // Evitar duplicaciones de una sola palabra consecutiva larga (>3 caracteres)
      if (result.length > 0 && words[i].toLowerCase() === result[result.length - 1].toLowerCase()) {
        if (words[i].length > 3) {
          continue;
        }
      }
      
      // Evitar duplicaciones de frases de 2 palabras
      if (result.length >= 2 && i + 1 < words.length) {
        const prev2 = result[result.length - 2] + ' ' + result[result.length - 1];
        const next2 = words[i] + ' ' + words[i + 1];
        if (prev2.toLowerCase() === next2.toLowerCase()) {
          i++; // Saltar palabra extra
          continue;
        }
      }

      // Evitar duplicaciones de frases de 3 palabras
      if (result.length >= 3 && i + 2 < words.length) {
        const prev3 = result[result.length - 3] + ' ' + result[result.length - 2] + ' ' + result[result.length - 1];
        const next3 = words[i] + ' ' + words[i + 1] + ' ' + words[i + 2];
        if (prev3.toLowerCase() === next3.toLowerCase()) {
          i += 2; // Saltar palabras extra
          continue;
        }
      }
      
      result.push(words[i]);
    }
    
    return result.join(' ');
  }

  start() {
    if (!this.recognition) return;
    this.clear(); // Limpiar transcripciones anteriores
    this.isListening.set(true);
    this.recognition.start();
  }

  stop() {
    if (!this.recognition) return;
    this.recognition.stop();
  }

  clear() {
    this.transcript.set('');
    this.interimTranscript = '';
    this.finalizedPhrases = {};
  }

  getInterim() {
    return this.interimTranscript;
  }
}
