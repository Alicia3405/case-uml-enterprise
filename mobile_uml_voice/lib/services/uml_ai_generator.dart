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

/// Motor Inteligente Offline de Generación de Arquitecturas UML a partir de Prompts
class UmlAiGenerator {
  static final _uuid = const Uuid();

  static UmlGeneratedResult generateFromPrompt(String prompt) {
    final cleanPrompt = prompt.trim();
    final lower = cleanPrompt.toLowerCase();

    // Detección de dominio y entidades explícitas
    final domainData = _extractDomainAndEntities(cleanPrompt);
    final entityNames = domainData['entityNames'] as List<String>;
    final domainName = domainData['domainName'] as String;

    // Si el usuario especificó una lista explícita de al menos 2 entidades
    if (entityNames.length >= 2) {
      return _generateCustomDomain(cleanPrompt, domainName, entityNames);
    }

    // Dominios predeterminados oficiales del examen
    if (lower.contains('veterinari') || lower.contains('mascota') || lower.contains('perro')) {
      return _buildVeterinariaDomain();
    } else if (lower.contains('hotel') || lower.contains('habitacion') || lower.contains('huesped')) {
      return _buildHoteleriaDomain();
    } else if (lower.contains('venta') || lower.contains('factura') || lower.contains('pedido')) {
      return _buildVentasDomain();
    } else if (lower.contains('hospital') || lower.contains('medico') || lower.contains('paciente')) {
      return _buildHospitalDomain();
    }

    // Parser heurístico
    return _generateCustomDomain(cleanPrompt, domainName, entityNames);
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
      final col = i % 2; // 2 columnas en pantalla móvil
      final row = i ~/ 2;
      final posX = 40.0 + col * 260.0;
      final posY = 40.0 + row * 230.0;

      classes.add(UmlClass(
        id: 'cls_${_uuid.v4().substring(0, 8)}',
        name: name,
        position: Offset(posX, posY),
        attributes: _generateAttributesFor(name),
        methods: _generateMethodsFor(name),
      ));
    }

    // Conectar semánticamente con grafo UML completo
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

    // 1. Reglas específicas por dominio
    connect('Hotel', 'Habitacion', UmlRelationType.composition, '1..1', '1..*', 'alberga');
    connect('Hotel', 'Empleado', UmlRelationType.association, '1..1', '1..*', 'contrata');
    connect('Huesped', 'Reserva', UmlRelationType.association, '1..1', '0..*', 'realiza');
    connect('Reserva', 'Habitacion', UmlRelationType.association, '0..*', '1..1', 'asigna');
    connect('Empleado', 'Reserva', UmlRelationType.association, '1..1', '0..*', 'gestiona');

    connect('Cliente', 'Mascota', UmlRelationType.composition, '1..1', '1..*', 'posee');
    connect('Veterinario', 'CitaMedica', UmlRelationType.association, '1..1', '0..*', 'atiende');
    connect('Mascota', 'CitaMedica', UmlRelationType.association, '1..1', '0..*', 'registra');
    connect('CitaMedica', 'Tratamiento', UmlRelationType.composition, '1..1', '1..*', 'prescribe');

    connect('Cliente', 'Factura', UmlRelationType.association, '1..1', '0..*', 'emite');
    connect('Factura', 'DetalleFactura', UmlRelationType.composition, '1..1', '1..*', 'contiene');
    connect('DetalleFactura', 'Producto', UmlRelationType.association, '0..*', '1..1', 'incluye');
    connect('Categoria', 'Producto', UmlRelationType.aggregation, '1..1', '0..*', 'clasifica');

    // 2. Sintetizador de Grafo Semántico Inteligente para Dominios Personalizados
    // Identificar actores, catálogos, materiales, transacciones y entidad principal
    final primaryClass = classes.first;
    for (int i = 1; i < classes.length; i++) {
      final other = classes[i];
      final oLower = other.name.toLowerCase();
      final pLower = primaryClass.name.toLowerCase();

      UmlRelationType relType = UmlRelationType.association;
      String multSrc = '1..1';
      String multTgt = '0..*';
      String label = 'asocia';

      if (oLower.contains('trabajador') || oLower.contains('empleado') || oLower.contains('vendedor')) {
        label = 'opera';
        multSrc = '1..*';
        multTgt = '1..*';
      } else if (oLower.contains('material') || oLower.contains('insumo') || oLower.contains('pieza')) {
        relType = UmlRelationType.composition;
        label = 'compone';
        multSrc = '1..1';
        multTgt = '1..*';
      } else if (oLower.contains('catalogo') || oLower.contains('categoria') || oLower.contains('tipo')) {
        relType = UmlRelationType.aggregation;
        label = 'clasifica';
        multSrc = '1..1';
        multTgt = '0..*';
      } else if (oLower.contains('cliente') || oLower.contains('usuario') || oLower.contains('paciente') || oLower.contains('huesped')) {
        label = 'adquiere';
        multSrc = '1..1';
        multTgt = '0..*';
      } else if (oLower.contains('registro') || oLower.contains('detalle') || oLower.contains('orden') || oLower.contains('pedido')) {
        relType = UmlRelationType.composition;
        label = 'registra';
        multSrc = '1..1';
        multTgt = '1..*';
      }

      connect(primaryClass.name, other.name, relType, multSrc, multTgt, label);
    }

