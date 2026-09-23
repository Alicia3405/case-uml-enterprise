import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VoiceCommandService, ParsedVoiceCommand } from '../../services/voice-command.service';

@Component({
  selector: 'app-uml-voice-dock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './uml-voice-dock.component.html',
  styleUrl: './uml-voice-dock.component.css'
})
export class UmlVoiceDockComponent {
  public voiceService = inject(VoiceCommandService);

  // Evento emitido al workspace para ejecutar el comando
  commandExecuted = output<ParsedVoiceCommand>();

  expanded = signal<boolean>(false);
  voiceMuted = signal<boolean>(false);
  customInputText = signal<string>('');

  // Lista de sugerencias de órdenes para demostración rápida ante el evaluador
  suggestedCommands = [
    'Crea una tabla llamada Paciente',
    'Crea clase Factura',
    'Agregar atributo total tipo Double en Factura',
    'Crear actor Médico',
    'Agregar nota',
    'Escribir en nota detalles de la clase paciente',
    'Relacionar Paciente con Médico de muchos a muchos',
    'Relacionar Paciente con CitaMedica de cero a muchos',
    'Crear rombo Descuento',
    'Renombrar Paciente a Cliente',
    'Deshacer',
    'Rehacer',
    'Generar SQL',
    'Validar XMI'
  ];

  toggleListening(): void {
    this.voiceService.toggleListening();
  }

  toggleExpanded(): void {
    this.expanded.update(v => !v);
  }

  toggleMute(): void {
    this.voiceMuted.update(v => !v);
  }

  /**
   * Permite ejecutar una orden de prueba haciendo clic directamente sobre el chip
   */
  simulateVoiceCommand(commandText: string): void {
    const cmd = this.voiceService.processVoiceInput(commandText);
    this.commandExecuted.emit(cmd);
  }

  executeCustomText(): void {
    const text = this.customInputText().trim();
    if (!text) return;
    this.simulateVoiceCommand(text);
    this.customInputText.set('');
  }
}
