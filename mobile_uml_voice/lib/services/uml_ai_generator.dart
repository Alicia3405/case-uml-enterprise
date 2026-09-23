import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/uml_models.dart';

class UmlGeneratedResult {
  final String diagramName;
  final String description;
  final List<UmlClass> classes;
  final List<UmlRelation> relations;
  final String speechResponse;

  UmlGeneratedResult({
    required this.diagramName,
    required this.description,
    required this.classes,
    required this.relations,
    required this.speechResponse,
  });
}

/// Motor Inteligente y Ultra-Flexible de Generación de Arquitecturas UML
class UmlAiGenerator {
  static final _uuid = const Uuid();

  static UmlGeneratedResult generateFromPrompt(String prompt) {
    final cleanPrompt = prompt.trim();
    final lower = cleanPrompt.toLowerCase();

    // 1. INTENTAR PARSEO DETALLADO DE CLASES Y ATRIBUTOS EXPLÍCITOS
    // Ej: "crear sistema para veterinaria con clase doctor con atributos id, nombre, fecha, clase animal con id, nombre, nombre dueño"
    final explicitClasses = _parseExplicitClassesAndAttributes(cleanPrompt);
    if (explicitClasses.isNotEmpty) {
      return _buildResultFromExplicitClasses(cleanPrompt, explicitClasses);
    }

    // 2. Detección de dominio y entidades
    final domainData = _extractDomainAndEntities(cleanPrompt);
    final entityNames = domainData['entityNames'] as List<String>;
    final domainName = domainData['domainName'] as String;

    if (entityNames.length >= 2) {
      return _generateCustomDomain(cleanPrompt, domainName, entityNames);
    }

    // 3. Dominios predeterminados oficiales
    if (lower.contains('veterinari') || lower.contains('mascota') || lower.contains('animal') || lower.contains('perro')) {
      return _buildVeterinariaDomain();
    } else if (lower.contains('hotel') || lower.contains('habitacion') || lower.contains('huesped')) {
      return _buildHoteleriaDomain();
    } else if (lower.contains('venta') || lower.contains('factura') || lower.contains('pedido') || lower.contains('comercio')) {
      return _buildVentasDomain();
    } else if (lower.contains('hospital') || lower.contains('medico') || lower.contains('paciente') || lower.contains('salud') || lower.contains('clinica')) {
      return _buildHospitalDomain();
    } else if (lower.contains('biblioteca') || lower.contains('libro') || lower.contains('prestamo')) {
      return _buildBibliotecaDomain();
    } else if (lower.contains('restaurante') || lower.contains('comida') || lower.contains('plato')) {
      return _buildRestauranteDomain();
    } else if (lower.contains('universidad') || lower.contains('colegio') || lower.contains('escuela') || lower.contains('curso') || lower.contains('alumno')) {
      return _buildEducacionDomain();
    }

    // 4. Parser heurístico general
    return _generateCustomDomain(cleanPrompt, domainName, entityNames);
  }