    // Interconectar entre entidades secundarias de forma coherente
    if (classes.length >= 3) {
      for (int i = 1; i < classes.length - 1; i++) {
        final c1 = classes[i];
        final c2 = classes[i + 1];
        final name1 = c1.name.toLowerCase();
        final name2 = c2.name.toLowerCase();

        String label = 'vincula';
        UmlRelationType relType = UmlRelationType.association;
        String m1 = '1..1';
        String m2 = '0..*';

        if ((name1.contains('trabajador') || name1.contains('empleado')) && (name2.contains('material') || name2.contains('insumo'))) {
          label = 'suministra';
          m1 = '1..*';
          m2 = '1..*';
        } else if ((name2.contains('catalogo') || name2.contains('categoria'))) {
          label = 'organiza';
          relType = UmlRelationType.aggregation;
          m1 = '1..1';
          m2 = '0..*';
        } else if (name1.contains('cliente') && name2.contains('registro')) {
          label = 'genera';
          m1 = '1..1';
          m2 = '1..*';
        }

        connect(c1.name, c2.name, relType, m1, m2, label);
      }
    }

    // Asegurar que ninguna clase quede completamente aislada
    for (int i = 0; i < classes.length; i++) {
      final c = classes[i];
      final isConnected = relations.any((r) => r.sourceClassId == c.id || r.targetClassId == c.id);
      if (!isConnected) {
        final target = (i == 0) ? classes[1] : classes[0];
        connect(c.name, target.name, UmlRelationType.association, '1..1', '0..*', 'relaciona');
      }
    }

    final speech = 'Sistema para ${domainName} sintetizado con éxito. Se generaron ${classes.length} clases y ${relations.length} relaciones completas en el lienzo.';

    return UmlGeneratedResult(
      diagramName: domainName,
      description: 'Generado por voz mediante IA a partir de: "$prompt"',
      classes: classes,
      relations: relations,
      speechResponse: speech,
    );
  }

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
      UmlRelation(
        id: 'r1',
        sourceClassId: cCliente.id,
        targetClassId: cMascota.id,
        type: UmlRelationType.composition,
        name: 'posee',
      ),
      UmlRelation(
        id: 'r2',
        sourceClassId: cMascota.id,
        targetClassId: cCita.id,
        type: UmlRelationType.association,
        name: 'registra',
      ),
      UmlRelation(
        id: 'r3',
        sourceClassId: cVet.id,
        targetClassId: cCita.id,
        type: UmlRelationType.association,
        name: 'atiende',
      ),
    ];

    return UmlGeneratedResult(
      diagramName: 'Sistema de Clínica Veterinaria',
      description: 'Modelo oficial del examen parcial con Cliente, Mascota, Veterinario y CitaMedica.',
      classes: [cCliente, cMascota, cVet, cCita],
      relations: relations,
      speechResponse: 'Diagrama de Clínica Veterinaria generado con éxito. Incluye Cliente, Mascota, Veterinario y Cita Médica.',
    );
  }

  static UmlGeneratedResult _buildHoteleriaDomain() {
    return _generateCustomDomain(
      'Sistema de Hoteleria',
      'Sistema de Hotelería',
      ['Hotel', 'Habitacion', 'Empleado', 'Huesped', 'Reserva'],
    );
  }

  static UmlGeneratedResult _buildVentasDomain() {
    return _generateCustomDomain(
      'Sistema de Facturación',
      'Sistema de Facturación y Ventas',
      ['Cliente', 'Factura', 'DetalleFactura', 'Producto'],
    );
  }

  static UmlGeneratedResult _buildHospitalDomain() {
    return _generateCustomDomain(
      'Sistema Hospitalario',
      'Sistema Hospitalario y Consultas',
      ['Paciente', 'Medico', 'ConsultaMedica', 'HistorialClinico'],
    );
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
        UmlAttribute(id: aId(), name: 'ciudad', type: 'String'),
      ];
    }
    if (lower.contains('habitacion')) {
      return [
        UmlAttribute(id: aId(), name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: aId(), name: 'numero', type: 'String'),
        UmlAttribute(id: aId(), name: 'tipo', type: 'String'),
        UmlAttribute(id: aId(), name: 'precioPorNoche', type: 'Double'),
        UmlAttribute(id: aId(), name: 'estado', type: 'String'),
      ];
    }
    if (lower.contains('huesped')) {
      return [
        UmlAttribute(id: aId(), name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: aId(), name: 'nombreCompleto', type: 'String'),
        UmlAttribute(id: aId(), name: 'ciPasaporte', type: 'String'),
        UmlAttribute(id: aId(), name: 'telefono', type: 'String'),
      ];
    }
    if (lower.contains('reserva')) {
      return [
        UmlAttribute(id: aId(), name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: aId(), name: 'codigoReserva', type: 'String'),
        UmlAttribute(id: aId(), name: 'fechaIngreso', type: 'LocalDate'),
        UmlAttribute(id: aId(), name: 'totalMonto', type: 'Double'),
      ];
    }
    if (lower.contains('cliente') || lower.contains('usuario')) {
      return [
        UmlAttribute(id: aId(), name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: aId(), name: 'nombreCompleto', type: 'String'),
        UmlAttribute(id: aId(), name: 'ciNit', type: 'String'),
        UmlAttribute(id: aId(), name: 'email', type: 'String'),
      ];
    }
    if (lower.contains('empleado') || lower.contains('vendedor')) {
      return [
        UmlAttribute(id: aId(), name: 'id', type: 'Long', isPrimaryKey: true),
        UmlAttribute(id: aId(), name: 'codigo', type: 'String'),
        UmlAttribute(id: aId(), name: 'nombre', type: 'String'),
        UmlAttribute(id: aId(), name: 'salarioBase', type: 'Double'),
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
      UmlMethod(id: mId(), name: 'obtenerDetalle', returnType: 'String'),
    ];
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
    };
    return stops.contains(w.toLowerCase());
  }
}
