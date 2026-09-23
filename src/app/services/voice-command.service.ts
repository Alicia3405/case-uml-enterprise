import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { UmlDataType, UmlElementType, UmlRelationType } from '../models/uml.models';

export type VoiceCommandType = 
  | 'CREATE_CLASS'
  | 'CREATE_DECISION'
  | 'CREATE_INTERFACE'
  | 'CREATE_ENUM'
  | 'CREATE_ACTOR'
  | 'CREATE_NOTE'
  | 'UPDATE_NOTE'
  | 'ADD_ATTRIBUTE'
  | 'ADD_METHOD'
  | 'DELETE_METHOD'
  | 'CONNECT_CLASSES'
  | 'DELETE_CLASS'
  | 'RENAME_CLASS'
  | 'UNDO'
  | 'REDO'
  | 'EXPORT_XMI'
  | 'VALIDATE_XMI'
  | 'GENERATE_SQL'
  | 'CLEAR_CANVAS'
  | 'ZOOM_IN'
  | 'ZOOM_OUT'
  | 'RESET_VIEW'
  | 'UNKNOWN';

export interface ParsedVoiceCommand {
  rawText: string;
  type: VoiceCommandType;
  targetClassName?: string;
  newElementName?: string;
  sourceClassName?: string;
  elementName?: string;
  elementType?: UmlElementType;
  dataType?: UmlDataType;
  returnType?: string;
  relationType?: UmlRelationType;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  isPrimaryKey?: boolean;
  noteText?: string;
  noteTarget?: string;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceCommandService {
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;

  // Estados reactivos
  isListening = signal<boolean>(false);
  isSupported = signal<boolean>(false);
  transcript = signal<string>('');
  lastCommand = signal<ParsedVoiceCommand | null>(null);
  feedbackMessage = signal<string>('');

  // Emisor de eventos para que el espacio de trabajo UML reaccione
  commandStream$ = new Subject<ParsedVoiceCommand>();

  // Timer de paciencia para pausas naturales al hablar
  private commandDebounceTimer: any = null;
  private accumulatedCommandText: string = '';

  constructor() {
    this.initSpeechServices();
  }

  private initSpeechServices(): void {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'es-ES'; // Compatible con acentos de español neutro y latino

        this.recognition.onstart = () => {
          this.isListening.set(true);
        };

        this.recognition.onresult = (event: any) => {
          if (this.isSpeakingResponse) {
            return;
          }

          // Reconstruir el texto completo acumulado desde el inicio de la ráfaga
          let fullText = '';
          for (let i = 0; i < event.results.length; ++i) {
            fullText += event.results[i][0].transcript + ' ';
          }
          fullText = fullText.trim();
          if (fullText) {
            // Ignorar auto-escucha de respuestas del sistema (eco de altavoz)
            const lower = fullText.toLowerCase();
            if (lower.includes('creada') || lower.includes('ya existe') || lower.includes('agregado') || lower.includes('clase')) {
              if (this.isSpeakingResponse) return;
            }

            this.transcript.set(fullText);
            this.accumulatedCommandText = fullText;

            // Timer de paciencia extendida para que pausas cortas no corten el comando
            if (this.commandDebounceTimer) {
              clearTimeout(this.commandDebounceTimer);
            }
            this.commandDebounceTimer = setTimeout(() => {
              if (this.accumulatedCommandText.trim()) {
                const toExecute = this.accumulatedCommandText.trim();
                this.accumulatedCommandText = '';
                this.transcript.set('');
                this.processVoiceInput(toExecute);
              }
            }, 1800);
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition error:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
            this.isListening.set(false);
            this.feedbackMessage.set('Permiso de micrófono no disponible (requiere HTTPS en móviles). Usa el campo de texto o la app móvil.');
          } else if (event.error !== 'no-speech') {
            this.isListening.set(false);
          }
        };

        this.recognition.onend = () => {
          // Solo reiniciar si sigue activo intencionalmente y no hubo error crítico
          if (this.isListening()) {
            try {
              this.recognition.start();
            } catch {
              this.isListening.set(false);
            }
          }
        };

        this.isSupported.set(true);

        // Intentar solicitar permisos solo si el navegador lo soporta de forma segura
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => console.log('Permiso de micrófono concedido.'))
            .catch(err => {
              console.warn('Permiso de micrófono no concedido en este origen:', err);
            });
        }
      } else {
        this.isSupported.set(false);
      }

      if ('speechSynthesis' in window) {
        this.synthesis = window.speechSynthesis;
      }
    }
  }

  /**
   * Inicia o detiene el reconocimiento de voz
   */
  toggleListening(): boolean {
    if (!this.recognition) return false;

    if (this.isListening()) {
      this.stopListening();
      return false;
    } else {
      this.startListening();
      return true;
    }
  }

  startListening(): void {
    this.transcript.set('Escuchando orden...');
    this.accumulatedCommandText = '';
    
    if (this.recognition) {
      this.isListening.set(true);
      try {
        this.recognition.start();
      } catch (e) {
        console.warn('Speech recognition start error:', e);
      }
    } else {
      // Fallback si no hay API de reconocimiento por SSL/Navegador: simular recepción
      this.isListening.set(true);
    }
  }

  stopListening(): void {
    if (this.commandDebounceTimer) {
      clearTimeout(this.commandDebounceTimer);
      this.commandDebounceTimer = null;
      if (this.accumulatedCommandText.trim()) {
        const toExecute = this.accumulatedCommandText.trim();
        this.accumulatedCommandText = '';
        this.transcript.set('');
        this.processVoiceInput(toExecute);
      }
    } else {
      this.accumulatedCommandText = '';
    }
    if (this.recognition && this.isListening()) {
      this.isListening.set(false);
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn(e);
      }
    }
  }

  private isSpeakingResponse = false;

  /**
   * Síntesis vocal (TTS): Responde al usuario de forma audible
   */
  speak(text: string): void {
    if (!this.synthesis) return;
    try {
      this.synthesis.cancel(); // Detener cualquier locución previa
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        this.isSpeakingResponse = true;
      };

      utterance.onend = () => {
        setTimeout(() => {
          this.isSpeakingResponse = false;
        }, 600);
      };

      utterance.onerror = () => {
        this.isSpeakingResponse = false;
      };

      this.synthesis.speak(utterance);
    } catch (e) {
      this.isSpeakingResponse = false;
      console.warn('Error en SpeechSynthesis:', e);
    }
  }

  /**
   * Analizador semántico NLP ultra-flexible para comandos en español
   */
  processVoiceInput(rawText: string): ParsedVoiceCommand {
    if (this.isSpeakingResponse) {
      // Ignorar ecos generados por los parlantes mientras el sistema responde
      return { rawText, type: 'UNKNOWN', description: '' };
    }

    const cmd = this.parseGrammar(rawText);
    
    this.lastCommand.set(cmd);
    this.commandStream$.next(cmd);

    // Retroalimentación audible si se reconoció una acción
    if (cmd.type !== 'UNKNOWN') {
      this.speak(cmd.description);
    }

    return cmd;
  }

  private parseGrammar(rawOriginal: string): ParsedVoiceCommand {
    // 1. Limpieza de puntuación y normalización
    // Quitar puntos finales (que Web Speech API agrega siempre), comas, signos, etc.
    const clean = rawOriginal
      .toLowerCase()
      .replace(/[.,;:!?¡¿"'()\[\]]/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quita tildes
      .replace(/\s+/g, ' ')
      .trim();

    // Verbos flexibles
    const V_CREATE = '(?:crear?|creame|nueva|nuevo|agrega|agregar?|inserta|insertar?|dibuja|dibujar?|haz|hacer?)';
    const V_DELETE = '(?:eliminar?|elimina|borrar?|borra|quitar?|quita|suprimir?|suprime|destruye|destruir?)';
    const V_CONNECT = '(?:relacionar?|relaciona|conectar?|conecta|asociar?|asocia|unir?|une|vincular?|vincula)';
    const V_RENAME = '(?:renombrar?|renombra|cambiar?(?:\\s+(?:el\\s+)?nombre(?:\\s+de)?)?|cambia(?:\\s+(?:el\\s+)?nombre(?:\\s+de)?)?|modificar?(?:\\s+(?:el\\s+)?nombre(?:\\s+de)?)?)';
    const FILLERS = '(?:una?|el|la|los|las)?\\s*';
    const CALLED = '(?:llamada?o?s?|con\\s+nombre|de\\s+nombre)?\\s*';

    // 0. DESHACER (UNDO) Y REHACER (REDO)
    if (clean === 'deshacer' || clean === 'deshaz' || clean === 'volver atras' || clean === 'deshacer cambio' || clean === 'control z') {
      return {
        rawText: rawOriginal,
        type: 'UNDO',
        description: 'Acción deshecha.'
      };
    }
    if (clean === 'rehacer' || clean === 'rehaz' || clean === 'volver a hacer' || clean === 'rehacer cambio' || clean === 'control y') {
      return {
        rawText: rawOriginal,
        type: 'REDO',
        description: 'Acción rehecha.'
      };
    }

    // 1. ACCIONES DEL SISTEMA
    if (clean.includes('exportar xmi') || clean.includes('descargar xmi') || clean.includes('guardar xmi')) {
      return { rawText: rawOriginal, type: 'EXPORT_XMI', description: 'Exportando modelo XMI para Enterprise Architect.' };
    }
    if (clean.includes('validar xmi') || clean.includes('verificar xmi')) {
      return { rawText: rawOriginal, type: 'VALIDATE_XMI', description: 'Abriendo validador de conformidad XMI.' };
    }
    if (clean.includes('generar sql') || clean.includes('generar ddl') || clean.includes('crear tablas') || clean.includes('postgresql')) {
      return { rawText: rawOriginal, type: 'GENERATE_SQL', description: 'Generando script DDL para PostgreSQL.' };
    }
    if (clean.includes('limpiar lienzo') || clean.includes('borrar todo') || clean.includes('nuevo diagrama')) {
      return { rawText: rawOriginal, type: 'CLEAR_CANVAS', description: 'Lienzo reiniciado.' };
    }
    if (clean.includes('acercar') || clean.includes('zoom mas') || clean.includes('aumentar zoom')) {
      return { rawText: rawOriginal, type: 'ZOOM_IN', description: 'Aumentando zoom.' };
    }
    if (clean.includes('alejar') || clean.includes('zoom menos') || clean.includes('disminuir zoom')) {
      return { rawText: rawOriginal, type: 'ZOOM_OUT', description: 'Disminuyendo zoom.' };
    }
    if (clean.includes('restablecer vista') || clean.includes('centrar') || clean.includes('resetear zoom')) {
      return { rawText: rawOriginal, type: 'RESET_VIEW', description: 'Vista restablecida al 100%.' };
    }

    // 2. CREAR ACTOR
    // Ej: "crea un actor llamado paciente", "crear actor medico", "nuevo actor administrador"
    const actorRegex = new RegExp(`^${V_CREATE}\\s+${FILLERS}(?:actor|rol|usuario\\s+externo)\\s+${CALLED}(.+)$`, 'i');
    const actorMatch = clean.match(actorRegex);
    if (actorMatch) {
      const name = this.toPascalCase(actorMatch[1].trim());
      return {
        rawText: rawOriginal,
        type: 'CREATE_ACTOR',
        elementName: name,
        elementType: 'ACTOR',
        description: `Actor ${name} creado.`
      };
    }

    // 3. CREAR ROMBO / DECISIÓN
    // Ej: "crear rombo decision", "crea un rombo llamado descuento", "nueva decision evaluacion"
    const decisionRegex = new RegExp(`^${V_CREATE}\\s+${FILLERS}(?:rombo|decision|diamante|bifurcacion)\\s+${CALLED}(.+)$`, 'i');
    const decisionMatch = clean.match(decisionRegex);
    if (decisionMatch) {
      const name = this.toPascalCase(decisionMatch[1].trim());
      return {
        rawText: rawOriginal,
        type: 'CREATE_DECISION',
        elementName: name,
        elementType: 'DECISION',
        description: `Rombo UML ${name} creado.`
      };
    }

    // 4. CREAR INTERFAZ
    // Ej: "crear interfaz servicio facturacion", "nueva interfaz repositorio", "crea una interfaz llamada pago"
    const interfaceRegex = new RegExp(`^${V_CREATE}\\s+${FILLERS}(?:interfaz|interface)\\s+${CALLED}(.+)$`, 'i');
    const interfaceMatch = clean.match(interfaceRegex);
    if (interfaceMatch) {
      const rawName = this.toPascalCase(interfaceMatch[1].trim());
      const name = rawName.startsWith('I') ? rawName : 'I' + rawName;
      return {
        rawText: rawOriginal,
        type: 'CREATE_INTERFACE',
        elementName: name,
        elementType: 'INTERFACE',
        description: `Interfaz ${name} creada.`
      };
    }

    // 5. CREAR NOTA / COMENTARIO (Con o sin texto inicial)
    // Ej: "agregar nota", "crear nota", "crea una nota que diga revisar claves"
    const noteRegex = new RegExp(`^${V_CREATE}\\s+${FILLERS}(?:nota|comentario)(?:\\s+(?:que\\s+diga\\s+|con\\s+(?:el\\s+)?texto\\s+|de\\s+)?(.+))?$`, 'i');
    const noteMatch = clean.match(noteRegex);
    if (noteMatch) {
      const note = noteMatch[1] ? noteMatch[1].trim() : '';
      return {
        rawText: rawOriginal,
        type: 'CREATE_NOTE',
        noteText: note || undefined,
        elementType: 'NOTE',
        description: note ? `Nota creada con texto: "${note}".` : `Nota adhesiva agregada al lienzo.`
      };
    }

    // 5.1 ESCRIBIR / REESCRIBIR / MODIFICAR EN NOTA
    // Ej: "escribir en nota detalles de la clase paciente"
    //     "escribir en nota lo siguiente cita confirmada"
    //     "reescribir en nota paciente en ayunas"
    //     "escribir en nota 1 requisitos de validacion"
    const writeNoteRegex = /^(?:escribir?|escribe|reescribir?|reescribe|modificar?|modifica|cambiar?|cambia)\s+(?:el\s+texto\s+de\s+|el\s+contenido\s+de\s+)?(?:en\s+)?(?:la\s+)?nota(?:\s+(\d+|[a-z0-9_]+))?\s+(?:lo\s+siguiente\s+|que\s+diga\s+|a\s+|:\s+)?(.+)$/i;
    const writeNoteMatch = clean.match(writeNoteRegex);
    if (writeNoteMatch) {
      const targetIdentifier = writeNoteMatch[1] ? writeNoteMatch[1].trim() : undefined;
      const content = writeNoteMatch[2] ? writeNoteMatch[2].trim() : '';
      if (content) {
        return {
          rawText: rawOriginal,
          type: 'UPDATE_NOTE',
          noteTarget: targetIdentifier,
          noteText: content,
          description: `Texto escrito en la nota: "${content}".`
        };
      }
    }

    // 6. CREAR CLASE / TABLA / ENTIDAD (Con o sin artículos, llamada/o, etc.)
    // Ej: "crea clase factura", "crear tabla paciente", "crea una tabla llamado paciente", "nueva entidad historia clinica"
    const classRegex = new RegExp(`^${V_CREATE}\\s+${FILLERS}(?:clase|tabla|entidad)\\s+${CALLED}(.+)$`, 'i');
    const classMatch = clean.match(classRegex);
    if (classMatch) {
      const name = this.toPascalCase(classMatch[1].trim());
      return {
        rawText: rawOriginal,
        type: 'CREATE_CLASS',
        elementName: name,
        elementType: 'CLASS',
        description: `Clase ${name} creada.`
      };
    }

    // 7. RENOMBRAR ELEMENTO (Tabla / Clase / Rombo / Actor o directo)
    // Ej: "renombrar tabla paciente a cliente", "renombrar paciente a cliente", "cambiar nombre de cita medica a consulta externa"
    // Regex flexible para: [V_RENAME] [tipo?] [origen] [a|por|hacia] [destino]
    const renameRegex = new RegExp(`^${V_RENAME}\\s+${FILLERS}(?:tabla|clase|entidad|rombo|decision|actor)?\\s*([a-z0-9\\s]+?)\\s+(?:a|por|hacia)\\s+${FILLERS}(?:tabla|clase|entidad|rombo|decision|actor)?\\s*([a-z0-9\\s]+)$`, 'i');
    const renameMatch = clean.match(renameRegex);
    if (renameMatch) {
      const oldName = this.toPascalCase(renameMatch[1].trim());
      const newName = this.toPascalCase(renameMatch[2].trim());
      return {
        rawText: rawOriginal,
        type: 'RENAME_CLASS',
        targetClassName: oldName,
        newElementName: newName,
        description: `Elemento ${oldName} renombrado a ${newName}.`
      };
    }

    // 8. ELIMINAR ELEMENTO (Tabla / Clase / Rombo / Actor o directo)
    // Ej: "eliminar tabla paciente", "elimina cita medica", "borrar rombo descuento", "eliminar actor medico"
    const deleteRegex = new RegExp(`^${V_DELETE}\\s+${FILLERS}(?:tabla|clase|entidad|rombo|decision|actor)?\\s*${CALLED}(.+)$`, 'i');
    const deleteMatch = clean.match(deleteRegex);
    if (deleteMatch) {
      const target = this.toPascalCase(deleteMatch[1].trim());
      return {
        rawText: rawOriginal,
        type: 'DELETE_CLASS',
        targetClassName: target,
        description: `Elemento ${target} eliminado.`
      };
    }

    // 9. AGREGAR CLAVE PRIMARIA
    // Ej: "agregar clave primaria id en paciente", "anadir pk codigo a historia clinica"
    const addPkRegex = new RegExp(`^(?:agregar?|agrega|anadir?|anade|insertar?|inserta)\\s+${FILLERS}(?:clave\\s+primaria|pk|identificador)\\s+([a-z0-9_]+)\\s+(?:en|a|para)\\s+${FILLERS}(?:la\\s+)?(?:clase|tabla|entidad)?\\s*(.+)$`, 'i');
    const addPkMatch = clean.match(addPkRegex);
    if (addPkMatch) {
      const attrName = addPkMatch[1].trim();
      const targetClass = this.toPascalCase(addPkMatch[2].trim());
      return {
        rawText: rawOriginal,
        type: 'ADD_ATTRIBUTE',
        elementName: attrName,
        targetClassName: targetClass,
        dataType: 'Long',
        isPrimaryKey: true,
        description: `Clave primaria ${attrName} tipo Long agregada a ${targetClass}.`
      };
    }

    // 10. AGREGAR ATRIBUTO CON TIPO ESPECIFICADO
    // Ej: "agregar atributo total tipo double en factura", "anadir campo fecha tipo localdate a cita medica"
    const addAttrTypeRegex = new RegExp(`^(?:agregar?|agrega|anadir?|anade|insertar?|inserta)\\s+${FILLERS}(?:atributo|campo|propiedad)\\s+([a-z0-9_]+)\\s+(?:de\\s+tipo|tipo)\\s+([a-z0-9]+)\\s+(?:en|a|para)\\s+${FILLERS}(?:la\\s+)?(?:clase|tabla|entidad)?\\s*(.+)$`, 'i');
    const addAttrTypeMatch = clean.match(addAttrTypeRegex);
    if (addAttrTypeMatch) {
      const attrName = addAttrTypeMatch[1].trim();
      const rawType = addAttrTypeMatch[2].trim();
      const targetClass = this.toPascalCase(addAttrTypeMatch[3].trim());
      const dataType = this.normalizeDataType(rawType);
      return {
        rawText: rawOriginal,
        type: 'ADD_ATTRIBUTE',
        elementName: attrName,
        targetClassName: targetClass,
        dataType: dataType,
        isPrimaryKey: false,
        description: `Atributo ${attrName} (${dataType}) agregado a ${targetClass}.`
      };
    }

    // 11. AGREGAR ATRIBUTO SIMPLE (Default String)
    // Ej: "agregar atributo telefono en paciente", "anadir campo observaciones a historia clinica"
    const addAttrSimpleRegex = new RegExp(`^(?:agregar?|agrega|anadir?|anade|insertar?|inserta)\\s+${FILLERS}(?:atributo|campo)\\s+([a-z0-9_]+)\\s+(?:en|a|para)\\s+${FILLERS}(?:la\\s+)?(?:clase|tabla|entidad)?\\s*(.+)$`, 'i');
    const addAttrSimpleMatch = clean.match(addAttrSimpleRegex);
    if (addAttrSimpleMatch) {
      const attrName = addAttrSimpleMatch[1].trim();
      const targetClass = this.toPascalCase(addAttrSimpleMatch[2].trim());
      return {
        rawText: rawOriginal,
        type: 'ADD_ATTRIBUTE',
        elementName: attrName,
        targetClassName: targetClass,
        dataType: 'String',
        isPrimaryKey: false,
        description: `Atributo ${attrName} tipo String agregado a ${targetClass}.`
      };
    }

    // 12. AGREGAR MÉTODO / OPERACIÓN / FUNCIÓN
    // Soporta:
    // - "crear metodo pagar en factura"
    // - "agregar metodo calcularTotal en factura"
    // - "creame una funcion validarUsuario retorno boolean en usuario"
    // - "anadir operacion obtenerSaldo tipo double a cuenta"
    // - "nuevo metodo registrar" (usa clase seleccionada)
    // - "agregar metodo imprimir" (usa clase seleccionada)
    const addMethodRegex = new RegExp(`^(?:${V_CREATE}|anadir?|anade)\\s+${FILLERS}(?:metodo|metodos|operacion|operaciones|funcion|funciones)\\s+${CALLED}([a-z0-9_\\s]+?)(?:\\s+(?:de\\s+tipo|tipo|con\\s+retorno|retorno)\\s+([a-z0-9_]+))?(?:\\s+(?:en|a|para|hacia|de)\\s+${FILLERS}(?:la\\s+)?(?:clase|tabla|entidad)?\\s*(.+))?$`, 'i');
    const addMethodMatch = clean.match(addMethodRegex);
    if (addMethodMatch) {
      const rawMethodName = addMethodMatch[1] ? addMethodMatch[1].trim() : 'nuevaOperacion';
      const rawReturnType = addMethodMatch[2] ? addMethodMatch[2].trim() : 'void';
      const rawTargetClass = addMethodMatch[3] ? addMethodMatch[3].trim() : '';

      const methodName = this.toCamelCase(rawMethodName);
      const returnType = rawReturnType === 'void' ? 'void' : this.normalizeDataType(rawReturnType);
      const targetClass = rawTargetClass ? this.toPascalCase(rawTargetClass) : undefined;

      const desc = targetClass 
        ? `Método ${methodName}() (${returnType}) agregado a ${targetClass}.`
        : `Método ${methodName}() (${returnType}) agregado a la clase seleccionada.`;

      return {
        rawText: rawOriginal,
        type: 'ADD_METHOD',
        elementName: methodName,
        targetClassName: targetClass,
        returnType: returnType,
        description: desc
      };
    }

    // 12.1 ELIMINAR MÉTODO / OPERACIÓN / FUNCIÓN
    // Ej: "eliminar metodo pagar en factura", "borrar funcion calcularTotal de factura"
    const deleteMethodRegex = new RegExp(`^${V_DELETE}\\s+${FILLERS}(?:metodo|metodos|operacion|operaciones|funcion|funciones)\\s+${CALLED}([a-z0-9_\\s]+?)(?:\\s+(?:en|a|para|de)\\s+${FILLERS}(?:la\\s+)?(?:clase|tabla|entidad)?\\s*(.+))?$`, 'i');
    const deleteMethodMatch = clean.match(deleteMethodRegex);
    if (deleteMethodMatch) {
      const rawMethodName = deleteMethodMatch[1] ? deleteMethodMatch[1].trim() : '';
      const rawTargetClass = deleteMethodMatch[2] ? deleteMethodMatch[2].trim() : '';
      const methodName = this.toCamelCase(rawMethodName);
      const targetClass = rawTargetClass ? this.toPascalCase(rawTargetClass) : undefined;

      return {
        rawText: rawOriginal,
        type: 'DELETE_METHOD',
        elementName: methodName,
        targetClassName: targetClass,
        description: targetClass 
          ? `Método ${methodName}() eliminado de ${targetClass}.`
          : `Método ${methodName}() eliminado de la clase seleccionada.`
      };
    }

    // 13. RELACIONAR / CONECTAR CLASES (Ultra-flexible con nombres compuestos y cardinalidades)
    // Ejemplos probados por el usuario:
    // - "relaciona factura con historia clinica de 1 a muchos"
    // - "relacionar cita medica con historia clinica de 1 a muchos"
    // - "relaciona factura con medico de 1 a muchos"
    // - "conectar cliente con pedido de muchos a muchos"
    const connectPrefixRegex = new RegExp(`^${V_CONNECT}\\s+${FILLERS}(?:clase|tabla|entidad)?\\s*(.+)$`, 'i');
    const connectPrefixMatch = clean.match(connectPrefixRegex);
    if (connectPrefixMatch) {
      const remainder = connectPrefixMatch[1].trim();

      // Separar por el conector "con", "y" o "a"
      const parts = remainder.split(/\s+(?:con|y|hacia)\s+/i);
      if (parts.length >= 2) {
        let srcPart = parts[0].trim();
        let tgtPart = parts.slice(1).join(' ').trim();

        // Limpiar prefijos de tipo si el usuario dijo "tabla paciente" o "la clase paciente"
        srcPart = srcPart.replace(/^(?:una?|el|la)?\s*(?:clase|tabla|entidad)?\s*/i, '').trim();
        tgtPart = tgtPart.replace(/^(?:una?|el|la)?\s*(?:clase|tabla|entidad)?\s*/i, '').trim();

        // Extraer cardinalidad si viene al final de tgtPart: "de 1 a muchos", "de uno a muchos", "1 a n", "muchos a muchos", etc.
        let relType: UmlRelationType = 'ONE_TO_MANY';
        let sourceMultiplicity: string | undefined = undefined;
        let targetMultiplicity: string | undefined = undefined;

        const cardMatch = tgtPart.match(/\s+(?:de\s+)?(?:(?:cero|0)\s*a\s*(?:muchos?|muchas?|n|\*)|(?:1|uno)\s*a\s*(?:muchos?|muchas?|n|\*)|(?:muchos?|muchas?|\*|n)\s*a\s*(?:muchos?|muchas?|\*|m|n)|(?:muchos?|muchas?|\*|n)\s*a\s*(?:1|uno)|(?:1|uno)\s*a\s*(?:1|uno)|(?:cero|0)\s*a\s*(?:1|uno)|herencia|composici[oó]n|agregaci[oó]n)\s*$/i);
        
        if (cardMatch) {
          const cardStr = cardMatch[0].toLowerCase();
          if (cardStr.includes('muchos a muchos') || cardStr.includes('muchas a muchas') || cardStr.includes('* a *') || cardStr.includes('n a m') || cardStr.includes('m a n') || cardStr.includes('n a n')) {
            relType = 'MANY_TO_MANY';
            sourceMultiplicity = '*';
            targetMultiplicity = '*';
          } else if (cardStr.includes('cero a muchos') || cardStr.includes('0 a muchos') || cardStr.includes('cero a n') || cardStr.includes('0 a n') || cardStr.includes('cero a *') || cardStr.includes('0 a *')) {
            relType = 'ONE_TO_MANY';
            sourceMultiplicity = '0..1';
            targetMultiplicity = '0..*';
          } else if (cardStr.includes('muchos a 1') || cardStr.includes('muchos a uno') || cardStr.includes('* a 1') || cardStr.includes('n a 1')) {
            relType = 'MANY_TO_ONE';
            sourceMultiplicity = '*';
            targetMultiplicity = '1';
          } else if (cardStr.includes('uno a uno') || cardStr.includes('1 a 1') || cardStr.includes('1 a uno')) {
            relType = 'ONE_TO_ONE';
            sourceMultiplicity = '1';
            targetMultiplicity = '1';
          } else if (cardStr.includes('cero a uno') || cardStr.includes('0 a 1') || cardStr.includes('cero a 1')) {
            relType = 'ONE_TO_ONE';
            sourceMultiplicity = '0..1';
            targetMultiplicity = '1';
          } else if (cardStr.includes('herencia') || cardStr.includes('hereda')) {
            relType = 'INHERITANCE';
            sourceMultiplicity = '';
            targetMultiplicity = '';
          } else if (cardStr.includes('composic')) {
            relType = 'COMPOSITION';
            sourceMultiplicity = '1';
            targetMultiplicity = '1..*';
          } else if (cardStr.includes('agregac')) {
            relType = 'AGGREGATION';
            sourceMultiplicity = '1';
            targetMultiplicity = '0..*';
          } else {
            relType = 'ONE_TO_MANY';
            sourceMultiplicity = '1';
            targetMultiplicity = '0..*';
          }
          tgtPart = tgtPart.substring(0, cardMatch.index).trim();
        } else {
          relType = 'ONE_TO_MANY';
          sourceMultiplicity = '1';
          targetMultiplicity = '0..*';
        }

        const sourceClass = this.toPascalCase(srcPart);
        const targetClass = this.toPascalCase(tgtPart);

        if (sourceClass && targetClass) {
          return {
            rawText: rawOriginal,
            type: 'CONNECT_CLASSES',
            sourceClassName: sourceClass,
            targetClassName: targetClass,
            relationType: relType,
            sourceMultiplicity,
            targetMultiplicity,
            description: `Relación (${relType} ${sourceMultiplicity || ''}..${targetMultiplicity || ''}) creada entre ${sourceClass} y ${targetClass}.`
          };
        }
      }
    }

    // 14. HERENCIA DIRECTA
    // Ej: "medico hereda de persona", "historia clinica es un documento"
    const inheritRegex = /([a-z0-9\s]+?)\s+(?:hereda\s+de|es\s+una?|extiende\s+de)\s+([a-z0-9\s]+)$/i;
    const inheritMatch = clean.match(inheritRegex);
    if (inheritMatch) {
      const subClass = this.toPascalCase(inheritMatch[1].trim().replace(/^(?:el|la|los|las)?\s*/i, ''));
      const superClass = this.toPascalCase(inheritMatch[2].trim().replace(/^(?:el|la|los|las)?\s*/i, ''));
      return {
        rawText: rawOriginal,
        type: 'CONNECT_CLASSES',
        sourceClassName: subClass,
        targetClassName: superClass,
        relationType: 'INHERITANCE',
        description: `Herencia: ${subClass} hereda de ${superClass}.`
      };
    }

    return {
      rawText: rawOriginal,
      type: 'UNKNOWN',
      description: `Orden no reconocida: "${rawOriginal}". Puedes decir "Crea tabla Paciente", "Relaciona Factura con Médico", "Renombrar Paciente a Cliente" o "Deshacer".`
    };
  }

  /**
   * Convierte texto con múltiples palabras a PascalCase (ej: "historia clínica" -> "HistoriaClinica")
   */
  toPascalCase(str: string): string {
    if (!str) return '';
    return str
      .trim()
      .split(/\s+/)
      .map(part => this.capitalize(part))
      .join('');
  }

  private capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private toCamelCase(str: string): string {
    const parts = str.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].toLowerCase();
    return parts[0].toLowerCase() + parts.slice(1).map(p => this.capitalize(p)).join('');
  }

  private normalizeDataType(raw: string): UmlDataType {
    const low = raw.toLowerCase();
    if (low.includes('int') || low.includes('entero')) return 'Integer';
    if (low.includes('long')) return 'Long';
    if (low.includes('double') || low.includes('decimal') || low.includes('precio') || low.includes('monto')) return 'Double';
    if (low.includes('float')) return 'Float';
    if (low.includes('bool')) return 'Boolean';
    if (low.includes('fecha') || low.includes('date')) return 'LocalDate';
    if (low.includes('hora') || low.includes('time')) return 'LocalDateTime';
    if (low.includes('texto') || low.includes('text')) return 'Text';
    return 'String';
  }
}