  /// Parsea clases y atributos definidos explícitamente en el texto
  static List<UmlClass> _parseExplicitClassesAndAttributes(String text) {
    final List<UmlClass> classes = [];
    final lower = text.toLowerCase();

    // Buscar patrones "clase X con atributos Y, Z..." o "clase X con Y, Z..."
    final classSplitRegex = RegExp(r'\bclase\s+([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]+)', caseSensitive: false);
    final matches = classSplitRegex.allMatches(text).toList();

    if (matches.isEmpty) return [];

    for (int i = 0; i < matches.length; i++) {
      final m = matches[i];
      final className = _capitalize(m.group(1)!);
      final start = m.end;
      final end = (i + 1 < matches.length) ? matches[i + 1].start : text.length;
      final classBody = text.substring(start, end).trim();

      final List<UmlAttribute> attributes = [];
      final List<UmlMethod> methods = [];

      // Buscar si menciona atributos
      final attrMarkerRegex = RegExp(r'\b(?:con\s+atributos|atributos|con\s+los\s+atributos|con\s+campos|con)\s+(.+)', caseSensitive: false);
      final attrMatch = attrMarkerRegex.firstMatch(classBody);

      if (attrMatch != null) {
        final attrChunk = attrMatch.group(1)!;
        // Separar por comas, 'y', 'e', o espacios
        final rawTokens = attrChunk
            .replaceAll(RegExp(r'\b(?:metodos|métodos|funciones|con\s+metodos|con\s+funciones)\b.*', caseSensitive: false), '')
            .replaceAll(RegExp(r'[,;]'), ' ')
            .split(RegExp(r'\s+(?:y|e)\s+|\s+'))
            .map((s) => s.trim())
            .where((s) => s.isNotEmpty && !_isStopWord(s) && s.length >= 2)
            .toList();

        // Si no tiene id, agregarlo al inicio
        bool hasPk = false;
        for (final tok in rawTokens) {
          final cleanTok = _cleanIdentifier(tok);
          if (cleanTok.isEmpty) continue;

          final isId = cleanTok.toLowerCase() == 'id' || cleanTok.toLowerCase().endsWith('id') || cleanTok.toLowerCase() == 'codigo';
          final attrType = _inferTypeFromName(cleanTok);
          if (isId && !hasPk) {
            hasPk = true;
            attributes.add(UmlAttribute(
              id: 'a_${_uuid.v4().substring(0, 6)}',
              name: cleanTok,
              type: 'Long',
              isPrimaryKey: true,
            ));
          } else {
            attributes.add(UmlAttribute(
              id: 'a_${_uuid.v4().substring(0, 6)}',
              name: cleanTok,
              type: attrType,
            ));
          }
        }
      }

      // Si no se encontraron atributos, generar atributos base
      if (attributes.isEmpty) {
        attributes.addAll(_generateAttributesFor(className));
      } else if (!attributes.any((a) => a.isPrimaryKey)) {
        attributes.insert(0, UmlAttribute(
          id: 'a_${_uuid.v4().substring(0, 6)}',
          name: 'id',
          type: 'Long',
          isPrimaryKey: true,
        ));
      }

      methods.addAll(_generateMethodsFor(className));

      final col = classes.length % 2;
      final row = classes.length ~/ 2;
      classes.add(UmlClass(
        id: 'cls_${_uuid.v4().substring(0, 8)}',
        name: className,
        position: Offset(40.0 + col * 260.0, 40.0 + row * 240.0),
        attributes: attributes,
        methods: methods,
      ));
    }

    return classes;
  }

  static UmlGeneratedResult _buildResultFromExplicitClasses(String prompt, List<UmlClass> classes) {
    final relations = <UmlRelation>[];

    // Conectar las clases secuencialmente o según semántica
    for (int i = 0; i < classes.length - 1; i++) {
      final src = classes[i];
      final tgt = classes[i + 1];
      relations.add(UmlRelation(
        id: 'rel_${_uuid.v4().substring(0, 8)}',
        sourceClassId: src.id,
        targetClassId: tgt.id,
        type: UmlRelationType.association,
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'asocia',
      ));
    }

    if (classes.length >= 3) {
      // Conectar la primera con la última para formar un grafo cohesivo
      relations.add(UmlRelation(
        id: 'rel_${_uuid.v4().substring(0, 8)}',
        sourceClassId: classes.first.id,
        targetClassId: classes.last.id,
        type: UmlRelationType.composition,
        sourceMultiplicity: '1..1',
        targetMultiplicity: '1..*',
        name: 'gestiona',
      ));
    }

    final classNames = classes.map((c) => c.name).join(', ');
    final speech = 'Sistema diseñado con éxito con las clases: $classNames. Se crearon ${classes.length} clases y ${relations.length} relaciones en el lienzo.';

    return UmlGeneratedResult(
      diagramName: 'Sistema Personalizado (${classes.first.name})',
      description: 'Generado con clases específicas: $classNames',
      classes: classes,
      relations: relations,
      speechResponse: speech,
    );
  }

