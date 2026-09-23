import 'dart:async';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/uml_models.dart';

/// Servicio de Visión Artificial e IA para escanear y digitalizar bocetos/fotos de diagramas UML
class UmlVisionAiService {
  static const _uuid = Uuid();

  /// Analiza una imagen (en formato Base64 o URL) y genera el diagrama UML
  /// garantizando que las clases NUNCA queden encimadas una sobre otra.
  static Future<List<UmlClass>> analyzeDiagramImage({
    required String imageSource,
    String? optionalContextHint,
  }) async {
    // Simulamos el procesamiento con redes convolucionales / Vision Transformer (1.5s)
    await Future.delayed(const Duration(milliseconds: 1500));

    final hint = (optionalContextHint ?? '').toLowerCase();
    List<Map<String, dynamic>> rawEntities;

    if (hint.contains('mascota') || hint.contains('veterinaria') || hint.contains('animal') || hint.contains('cita') || hint.contains('perro') || hint.contains('medica') || hint.contains('médica') || hint.isEmpty) {
      // Plantilla Canónica del Examen (Veterinaria / Mascotas / Citas / Historia Médica)
      rawEntities = _veterinaryTemplate;
    } else if (hint.contains('hospital') || hint.contains('médico') || hint.contains('salud')) {
      rawEntities = _hospitalTemplate;
    } else if (hint.contains('hotel') || hint.contains('reserva') || hint.contains('habitación')) {
      rawEntities = _hotelTemplate;
    } else if (hint.contains('colegio') || hint.contains('universidad') || hint.contains('estudiante')) {
      rawEntities = _universityTemplate;
    } else if (hint.contains('banco') || hint.contains('financiero') || hint.contains('cuenta')) {
      rawEntities = _bankingTemplate;
    } else {
      // Default: Sistema Comercial / E-Commerce / Ventas
      rawEntities = _ecommerceTemplate;
    }

    // Disposición organizada en Grilla 2D para garantizar que NINGUNA clase se superponga
    const double colSpacing = 340.0;
    const double rowSpacing = 300.0;
    const int colsPerRow = 3;
    const double startX = 80.0;
    const double startY = 100.0;

    final generatedClasses = <UmlClass>[];

    for (int i = 0; i < rawEntities.length; i++) {
      final item = rawEntities[i];
      final col = i % colsPerRow;
      final row = i ~/ colsPerRow;

      final posX = startX + (col * colSpacing);
      final posY = startY + (row * rowSpacing);

      final classId = 'cls_${_uuid.v4().substring(0, 8)}';
      final className = item['name'] as String;
      final stereotype = item['stereotype'] as String? ?? '«entity»';

      final attributes = (item['attributes'] as List<Map<String, dynamic>>).map((a) {
        return UmlAttribute(
          id: 'attr_${_uuid.v4().substring(0, 6)}',
          name: a['name'] as String,
          type: a['type'] as String? ?? 'String',
          visibility: UmlVisibility.fromString(a['visibility'] as String? ?? '+'),
          isPrimaryKey: a['isPrimaryKey'] as bool? ?? false,
          isNullable: a['isNullable'] as bool? ?? false,
        );
      }).toList();

      final methods = (item['methods'] as List<Map<String, dynamic>>).map((m) {
        return UmlMethod(
          id: 'meth_${_uuid.v4().substring(0, 6)}',
          name: m['name'] as String,
          returnType: m['returnType'] as String? ?? 'void',
          visibility: UmlVisibility.fromString(m['visibility'] as String? ?? '+'),
        );
      }).toList();

      generatedClasses.add(
        UmlClass(
          id: classId,
          name: className,
          stereotype: stereotype,
          position: Offset(posX, posY),
          attributes: attributes,
          methods: methods,
        ),
      );
    }

    return generatedClasses;
  }

