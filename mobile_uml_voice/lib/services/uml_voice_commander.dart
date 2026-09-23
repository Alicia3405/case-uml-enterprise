import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/uml_models.dart';

class VoiceCommandResult {
  final bool success;
  final String speechResponse;
  final String commandDescription;

  VoiceCommandResult({
    required this.success,
    required this.speechResponse,
    required this.commandDescription,
  });
}

/// Motor de Procesamiento de Comandos Atómicos por Voz en Tiempo Real (Canal 2)
class UmlVoiceCommander {
  static final _uuid = const Uuid();

  /// Normaliza una cadena quitando tildes y caracteres especiales para comparación fonética
  static String stripAccents(String s) {
    return s
        .toLowerCase()
        .replaceAll(RegExp(r'[áàäâ]'), 'a')
        .replaceAll(RegExp(r'[éèëê]'), 'e')
        .replaceAll(RegExp(r'[íìïî]'), 'i')
        .replaceAll(RegExp(r'[óòöô]'), 'o')
        .replaceAll(RegExp(r'[úùüû]'), 'u')
        .trim();
  }

  static bool _equalsNormalized(String a, String b) {
    return stripAccents(a) == stripAccents(b);
  }

  /// Ejecuta un comando atómico sobre el diagrama activo
  static VoiceCommandResult executeCommand(String speechText, UmlDiagram diagram) {
    final clean = speechText.trim();
    final cleanLower = clean.toLowerCase();

    // 1. CREAR CLASE O TABLA
    // Ej: "crear clase Factura", "crear tabla Paciente", "nueva entidad Reserva"
    final createMatch = RegExp(r'\b(?:crear|agrega|agregar|nueva|nuevo)\s+(?:clase|tabla|entidad)\s+([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\b', caseSensitive: false).firstMatch(clean);
    if (createMatch != null) {
      final className = _capitalize(createMatch.group(1)!);
      final exists = diagram.classes.any((c) => _equalsNormalized(c.name, className));
      if (exists) {
        return VoiceCommandResult(
          success: false,
          speechResponse: 'La clase $className ya existe en el lienzo.',
          commandDescription: 'Clase $className ya existente',
        );
      }

      // Ubicar en el lienzo
      final offset = Offset(80.0 + (diagram.classes.length % 4) * 260.0, 80.0 + (diagram.classes.length ~/ 4) * 230.0);
      final newClass = UmlClass(
        id: 'cls_${_uuid.v4().substring(0, 8)}',
        name: className,
        position: offset,
        attributes: [
          UmlAttribute(id: 'a_${_uuid.v4().substring(0, 6)}', name: 'id', type: 'Long', isPrimaryKey: true),
          UmlAttribute(id: 'a_${_uuid.v4().substring(0, 6)}', name: 'nombre', type: 'String'),
        ],
        methods: [
          UmlMethod(id: 'm_${_uuid.v4().substring(0, 6)}', name: 'procesar', returnType: 'void'),
        ],
      );

      diagram.classes.add(newClass);
      diagram.updatedAt = DateTime.now();

      return VoiceCommandResult(
        success: true,
        speechResponse: 'Clase $className creada en el lienzo con identificador primario y campo nombre.',
        commandDescription: 'Crear clase $className',
      );
    }

    // 2. AGREGAR MÉTODO A CLASE
    // Ej: "agregar método calcularTotal tipo Double a Factura", "crear metodo registrar en Usuario", "nueva funcion pagar en Cliente"
    final addMethodMatch = RegExp(r'\b(?:agregar|añadir|crear|nuevo)\s+(?:m[eé]todo|funci[oó]n|operaci[oó]n)\s+([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]+)(?:\s+(?:tipo|retorno)\s+([a-zA-Z0-9_\[\]]+))?\s+(?:a|en|para)\s+(?:la\s+clase\s+|la\s+tabla\s+|la\s+entidad\s+)?([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\b', caseSensitive: false).firstMatch(clean);
    if (addMethodMatch != null) {
      final methodName = addMethodMatch.group(1)!;
      final returnType = _normalizeType(addMethodMatch.group(2) ?? 'void');
      final targetClassName = addMethodMatch.group(3)!;

      final targetClass = diagram.classes.firstWhere(
        (c) => _equalsNormalized(c.name, targetClassName),
        orElse: () => UmlClass(id: '', name: ''),
      );

      if (targetClass.id.isEmpty) {
        return VoiceCommandResult(
          success: false,
          speechResponse: 'No encontré la clase $targetClassName para agregar el método.',
          commandDescription: 'Clase no encontrada',
        );
      }

      targetClass.methods.add(UmlMethod(
        id: 'm_${_uuid.v4().substring(0, 6)}',
        name: methodName,
        returnType: returnType,
      ));
      diagram.updatedAt = DateTime.now();

      return VoiceCommandResult(
        success: true,
        speechResponse: 'Método $methodName con retorno $returnType agregado a la clase ${targetClass.name}.',
        commandDescription: 'Agregar método $methodName a ${targetClass.name}',
      );
    }

    // 3. ELIMINAR MÉTODO DE CLASE
    // Ej: "eliminar método procesar de Factura", "borrar funcion calcular de Usuario"
    final delMethodMatch = RegExp(r'\b(?:eliminar|borrar|quitar)\s+(?:m[eé]todo|funci[oó]n|operaci[oó]n)\s+([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]+)\s+(?:de|en)\s+(?:la\s+clase\s+|la\s+tabla\s+)?([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\b', caseSensitive: false).firstMatch(clean);
    if (delMethodMatch != null) {
      final methodName = delMethodMatch.group(1)!;
      final targetClassName = delMethodMatch.group(2)!;

      final targetClass = diagram.classes.firstWhere(
        (c) => _equalsNormalized(c.name, targetClassName),
        orElse: () => UmlClass(id: '', name: ''),
      );

      if (targetClass.id.isNotEmpty) {
        targetClass.methods.removeWhere((m) => _equalsNormalized(m.name, methodName));
        diagram.updatedAt = DateTime.now();
        return VoiceCommandResult(
          success: true,
          speechResponse: 'Método $methodName eliminado de la clase ${targetClass.name}.',
          commandDescription: 'Eliminar método $methodName',
        );
      }
    }

    // 4. AGREGAR ATRIBUTO A CLASE
    // Ej: "agregar atributo teléfono tipo String en la tabla papel"
    // Ej: "agregar telefono a Habitacion"
    final attrMatch = RegExp(r'\b(?:agregar|añadir|nuevo)\s+(?:atributo\s+)?([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]+)(?:\s+tipo\s+([a-zA-Z0-9_\[\]]+))?\s+(?:a|en|para)\s+(?:la\s+clase\s+|la\s+tabla\s+|la\s+entidad\s+)?([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\b', caseSensitive: false).firstMatch(clean);
    if (attrMatch != null) {
      final rawAttrName = attrMatch.group(1)!;
      final attrName = stripAccents(rawAttrName); // En Java/DB sin tildes para evitar errores
      final attrType = _normalizeType(attrMatch.group(2) ?? 'String');
      final targetClassName = attrMatch.group(3)!;

      final targetClass = diagram.classes.firstWhere(
        (c) => _equalsNormalized(c.name, targetClassName),
        orElse: () => UmlClass(id: '', name: ''),
      );

      if (targetClass.id.isEmpty) {
        return VoiceCommandResult(
          success: false,
          speechResponse: 'No encontré la clase $targetClassName para agregar el atributo.',
          commandDescription: 'Clase no encontrada',
        );
      }

      targetClass.attributes.add(UmlAttribute(
        id: 'a_${_uuid.v4().substring(0, 6)}',
        name: attrName,
        type: attrType,
      ));
      diagram.updatedAt = DateTime.now();

      return VoiceCommandResult(
        success: true,
        speechResponse: 'Atributo $attrName de tipo $attrType agregado con éxito a la clase ${targetClass.name}.',
        commandDescription: 'Agregar $attrName a ${targetClass.name}',
      );
    }

    // 5. CONECTAR O RELACIONAR CLASES
    // Ej: "conectar Cliente con Factura", "relacionar Hotel con Habitacion"
    final connectMatch = RegExp(r'\b(?:conectar|relacionar|vincular|asociar)\s+([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\s+con\s+([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\b', caseSensitive: false).firstMatch(clean);
    if (connectMatch != null) {
      final srcName = connectMatch.group(1)!;
      final tgtName = connectMatch.group(2)!;

      final src = diagram.classes.firstWhere(
        (c) => _equalsNormalized(c.name, srcName),
        orElse: () => UmlClass(id: '', name: ''),
      );
      final tgt = diagram.classes.firstWhere(
        (c) => _equalsNormalized(c.name, tgtName),
        orElse: () => UmlClass(id: '', name: ''),
      );

      if (src.id.isEmpty || tgt.id.isEmpty) {
        return VoiceCommandResult(
          success: false,
          speechResponse: 'No se pudieron encontrar las clases $srcName o $tgtName para conectarlas.',
          commandDescription: 'Clases no encontradas',
        );
      }

      diagram.relations.add(UmlRelation(
        id: 'rel_${_uuid.v4().substring(0, 8)}',
        sourceClassId: src.id,
        targetClassId: tgt.id,
        type: UmlRelationType.association,
        name: 'asocia',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
      ));
      diagram.updatedAt = DateTime.now();

      return VoiceCommandResult(
        success: true,
        speechResponse: 'Relación establecida entre ${src.name} y ${tgt.name} de uno a muchos.',
        commandDescription: 'Conectar ${src.name} con ${tgt.name}',
      );
    }

    // 6. ELIMINAR ATRIBUTO
    // Ej: "eliminar atributo teléfono de Cliente"
    final delAttrMatch = RegExp(r'\b(?:eliminar|borrar|quitar)\s+(?:atributo\s+)?([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]+)\s+(?:de|en)\s+(?:la\s+clase\s+|la\s+tabla\s+)?([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\b', caseSensitive: false).firstMatch(clean);
    if (delAttrMatch != null) {
      final attrName = delAttrMatch.group(1)!;
      final targetClassName = delAttrMatch.group(2)!;

      final targetClass = diagram.classes.firstWhere(
        (c) => _equalsNormalized(c.name, targetClassName),
        orElse: () => UmlClass(id: '', name: ''),
      );

      if (targetClass.id.isNotEmpty) {
        targetClass.attributes.removeWhere((a) => _equalsNormalized(a.name, attrName));
        diagram.updatedAt = DateTime.now();
        return VoiceCommandResult(
          success: true,
          speechResponse: 'Atributo $attrName eliminado de la clase ${targetClass.name}.',
          commandDescription: 'Eliminar atributo $attrName',
        );
      }
    }

    // 7. ELIMINAR CLASE
    // Ej: "eliminar clase DetalleRegistro", "borrar tabla Factura"
    final delClassMatch = RegExp(r'\b(?:eliminar|borrar|quitar)\s+(?:clase|tabla|entidad)\s+([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\b', caseSensitive: false).firstMatch(clean);
    if (delClassMatch != null) {
      final className = delClassMatch.group(1)!;
      final target = diagram.classes.firstWhere(
        (c) => _equalsNormalized(c.name, className),
        orElse: () => UmlClass(id: '', name: ''),
      );

      if (target.id.isNotEmpty) {
        diagram.classes.removeWhere((c) => c.id == target.id);
        diagram.relations.removeWhere((r) => r.sourceClassId == target.id || r.targetClassId == target.id);
        diagram.updatedAt = DateTime.now();

        return VoiceCommandResult(
          success: true,
          speechResponse: 'Clase ${target.name} y sus relaciones asociadas han sido eliminadas del lienzo.',
          commandDescription: 'Eliminar clase ${target.name}',
        );
      }
    }

    // 8. LIMPIAR LIENZO
    if (cleanLower.contains('limpiar lienzo') || cleanLower.contains('borrar todo') || cleanLower.contains('reiniciar diagrama')) {
      diagram.classes.clear();
      diagram.relations.clear();
      diagram.updatedAt = DateTime.now();
      return VoiceCommandResult(
        success: true,
        speechResponse: 'Lienzo limpiado por completo. Puedes dictar nuevas clases o un nuevo sistema.',
        commandDescription: 'Limpiar lienzo',
      );
    }

    // Orden no reconocida
    return VoiceCommandResult(
      success: false,
      speechResponse: 'No reconocí el comando "$speechText". Puedes decir por ejemplo: "Crear clase Cliente", "Agregar atributo teléfono a Cliente", "Agregar método calcular a Factura" o "Conectar Cliente con Factura".',
      commandDescription: 'Comando no reconocido',
    );
  }

  static String _capitalize(String s) {
    if (s.isEmpty) return '';
    return s[0].toUpperCase() + s.substring(1);
  }

  static String _normalizeType(String t) {
    final lower = stripAccents(t);
    if (lower == 'entero' || lower == 'int') return 'Integer';
    if (lower == 'long' || lower == 'id') return 'Long';
    if (lower == 'double' || lower == 'decimal' || lower == 'precio' || lower == 'monto') return 'Double';
    if (lower == 'boolean' || lower == 'bool' || lower == 'booleano') return 'Boolean';
    if (lower == 'fecha' || lower == 'date') return 'LocalDate';
    if (lower == 'texto' || lower == 'string' || lower == 'cadena') return 'String';
    if (lower == 'void' || lower == 'vacio') return 'void';
    return _capitalize(t);
  }
}
