import { Component, inject, signal, output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UmlPromptGeneratorService, PromptGeneratedResult } from '../../services/uml-prompt-generator.service';

export type PromptVoiceState = 'listening' | 'no_speech' | 'analyzing' | 'ready' | 'manual';

@Component({
  selector: 'app-uml-prompt-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './uml-prompt-modal.component.html',
  styleUrl: './uml-prompt-modal.component.css'
})
export class UmlPromptModalComponent implements OnInit, OnDestroy {
  private promptService = inject(UmlPromptGeneratorService);

  // Eventos de salida
  generate = output<{ result: PromptGeneratedResult; replaceMode: boolean }>();
  close = output<void>();

  // Estados reactivos
  voiceState = signal<PromptVoiceState>('listening');
  promptText = signal<string>('');
  transcript = signal<string>('');
  replaceCurrent = signal<boolean>(true);
  preview = signal<PromptGeneratedResult | null>(null);
  isListening = signal<boolean>(false);

  // Reconocimiento de voz nativo local (Web Speech API)
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;

  // Timers de paciencia y silencio
  private initialSilenceTimer: any = null;
  private speechSilenceTimer: any = null;

  presets = [
    {
      id: 'vet',
      title: '🐾 Clínica Veterinaria (Caso Examen)',
      description: 'Cliente, Mascota, Veterinario, CitaMedica y Tratamiento con composición y asociaciones.',
      prompt: 'Crear sistema para clínica veterinaria con Clientes, Mascotas, Citas Médicas, Veterinarios y Tratamientos.'
    },
    {
      id: 'ventas',
      title: '🛒 Facturación y Ventas',
      description: 'Cliente, Factura, DetalleFactura, Producto y Categoria con cálculo de importes.',
      prompt: 'Diseñar sistema de facturación electrónica con Cliente, Factura, DetalleFactura, Producto y Categorías.'
    },
    {
      id: 'hospital',
      title: '🏥 Hospital y Consultas',
      description: 'Paciente, Médico, ConsultaMedica e Historial Clínico con antecedentes y recetas.',
      prompt: 'Generar modelo de gestión hospitalaria con Pacientes, Médicos especialistas, Consultas e Historial Clínico.'
    },
    {
      id: 'biblioteca',
      title: '📚 Biblioteca Universitaria',
      description: 'Lector, Libro, Préstamo y Autor con control de devoluciones y ejemplares.',
      prompt: 'Modelo para biblioteca con Lectores, Libros, Préstamos y Autores.'
    },
    {
      id: 'taller',
      title: '🚗 Taller Mecánico',
      description: 'Cliente, Vehículo, OrdenReparación y Mecánico.',
      prompt: 'Sistema para taller automotriz con Clientes, Vehículos, Órdenes de Reparación y Mecánicos.'
    }
  ];

  ngOnInit(): void {
    this.initSpeechServices();
    // Iniciar automáticamente en modo escucha al abrir (experiencia YouTube Voice Search)
    this.startDictation();
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.stopDictation(false);
  }

  private initSpeechServices(): void {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        this.synthesis = window.speechSynthesis;
      }

      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        this.recognition = new SpeechRec();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'es-ES';

        this.recognition.onstart = () => {
          this.isListening.set(true);
        };

        this.recognition.onresult = (event: any) => {
          // Reconstruir el texto completo acumulado desde el resultado 0
          // Esto evita que pausas del usuario borren o corten lo dicho anteriormente
          let fullText = '';
          for (let i = 0; i < event.results.length; ++i) {
            fullText += event.results[i][0].transcript + ' ';
          }
          fullText = fullText.trim();

          if (fullText) {
            this.promptText.set(fullText);
            this.transcript.set(fullText);

            // Una vez que el usuario empezó a hablar, cancelar el timer de silencio inicial
            this.clearInitialSilenceTimer();

            // Reiniciar timer de paciencia extendida (3.5 segundos de silencio antes de finalizar)
            this.resetSpeechSilenceTimer();
          }
        };

        this.recognition.onerror = (event: any) => {
          if (event.error === 'no-speech') {
            this.handleNoSpeech();
          } else {
            console.warn('SpeechRecognition error en Prompt Modal:', event.error);
            this.isListening.set(false);
          }
        };

        this.recognition.onend = () => {
          // Si el estado aún requiere escuchar pero el navegador cerró el stream
          if (this.voiceState() === 'listening' && this.isListening()) {
            try {
              this.recognition.start();
            } catch {
              this.isListening.set(false);
            }
          }
        };