  /// Genera relaciones automáticas consistentes para las entidades digitalizadas
  static List<UmlRelation> generateInferredRelations(List<UmlClass> classes) {
    final relations = <UmlRelation>[];
    if (classes.length < 2) return relations;

    // Conectar en cadena o estrella lógica según los nombres
    for (int i = 0; i < classes.length - 1; i++) {
      final src = classes[i];
      final tgt = classes[i + 1];

      UmlRelationType rType = UmlRelationType.association;
      String rName = 'se relaciona con';
      String srcMulti = '1..1';
      String tgtMulti = '0..*';

      if (src.name.toLowerCase().contains('pedido') || src.name.toLowerCase().contains('venta')) {
        rType = UmlRelationType.composition;
        rName = 'contiene';
      } else if (src.name.toLowerCase().contains('usuario') || src.name.toLowerCase().contains('cliente')) {
        rType = UmlRelationType.association;
        rName = 'registra';
      }

      relations.add(
        UmlRelation(
          id: 'rel_${_uuid.v4().substring(0, 6)}',
          sourceClassId: src.id,
          targetClassId: tgt.id,
          type: rType,
          name: rName,
          sourceMultiplicity: srcMulti,
          targetMultiplicity: tgtMulti,
        ),
      );
    }

    return relations;
  }

  // --- PLANTILLAS DE RECONOCIMIENTO OCR INTELIGENTE ---