  static UmlGeneratedResult _generateCustomDomain(
    String prompt,
    String domainName,
    List<String> entityNames,
  ) {
    final entities = List<String>.from(entityNames);
    if (entities.isEmpty) {
      entities.addAll(['EntidadPrincipal', 'DetalleRegistro', 'Catalogo']);
    } else if (entities.length == 1) {
      entities.addAll(['DetalleRegistro', 'Catalogo']);
    }

    final classes = <UmlClass>[];
    final relations = <UmlRelation>[];

    for (int i = 0; i < entities.length; i++) {
      final name = entities[i];
      final col = i % 2;
      final row = i ~/ 2;
      final posX = 40.0 + col * 260.0;
      final posY = 40.0 + row * 240.0;

      classes.add(UmlClass(
        id: 'cls_${_uuid.v4().substring(0, 8)}',
        name: name,
        position: Offset(posX, posY),
        attributes: _generateAttributesFor(name),
        methods: _generateMethodsFor(name),
      ));
    }

    // Conectar semánticamente
    final classMap = {for (var c in classes) c.name.toLowerCase(): c};

    void connect(String srcName, String tgtName, UmlRelationType type, String mult1, String mult2, String label) {
      final src = classMap[srcName.toLowerCase()];
      final tgt = classMap[tgtName.toLowerCase()];
      if (src != null && tgt != null && src.id != tgt.id) {
        final alreadyExists = relations.any((r) =>
            (r.sourceClassId == src.id && r.targetClassId == tgt.id) ||
            (r.sourceClassId == tgt.id && r.targetClassId == src.id));
        if (!alreadyExists) {
          relations.add(UmlRelation(
            id: 'rel_${_uuid.v4().substring(0, 8)}',
            sourceClassId: src.id,
            targetClassId: tgt.id,
            type: type,
            sourceMultiplicity: mult1,
            targetMultiplicity: mult2,
            name: label,
          ));
        }
      }
    }

    final primaryClass = classes.first;
    for (int i = 1; i < classes.length; i++) {
      final other = classes[i];
      connect(primaryClass.name, other.name, UmlRelationType.association, '1..1', '0..*', 'asocia');
    }

    final speech = 'Sistema para $domainName sintetizado con éxito con ${classes.length} clases y ${relations.length} relaciones completas.';

    return UmlGeneratedResult(
      diagramName: domainName,
      description: 'Generado por IA a partir de: "$prompt"',
      classes: classes,
      relations: relations,
      speechResponse: speech,
    );
  }

  // --- PLANTILLAS DE DOMINIO RICAS ---
  static UmlGeneratedResult _buildVeterinariaDomain() {
    final cCliente = UmlClass(
      id: 'cls_vet_1',
      name: 'Cliente',
      position: const Offset(40, 40),
      attributes: [
        UmlAttribute(id: 'a1', name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: 'a2', name: 'nombreCompleto', type: 'String'),
        UmlAttribute(id: 'a3', name: 'ciNit', type: 'String'),
        UmlAttribute(id: 'a4', name: 'telefono', type: 'String'),
      ],
      methods: [UmlMethod(id: 'm1', name: 'registrar')],
    );

    final cMascota = UmlClass(
      id: 'cls_vet_2',
      name: 'Mascota',
      position: const Offset(300, 40),
      attributes: [
        UmlAttribute(id: 'a5', name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: 'a6', name: 'nombre', type: 'String'),
        UmlAttribute(id: 'a7', name: 'especie', type: 'String'),
        UmlAttribute(id: 'a8', name: 'edadAnios', type: 'Integer'),
      ],
      methods: [UmlMethod(id: 'm2', name: 'calcularDosis')],
    );

    final cVet = UmlClass(
      id: 'cls_vet_3',
      name: 'Veterinario',
      position: const Offset(40, 280),
      attributes: [
        UmlAttribute(id: 'a9', name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: 'a10', name: 'nombre', type: 'String'),
        UmlAttribute(id: 'a11', name: 'matriculaProf', type: 'String'),
      ],
    );

    final cCita = UmlClass(
      id: 'cls_vet_4',
      name: 'CitaMedica',
      position: const Offset(300, 280),
      attributes: [
        UmlAttribute(id: 'a12', name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: 'a13', name: 'fecha', type: 'LocalDate'),
        UmlAttribute(id: 'a14', name: 'motivo', type: 'String'),
        UmlAttribute(id: 'a15', name: 'costo', type: 'Double'),
      ],
    );

    final relations = [
      UmlRelation(id: 'r1', sourceClassId: cCliente.id, targetClassId: cMascota.id, type: UmlRelationType.composition, name: 'posee', sourceMultiplicity: '1..1', targetMultiplicity: '1..*'),
      UmlRelation(id: 'r2', sourceClassId: cMascota.id, targetClassId: cCita.id, type: UmlRelationType.association, name: 'registra', sourceMultiplicity: '1..1', targetMultiplicity: '0..*'),
      UmlRelation(id: 'r3', sourceClassId: cVet.id, targetClassId: cCita.id, type: UmlRelationType.association, name: 'atiende', sourceMultiplicity: '1..1', targetMultiplicity: '0..*'),
    ];

    return UmlGeneratedResult(
      diagramName: 'Sistema de Clínica Veterinaria',
      description: 'Modelo conceptual con Cliente, Mascota, Veterinario y CitaMedica.',
      classes: [cCliente, cMascota, cVet, cCita],
      relations: relations,
      speechResponse: 'Sistema de Clínica Veterinaria sintetizado con éxito con 4 clases y 3 relaciones.',
    );
  }

