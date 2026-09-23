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

/// Motor Inteligente y Ultra-Flexible de Comandos de Voz UML en Tiempo Real
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
        .replaceAll(RegExp(r'[ñ]'), 'n')
        .trim();
  }

  static bool _equalsNormalized(String a, String b) {
    return stripAccents(a) == stripAccents(b);
  }

  /// Ejecuta un comando atómico sobre el diagrama activo
  static VoiceCommandResult executeCommand(String speechText, UmlDiagram diagram) {
    final clean = speechText.trim();
    final cleanLower = clean.toLowerCase();

    // 0. LIMPIAR LIENZO
    if (cleanLower.contains('limpiar lienzo') || cleanLower.contains('borrar todo') || cleanLower.contains('reiniciar diagrama') || cleanLower.contains('limpiar todo')) {
      diagram.classes.clear();
      diagram.relations.clear();
      diagram.updatedAt = DateTime.now();
      return VoiceCommandResult(
        success: true,
        speechResponse: 'Lienzo limpiado por completo.',
        commandDescription: 'Limpiar lienzo',
      );
    }

    // 1. RENOMBRAR CLASE
    // Ej: "renombrar clase Factura a Comprobante", "cambiar nombre de clase Cliente a Usuario"
    final renameMatch = RegExp(r'\b(?:renombrar|cambiar\s+nombre\s+de)\s+(?:la\s+)?(?:clase|tabla|entidad)?\s*([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]+)\s+(?:a|por)\s+([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]+)\b', caseSensitive: false).firstMatch(clean);
    if (renameMatch != null) {
      final oldName = renameMatch.group(1)!;
      final newName = _capitalize(renameMatch.group(2)!);

      final targetClass = diagram.classes.firstWhere(
        (c) => _equalsNormalized(c.name, oldName),
        orElse: () => UmlClass(id: '', name: ''),
      );

      if (targetClass.id.isNotEmpty) {
        final previous = targetClass.name;
        targetClass.name = newName;
        diagram.updatedAt = DateTime.now();
        return VoiceCommandResult(
          success: true,
          speechResponse: 'Clase $previous renombrada a $newName.',
          commandDescription: 'Renombrar clase $previous a $newName',
        );
      }
    }

    // 2. CREAR CLASE O TABLA
    // Ej: "crear clase Factura", "crear una clase Doctor", "nueva clase Animal", "crear tabla Paciente", "agregar clase Cita"
    final createMatch = RegExp(r'\b(?:crear|agrega|agregar|nueva|nuevo|insertar)\s+(?:una\s+|un\s+)?(?:clase|tabla|entidad)\s+([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\b', caseSensitive: false).firstMatch(clean);
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

      // Ubicar ordenadamente en el lienzo
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
        speechResponse: 'Clase $className creada en el lienzo.',
        commandDescription: 'Crear clase $className',
      );
    }

    // 3. ELIMINAR CONEXIÓN O RELACIÓN
    // Ej: "eliminar conexión Cliente con Factura", "desconectar Hotel con Habitacion", "borrar relacion de Cliente a Factura"
    final delConnMatch = RegExp(r'\b(?:eliminar|borrar|quitar|desconectar)\s+(?:conexi[oó]n|relaci[oó]n|v[ií]nculo)?\s*(?:de|entre)?\s*([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\s+(?:con|y|a)\s+([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\b', caseSensitive: false).firstMatch(clean);
    if (delConnMatch != null && (cleanLower.contains('conexi') || cleanLower.contains('relaci') || cleanLower.contains('desconectar'))) {
      final srcName = delConnMatch.group(1)!;
      final tgtName = delConnMatch.group(2)!;

      final src = diagram.classes.firstWhere(
        (c) => _equalsNormalized(c.name, srcName),
        orElse: () => UmlClass(id: '', name: ''),
      );
      final tgt = diagram.classes.firstWhere(
        (c) => _equalsNormalized(c.name, tgtName),
        orElse: () => UmlClass(id: '', name: ''),
      );

      if (src.id.isNotEmpty && tgt.id.isNotEmpty) {
        final removedCount = diagram.relations.where((r) =>
          (r.sourceClassId == src.id && r.targetClassId == tgt.id) ||
          (r.sourceClassId == tgt.id && r.targetClassId == src.id)
        ).length;

        diagram.relations.removeWhere((r) =>
          (r.sourceClassId == src.id && r.targetClassId == tgt.id) ||
          (r.sourceClassId == tgt.id && r.targetClassId == src.id)
        );
        diagram.updatedAt = DateTime.now();

        if (removedCount > 0) {
          return VoiceCommandResult(
            success: true,
            speechResponse: 'Conexión entre ${src.name} y ${tgt.name} eliminada.',
            commandDescription: 'Eliminar conexión entre ${src.name} y ${tgt.name}',
          );
        }
      }
    }

    // 4. CONECTAR O RELACIONAR CLASES
    // Ej: "conectar Cliente con Factura", "relacionar Hotel con Habitacion", "vincular Doctor con Animal"
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
          speechResponse: 'No encontré las clases $srcName o $tgtName para conectarlas.',
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
        speechResponse: 'Relación establecida entre ${src.name} y ${tgt.name}.',
        commandDescription: 'Conectar ${src.name} con ${tgt.name}',
      );
    }

    // 5. AGREGAR MÉTODO A CLASE
    // Ej: "agregar método calcularTotal tipo Double a Factura", "crear metodo registrar en Usuario"
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
        speechResponse: 'Método $methodName agregado a ${targetClass.name}.',
        commandDescription: 'Agregar método $methodName a ${targetClass.name}',
      );
    }

    // 6. ELIMINAR MÉTODO DE CLASE
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
          speechResponse: 'Método $methodName eliminado de ${targetClass.name}.',
          commandDescription: 'Eliminar método $methodName',
        );
      }
    }

    // 7. AGREGAR ATRIBUTO A CLASE
    // Ej: "agregar atributo telefono tipo String a Cliente", "agregar fecha en Cita", "nuevo atributo precio tipo Double a Factura"
    final attrMatch = RegExp(r'\b(?:agregar|añadir|nuevo|crear)\s+(?:atributo\s+|campo\s+)?([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]+)(?:\s+tipo\s+([a-zA-Z0-9_\[\]]+))?\s+(?:a|en|para)\s+(?:la\s+clase\s+|la\s+tabla\s+|la\s+entidad\s+)?([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\b', caseSensitive: false).firstMatch(clean);
    if (attrMatch != null) {
      final rawAttrName = attrMatch.group(1)!;
      final attrName = stripAccents(rawAttrName);
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
        speechResponse: 'Atributo $attrName de tipo $attrType agregado a ${targetClass.name}.',
        commandDescription: 'Agregar $attrName a ${targetClass.name}',
      );
    }

    // 8. ELIMINAR ATRIBUTO
    // Ej: "eliminar atributo telefono de Cliente", "borrar campo email de Usuario"
    final delAttrMatch = RegExp(r'\b(?:eliminar|borrar|quitar)\s+(?:atributo\s+|campo\s+)?([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]+)\s+(?:de|en)\s+(?:la\s+clase\s+|la\s+tabla\s+)?([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\b', caseSensitive: false).firstMatch(clean);
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
          speechResponse: 'Atributo $attrName eliminado de ${targetClass.name}.',
          commandDescription: 'Eliminar atributo $attrName',
        );
      }
    }

    // 9. ELIMINAR CLASE
    // Ej: "eliminar clase Factura", "borrar tabla Doctor", "quitar clase Animal"
    final delClassMatch = RegExp(r'\b(?:eliminar|borrar|quitar)\s+(?:la\s+)?(?:clase|tabla|entidad)\s+([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+)\b', caseSensitive: false).firstMatch(clean);
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
          speechResponse: 'Clase ${target.name} eliminada del lienzo.',
          commandDescription: 'Eliminar clase ${target.name}',
        );
      }
    }

    // Comando no reconocido
    return VoiceCommandResult(
      success: false,
      speechResponse: 'No reconocí el comando "$speechText". Puedes decir: "Crear clase Factura", "Agregar atributo precio a Factura", "Conectar Cliente con Factura" o "Eliminar clase".',
      commandDescription: 'Comando no reconocido',
    );
  }

  static String _capitalize(String s) {
    if (s.isEmpty) return '';
    return s[0].toUpperCase() + s.substring(1);
  }

  static String _normalizeType(String t) {
    final lower = stripAccents(t);
    if (lower == 'entero' || lower == 'int' || lower == 'integer') return 'Integer';
    if (lower == 'long' || lower == 'id' || lower == 'bigint') return 'Long';
    if (lower == 'double' || lower == 'decimal' || lower == 'precio' || lower == 'monto' || lower == 'float') return 'Double';
    if (lower == 'boolean' || lower == 'bool' || lower == 'booleano') return 'Boolean';
    if (lower == 'fecha' || lower == 'date' || lower == 'localdate') return 'LocalDate';
    if (lower == 'fechahora' || lower == 'datetime' || lower == 'localdatetime') return 'LocalDateTime';
    if (lower == 'texto' || lower == 'string' || lower == 'cadena' || lower == 'varchar') return 'String';
    if (lower == 'void' || lower == 'vacio') return 'void';
    return _capitalize(t);
  }
}