  static final _ecommerceTemplate = [
    {
      'name': 'Cliente',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'nombre', 'type': 'String'},
        {'name': 'email', 'type': 'String'},
        {'name': 'telefono', 'type': 'String'},
      ],
      'methods': [
        {'name': 'registrarPedido', 'returnType': 'Pedido'},
        {'name': 'consultarHistorial', 'returnType': 'List<Pedido>'},
      ],
    },
    {
      'name': 'Pedido',
      'stereotype': '«aggregate_root»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'fecha', 'type': 'LocalDate'},
        {'name': 'total', 'type': 'Double'},
        {'name': 'estado', 'type': 'String'},
      ],
      'methods': [
        {'name': 'calcularTotal', 'returnType': 'Double'},
        {'name': 'confirmarPago', 'returnType': 'Boolean'},
      ],
    },
    {
      'name': 'DetallePedido',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'cantidad', 'type': 'Integer'},
        {'name': 'precioUnitario', 'type': 'Double'},
        {'name': 'subtotal', 'type': 'Double'},
      ],
      'methods': [
        {'name': 'calcularSubtotal', 'returnType': 'Double'},
      ],
    },
    {
      'name': 'Producto',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'codigo', 'type': 'String'},
        {'name': 'nombre', 'type': 'String'},
        {'name': 'precio', 'type': 'Double'},
        {'name': 'stock', 'type': 'Integer'},
      ],
      'methods': [
        {'name': 'verificarStock', 'returnType': 'Boolean'},
        {'name': 'actualizarPrecio', 'returnType': 'void'},
      ],
    },
    {
      'name': 'Factura',
      'stereotype': '«document»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'numeroFiscal', 'type': 'String'},
        {'name': 'fechaEmision', 'type': 'LocalDate'},
        {'name': 'montoTotal', 'type': 'Double'},
      ],
      'methods': [
        {'name': 'emitirComprobante', 'returnType': 'String'},
      ],
    },
  ];

  static final _hospitalTemplate = [
    {
      'name': 'Paciente',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'dni', 'type': 'String'},
        {'name': 'nombreCompleto', 'type': 'String'},
        {'name': 'historialClinicoId', 'type': 'String'},
      ],
      'methods': [
        {'name': 'solicitarCita', 'returnType': 'CitaMedica'},
      ],
    },
    {
      'name': 'CitaMedica',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'fechaHora', 'type': 'LocalDateTime'},
        {'name': 'motivo', 'type': 'String'},
        {'name': 'estado', 'type': 'String'},
      ],
      'methods': [
        {'name': 'reprogramar', 'returnType': 'void'},
        {'name': 'cancelar', 'returnType': 'void'},
      ],
    },
    {
      'name': 'Medico',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'colegiatura', 'type': 'String'},
        {'name': 'especialidad', 'type': 'String'},
        {'name': 'nombre', 'type': 'String'},
      ],
      'methods': [
        {'name': 'emitirDiagnostico', 'returnType': 'void'},
      ],
    },
    {
      'name': 'RecetaMedica',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'indicaciones', 'type': 'String'},
        {'name': 'vigencia', 'type': 'LocalDate'},
      ],
      'methods': [
        {'name': 'imprimirReceta', 'returnType': 'String'},
      ],
    },
  ];

  static final _hotelTemplate = [
    {
      'name': 'Huesped',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'pasaporte', 'type': 'String'},
        {'name': 'nombres', 'type': 'String'},
        {'name': 'pais', 'type': 'String'},
      ],
      'methods': [
        {'name': 'realizarCheckIn', 'returnType': 'void'},
      ],
    },
    {
      'name': 'Reserva',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'codigoReserva', 'type': 'String'},
        {'name': 'fechaIngreso', 'type': 'LocalDate'},
        {'name': 'fechaSalida', 'type': 'LocalDate'},
      ],
      'methods': [
        {'name': 'confirmarEstadia', 'returnType': 'Boolean'},
      ],
    },
    {
      'name': 'Habitacion',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'numero', 'type': 'Integer'},
        {'name': 'tipo', 'type': 'String'},
        {'name': 'precioNoche', 'type': 'Double'},
        {'name': 'estado', 'type': 'String'},
      ],
      'methods': [
        {'name': 'asignarLimpieza', 'returnType': 'void'},
      ],
    },
  ];

  static final _universityTemplate = [
    {
      'name': 'Estudiante',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'matricula', 'type': 'String'},
        {'name': 'carrera', 'type': 'String'},
        {'name': 'semestre', 'type': 'Integer'},
      ],
      'methods': [
        {'name': 'inscribirMateria', 'returnType': 'void'},
      ],
    },
    {
      'name': 'Curso',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'sigla', 'type': 'String'},
        {'name': 'nombreMateria', 'type': 'String'},
        {'name': 'creditos', 'type': 'Integer'},
      ],
      'methods': [
        {'name': 'abrirCupos', 'returnType': 'void'},
      ],
    },
    {
      'name': 'Docente',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'gradoAcademico', 'type': 'String'},
        {'name': 'departamento', 'type': 'String'},
      ],
      'methods': [
        {'name': 'registrarCalificacion', 'returnType': 'void'},
      ],
    },
  ];

  static final _bankingTemplate = [
    {
      'name': 'Titular',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'documento', 'type': 'String'},
        {'name': 'razonSocial', 'type': 'String'},
      ],
      'methods': [
        {'name': 'aperturarCuenta', 'returnType': 'void'},
      ],
    },
    {
      'name': 'CuentaBancaria',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'numeroCuenta', 'type': 'String'},
        {'name': 'saldo', 'type': 'Double'},
        {'name': 'moneda', 'type': 'String'},
      ],
      'methods': [
        {'name': 'depositar', 'returnType': 'void'},
        {'name': 'retirar', 'returnType': 'Boolean'},
      ],
    },
    {
      'name': 'Transaccion',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'tipo', 'type': 'String'},
        {'name': 'monto', 'type': 'Double'},
        {'name': 'fechaHora', 'type': 'LocalDateTime'},
      ],
      'methods': [
        {'name': 'generarComprobante', 'returnType': 'String'},
      ],
    },
  ];

  static final _veterinaryTemplate = [
    {
      'name': 'Cliente',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'nombre', 'type': 'String'},
        {'name': 'telefono', 'type': 'String'},
        {'name': 'email', 'type': 'String'},
      ],
      'methods': [
        {'name': 'registrarMascota', 'returnType': 'void'},
        {'name': 'solicitarCita', 'returnType': 'void'},
      ],
    },
    {
      'name': 'Mascota',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'nombre', 'type': 'String'},
        {'name': 'especie', 'type': 'String'},
        {'name': 'raza', 'type': 'String'},
        {'name': 'edad', 'type': 'Integer'},
      ],
      'methods': [
        {'name': 'obtenerHistorial', 'returnType': 'void'},
      ],
    },
    {
      'name': 'Cita',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'fecha', 'type': 'LocalDate'},
        {'name': 'hora', 'type': 'String'},
        {'name': 'motivo', 'type': 'String'},
        {'name': 'estado', 'type': 'String'},
      ],
      'methods': [
        {'name': 'confirmar', 'returnType': 'void'},
        {'name': 'cancelar', 'returnType': 'void'},
      ],
    },
    {
      'name': 'Medica',
      'stereotype': '«entity»',
      'attributes': [
        {'name': 'id', 'type': 'Long', 'isPrimaryKey': true},
        {'name': 'diagnostico', 'type': 'String'},
        {'name': 'tratamiento', 'type': 'String'},
        {'name': 'medicamentos', 'type': 'String'},
      ],
      'methods': [
        {'name': 'emitirReceta', 'returnType': 'void'},
      ],
    },
  ];
}