  static UmlGeneratedResult _buildHoteleriaDomain() {
    return _generateCustomDomain('Sistema de Hoteleria', 'Sistema de Hotelería', ['Hotel', 'Habitacion', 'Huesped', 'Reserva', 'Empleado']);
  }

  static UmlGeneratedResult _buildVentasDomain() {
    return _generateCustomDomain('Sistema de Facturación', 'Sistema de Facturación y Ventas', ['Cliente', 'Factura', 'DetalleFactura', 'Producto']);
  }

  static UmlGeneratedResult _buildHospitalDomain() {
    return _generateCustomDomain('Sistema Hospitalario', 'Sistema Hospitalario y Consultas', ['Paciente', 'Medico', 'ConsultaMedica', 'RecetaDigital']);
  }

  static UmlGeneratedResult _buildBibliotecaDomain() {
    return _generateCustomDomain('Sistema de Biblioteca', 'Sistema de Biblioteca y Préstamos', ['Libro', 'Autor', 'Lector', 'Prestamo']);
  }

  static UmlGeneratedResult _buildRestauranteDomain() {
    return _generateCustomDomain('Sistema de Restaurante', 'Sistema de Restaurante y Pedidos', ['Mesa', 'Mesero', 'Pedido', 'Plato']);
  }

  static UmlGeneratedResult _buildEducacionDomain() {
    return _generateCustomDomain('Sistema Educativo', 'Sistema Académico de Cursos', ['Estudiante', 'Profesor', 'Curso', 'Matricula']);
  }

  static List<UmlAttribute> _generateAttributesFor(String name) {
    final lower = name.toLowerCase();
    final aId = () => 'a_${_uuid.v4().substring(0, 6)}';

    if (lower.contains('hotel')) {
      return [
        UmlAttribute(id: aId(), name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: aId(), name: 'nombre', type: 'String'),
        UmlAttribute(id: aId(), name: 'direccion', type: 'String'),
        UmlAttribute(id: aId(), name: 'estrellas', type: 'Integer'),
      ];
    }
    if (lower.contains('habitacion')) {
      return [
        UmlAttribute(id: aId(), name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: aId(), name: 'numero', type: 'String'),
        UmlAttribute(id: aId(), name: 'precioPorNoche', type: 'Double'),
        UmlAttribute(id: aId(), name: 'estado', type: 'String'),
      ];
    }
    if (lower.contains('doctor') || lower.contains('veterinario') || lower.contains('medico') || lower.contains('profesor')) {
      return [
        UmlAttribute(id: aId(), name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: aId(), name: 'nombre', type: 'String'),
        UmlAttribute(id: aId(), name: 'matriculaProf', type: 'String'),
        UmlAttribute(id: aId(), name: 'especialidad', type: 'String'),
      ];
    }
    if (lower.contains('animal') || lower.contains('mascota') || lower.contains('perro') || lower.contains('gato')) {
      return [
        UmlAttribute(id: aId(), name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: aId(), name: 'nombre', type: 'String'),
        UmlAttribute(id: aId(), name: 'especie', type: 'String'),
        UmlAttribute(id: aId(), name: 'nombreDueno', type: 'String'),
      ];
    }
    if (lower.contains('cliente') || lower.contains('usuario') || lower.contains('paciente') || lower.contains('huesped') || lower.contains('estudiante')) {
      return [
        UmlAttribute(id: aId(), name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: aId(), name: 'nombreCompleto', type: 'String'),
        UmlAttribute(id: aId(), name: 'ciNit', type: 'String'),
        UmlAttribute(id: aId(), name: 'telefono', type: 'String'),
      ];
    }

    return [
      UmlAttribute(id: aId(), name: 'id', type: 'Long', isPrimaryKey: true),
      UmlAttribute(id: aId(), name: 'nombre', type: 'String'),
      UmlAttribute(id: aId(), name: 'codigo', type: 'String'),
      UmlAttribute(id: aId(), name: 'fechaRegistro', type: 'LocalDate'),
    ];
  }

  static List<UmlMethod> _generateMethodsFor(String name) {
    final mId = () => 'm_${_uuid.v4().substring(0, 6)}';
    return [
      UmlMethod(id: mId(), name: 'procesar'),
      UmlMethod(id: mId(), name: 'validar', returnType: 'Boolean'),
    ];
  }