        // Solicitar permisos de micrófono en Chrome/Edge
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
        }
      }
    }
  }

  startDictation(): void {
    if (!this.recognition) {
      this.voiceState.set('manual');
      return;
    }

    this.clearTimers();
    this.voiceState.set('listening');
    this.isListening.set(true);
    this.transcript.set('');
    this.promptText.set('');
    this.preview.set(null);

    try {
      this.recognition.start();
    } catch {
      // Ya estaba iniciado o requiere reinicio
    }

    // Timer de paciencia inicial: Si pasan 6.0 segundos sin que el usuario diga nada
    this.initialSilenceTimer = setTimeout(() => {
      if (!this.promptText().trim()) {
        this.handleNoSpeech();
      }
    }, 6000);
  }

  stopDictation(triggerProcess: boolean = true): void {
    this.clearTimers();
    this.isListening.set(false);

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }

    if (triggerProcess && this.promptText().trim()) {
      this.finishSpeechAndGenerate();
    }
  }

  private handleNoSpeech(): void {
    this.clearTimers();
    this.isListening.set(false);
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }

    this.voiceState.set('no_speech');
    this.speak('No se escuchó, por favor repite de nuevo.');
  }

  private resetSpeechSilenceTimer(): void {
    if (this.speechSilenceTimer) {
      clearTimeout(this.speechSilenceTimer);
    }

    // Paciencia de 3.5 segundos tras hablar para permitir pausas y recordar entidades
    this.speechSilenceTimer = setTimeout(() => {
      if (this.promptText().trim()) {
        this.finishSpeechAndGenerate();
      } else {
        this.handleNoSpeech();
      }
    }, 3500);
  }

  finishSpeechAndGenerate(): void {
    this.clearTimers();
    this.isListening.set(false);
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }

    const text = this.promptText().trim();
    if (!text) {
      this.handleNoSpeech();
      return;
    }

    this.voiceState.set('analyzing');

    // Procesar inmediatamente con el generador heurístico de IA
    const res = this.promptService.generateFromPrompt(text);
    this.preview.set(res);
    this.voiceState.set('ready');
  }

  toggleMicClick(): void {
    if (this.voiceState() === 'listening') {
      if (this.promptText().trim()) {
        // Si el usuario presiona el micrófono mientras habla, finaliza de inmediato sin esperar el silencio
        this.finishSpeechAndGenerate();
      } else {
        this.handleNoSpeech();
      }
    } else {
      // Reintentar o hablar de nuevo
      this.repetir();
    }
  }

  repetir(): void {
    this.promptText.set('');
    this.transcript.set('');
    this.preview.set(null);
    this.startDictation();
  }

  selectPreset(presetPrompt: string): void {
    this.promptText.set(presetPrompt);
    this.transcript.set(presetPrompt);
    this.stopDictation(false);
    const res = this.promptService.generateFromPrompt(presetPrompt);
    this.preview.set(res);
    this.voiceState.set('ready');
  }

  toggleManualMode(): void {
    if (this.voiceState() === 'manual') {
      this.startDictation();
    } else {
      this.stopDictation(false);
      this.voiceState.set('manual');
    }
  }

  onPromptChange(text: string): void {
    this.promptText.set(text);
    const trimmed = text.trim();
    if (trimmed) {
      const res = this.promptService.generateFromPrompt(trimmed);
      this.preview.set(res);
    } else {
      this.preview.set(null);
    }
  }

  speak(text: string): void {
    if (!this.synthesis) return;
    try {
      this.synthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      this.synthesis.speak(utterance);
    } catch {}
  }

  getClassNamesList(result: PromptGeneratedResult): string {
    return result.classes.map(c => c.name).join(', ');
  }

  ejecutarGeneracion(): void {
    const prev = this.preview();
    if (!prev) return;

    this.stopDictation(false);
    this.generate.emit({
      result: prev,
      replaceMode: this.replaceCurrent()
    });
  }

  cerrar(): void {
    this.stopDictation(false);
    this.close.emit();
  }

  private clearTimers(): void {
    this.clearInitialSilenceTimer();
    this.clearSpeechSilenceTimer();
  }

  private clearInitialSilenceTimer(): void {
    if (this.initialSilenceTimer) {
      clearTimeout(this.initialSilenceTimer);
      this.initialSilenceTimer = null;
    }
  }

  private clearSpeechSilenceTimer(): void {
    if (this.speechSilenceTimer) {
      clearTimeout(this.speechSilenceTimer);
      this.speechSilenceTimer = null;
    }
  }
}