  static String _inferTypeFromName(String name) {
    final lower = name.toLowerCase();
    if (lower == 'id' || lower.endsWith('id') || lower == 'codigo') return 'Long';
    if (lower.contains('fecha') || lower.contains('date')) return 'LocalDate';
    if (lower.contains('precio') || lower.contains('costo') || lower.contains('monto') || lower.contains('total') || lower.contains('salario') || lower.contains('sueldo')) return 'Double';
    if (lower.contains('edad') || lower.contains('numero') || lower.contains('cantidad') || lower.contains('estrellas') || lower.contains('stock') || lower.contains('anio') || lower.contains('ano')) return 'Integer';
    if (lower.contains('activo') || lower.contains('habilitado') || lower.contains('pagado') || lower.contains('valido')) return 'Boolean';
    return 'String';
  }

  static String _cleanIdentifier(String s) {
    return s.replaceAll(RegExp(r'[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]'), '');
  }

  static Map<String, dynamic> _extractDomainAndEntities(String text) {
    final raw = text.trim();
    String domainCandidate = '';
    String entitiesText = raw;

    final splitRegex = RegExp(r'\b(?:con\s+las\s+clases|con\s+las\s+entidades|con\s+clases|con\s+entidades|con|incluye|que\s+tenga)\b', caseSensitive: false);
    final match = splitRegex.firstMatch(raw);

    if (match != null && match.start > 0) {
      final prefix = raw.substring(0, match.start).trim();
      final suffix = raw.substring(match.end).trim();

      final prefixWords = prefix.replaceAll(RegExp(r'[,;.:]'), ' ').split(RegExp(r'\s+')).where((w) => w.length >= 3).toList();
      final valid = prefixWords.where((w) => !_isStopWord(w)).toList();
      if (valid.isNotEmpty) {
        domainCandidate = _capitalize(valid.last);
      }
      entitiesText = suffix;
    }

    final entityNames = <String>[];
    final seen = <String>{};

    final tokens = entitiesText.replaceAll(RegExp(r'[,;.:]'), ' ').split(RegExp(r'\s+')).where((w) => w.length >= 3);
    for (final tok in tokens) {
      final clean = tok.replaceAll(RegExp(r'[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]'), '');
      if (clean.length >= 3 && !_isStopWord(clean)) {
        final sing = _singularize(clean);
        if (!seen.contains(sing.toLowerCase())) {
          seen.add(sing.toLowerCase());
          entityNames.add(sing);
        }
      }
    }

    final domainName = domainCandidate.isNotEmpty ? 'Sistema de $domainCandidate' : (entityNames.isNotEmpty ? 'Sistema de ${entityNames.first}' : 'Sistema Personalizado');
    return {
      'domainName': domainName,
      'entityNames': entityNames,
    };
  }

  static String _singularize(String word) {
    final lower = word.toLowerCase().trim();
    if (lower.length <= 3) return _capitalize(lower);

    if (lower.endsWith('ces')) return _capitalize('${lower.substring(0, lower.length - 3)}z');
    if (lower.endsWith('ores')) return _capitalize(lower.substring(0, lower.length - 2));
    if (lower.endsWith('entes') || lower.endsWith('antes') || lower.endsWith('ientes')) {
      return _capitalize(lower.substring(0, lower.length - 1));
    }
    if (lower.endsWith('des')) return _capitalize(lower.substring(0, lower.length - 2));
    if (lower.endsWith('es')) {
      final beforeEs = lower[lower.length - 3];
      if ('aeiouáéíóú'.contains(beforeEs)) {
        return _capitalize(lower.substring(0, lower.length - 1));
      } else {
        return _capitalize(lower.substring(0, lower.length - 2));
      }
    }
    if (lower.endsWith('s')) {
      final beforeS = lower[lower.length - 2];
      if ('aeiouáéíóú'.contains(beforeS)) {
        return _capitalize(lower.substring(0, lower.length - 1));
      }
    }
    return _capitalize(lower);
  }

  static String _capitalize(String s) {
    if (s.isEmpty) return '';
    return s[0].toUpperCase() + s.substring(1);
  }

  static bool _isStopWord(String w) {
    const stops = {
      'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'se', 'del', 'las', 'por', 'un', 'para', 'con', 'no',
      'una', 'su', 'al', 'lo', 'como', 'mas', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'si', 'porque',
      'sistema', 'software', 'diagrama', 'clases', 'clase', 'uml', 'proyecto', 'crear', 'generar', 'disenar',
      'atributos', 'atributo', 'campo', 'campos', 'tipo',
    };
    return stops.contains(w.toLowerCase());
  }
}
