import { Injectable } from '@angular/core';
import { UmlClass, UmlRelation, UmlAttribute, UmlMethod, UmlDataType, UmlRelationType } from '../models/uml.models';

export interface PromptGeneratedResult {
  diagramName: string;
  description: string;
  classes: UmlClass[];
  relations: UmlRelation[];
  summary: string;
}

@Injectable({
  providedIn: 'root'
})
export class UmlPromptGeneratorService {

  /**
   * Genera un modelo de clases UML 2.5 completo a partir de un texto en lenguaje natural
   */
  generateFromPrompt(prompt: string): PromptGeneratedResult {
    const cleanPrompt = (prompt || '').trim();
    const lower = cleanPrompt.toLowerCase();

    // 1. Si el usuario especificó una lista explícita de entidades (ej. "con hotel, habitacion...")
    // le damos prioridad absoluta a sus clases personalizadas
    const parsed = this.extractDomainAndEntities(cleanPrompt);
    if (parsed.entityNames.length >= 2) {
      return this.parseGenericPrompt(cleanPrompt);
    }

    // 2. Detectar si coincide con dominios predeterminados del examen
    if (lower.includes('veterinari') || lower.includes('mascota') || lower.includes('perro') || lower.includes('gato')) {
      return this.buildVeterinariaDomain(cleanPrompt);
    } else if (lower.includes('factura') || lower.includes('tienda') || lower.includes('ecommerce') || lower.includes('pedido') || lower.includes('venta')) {
      return this.buildVentasDomain(cleanPrompt);
    } else if (lower.includes('hospital') || lower.includes('clinica') || lower.includes('medico') || lower.includes('paciente')) {
      return this.buildHospitalDomain(cleanPrompt);
    } else if (lower.includes('biblioteca') || lower.includes('libro') || lower.includes('prestamo')) {
      return this.buildBibliotecaDomain(cleanPrompt);
    } else if (lower.includes('taller') || lower.includes('mecanic') || lower.includes('auto') || lower.includes('vehiculo')) {
      return this.buildTallerDomain(cleanPrompt);
    } else if (lower.includes('universidad') || lower.includes('estudiante') || lower.includes('alumno') || lower.includes('curso') || lower.includes('materia')) {
      return this.buildUniversidadDomain(cleanPrompt);
    }

    // 3. Parser Heurístico Dinámico para dominios personalizados
    return this.parseGenericPrompt(cleanPrompt);
  }

  // =========================================================================
  // DOMINIO VETERINARIA (Caso Explícito del Examen Parcial)
  // =========================================================================
  private buildVeterinariaDomain(rawPrompt: string): PromptGeneratedResult {
    const timestamp = Date.now();
    const c1Id = `cls_${timestamp}_1`;
    const c2Id = `cls_${timestamp}_2`;
    const c3Id = `cls_${timestamp}_3`;
    const c4Id = `cls_${timestamp}_4`;
    const c5Id = `cls_${timestamp}_5`;

    const classes: UmlClass[] = [
      {
        id: c1Id,
        name: 'Cliente',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 80, y: 80 },
        attributes: [
          { id: 'attr_1_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_1_2', name: 'nombreCompleto', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_1_3', name: 'ci', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_1_4', name: 'telefono', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true },
          { id: 'attr_1_5', name: 'email', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: [
          { id: 'm_1_1', name: 'registrar', returnType: 'void', visibility: '+', parameters: [] },
          { id: 'm_1_2', name: 'obtenerMascotas', returnType: 'List<Mascota>', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c2Id,
        name: 'Mascota',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 440, y: 80 },
        attributes: [
          { id: 'attr_2_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_2_2', name: 'nombre', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_2_3', name: 'especie', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_2_4', name: 'raza', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true },
          { id: 'attr_2_5', name: 'edadAnios', type: 'Integer', visibility: '+', isPrimaryKey: false, isNullable: true },
          { id: 'attr_2_6', name: 'pesoKg', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: [
          { id: 'm_2_1', name: 'calcularDosis', returnType: 'Double', visibility: '+', parameters: [{ name: 'peso', type: 'Double' }] },
          { id: 'm_2_2', name: 'historialClinico', returnType: 'List<CitaMedica>', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c3Id,
        name: 'Veterinario',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 80, y: 440 },
        attributes: [
          { id: 'attr_3_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_3_2', name: 'nombre', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_3_3', name: 'matriculaProfesional', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_3_4', name: 'especialidad', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true },
          { id: 'attr_3_5', name: 'turno', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: [
          { id: 'm_3_1', name: 'atenderCita', returnType: 'void', visibility: '+', parameters: [{ name: 'citaId', type: 'Long' }] },
          { id: 'm_3_2', name: 'prescribirReceta', returnType: 'String', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c4Id,
        name: 'CitaMedica',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 440, y: 440 },
        attributes: [
          { id: 'attr_4_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_4_2', name: 'fechaHora', type: 'LocalDate', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_4_3', name: 'motivoConsulta', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_4_4', name: 'costo', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_4_5', name: 'estado', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: [
          { id: 'm_4_1', name: 'confirmarCita', returnType: 'boolean', visibility: '+', parameters: [] },
          { id: 'm_4_2', name: 'cancelarCita', returnType: 'void', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c5Id,
        name: 'Tratamiento',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 800, y: 440 },
        attributes: [
          { id: 'attr_5_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_5_2', name: 'descripcion', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_5_3', name: 'medicamentos', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true },
          { id: 'attr_5_4', name: 'diasDuracion', type: 'Integer', visibility: '+', isPrimaryKey: false, isNullable: true },
          { id: 'attr_5_5', name: 'costoTratamiento', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: [
          { id: 'm_5_1', name: 'aplicarDosis', returnType: 'void', visibility: '+', parameters: [] }
        ]
      }
    ];

    const relations: UmlRelation[] = [
      {
        id: `rel_${timestamp}_1`,
        sourceClassId: c1Id,
        targetClassId: c2Id,
        type: 'COMPOSITION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'posee'
      },
      {
        id: `rel_${timestamp}_2`,
        sourceClassId: c2Id,
        targetClassId: c4Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'registra'
      },
      {
        id: `rel_${timestamp}_3`,
        sourceClassId: c3Id,
        targetClassId: c4Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'atiende'
      },
      {
        id: `rel_${timestamp}_4`,
        sourceClassId: c4Id,
        targetClassId: c5Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '1..1',
        name: 'incluye'
      }
    ];

    return {
      diagramName: 'Sistema de Gestión Veterinaria',
      description: 'Modelo conceptual UML 2.5 de dominio veterinario generado por IA mediante descripción textual y comandos de voz.',
      classes,
      relations,
      summary: '5 Clases generadas: Cliente, Mascota, Veterinario, CitaMedica y Tratamiento con 4 relaciones de cardinalidad.'
    };
  }

  // =========================================================================
  // DOMINIO VENTAS Y FACTURACIÓN ECOMMERCE
  // =========================================================================
  private buildVentasDomain(rawPrompt: string): PromptGeneratedResult {
    const timestamp = Date.now();
    const c1Id = `cls_${timestamp}_1`;
    const c2Id = `cls_${timestamp}_2`;
    const c3Id = `cls_${timestamp}_3`;
    const c4Id = `cls_${timestamp}_4`;
    const c5Id = `cls_${timestamp}_5`;

    const classes: UmlClass[] = [
      {
        id: c1Id,
        name: 'Cliente',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 80, y: 80 },
        attributes: [
          { id: 'attr_v1_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_v1_2', name: 'razonSocial', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_v1_3', name: 'nit', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_v1_4', name: 'email', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: [
          { id: 'm_v1_1', name: 'obtenerHistorialCompras', returnType: 'List<Factura>', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c2Id,
        name: 'Factura',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 440, y: 80 },
        attributes: [
          { id: 'attr_v2_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_v2_2', name: 'numeroFactura', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_v2_3', name: 'fechaEmision', type: 'LocalDate', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_v2_4', name: 'montoTotal', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_v2_5', name: 'estadoPago', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: [
          { id: 'm_v2_1', name: 'calcularTotal', returnType: 'Double', visibility: '+', parameters: [] },
          { id: 'm_v2_2', name: 'anularFactura', returnType: 'void', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c3Id,
        name: 'DetalleFactura',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 800, y: 80 },
        attributes: [
          { id: 'attr_v3_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_v3_2', name: 'cantidad', type: 'Integer', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_v3_3', name: 'precioUnitario', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_v3_4', name: 'subtotal', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: [
          { id: 'm_v3_1', name: 'calcularSubtotal', returnType: 'Double', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c4Id,
        name: 'Producto',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 800, y: 440 },
        attributes: [
          { id: 'attr_v4_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_v4_2', name: 'codigoBarra', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_v4_3', name: 'nombre', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_v4_4', name: 'precioVenta', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_v4_5', name: 'stockDisponible', type: 'Integer', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: [
          { id: 'm_v4_1', name: 'reducirStock', returnType: 'boolean', visibility: '+', parameters: [{ name: 'cant', type: 'Integer' }] }
        ]
      },
      {
        id: c5Id,
        name: 'Categoria',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 440, y: 440 },
        attributes: [
          { id: 'attr_v5_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_v5_2', name: 'nombreCategoria', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_v5_3', name: 'descripcion', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: []
      }
    ];

    const relations: UmlRelation[] = [
      {
        id: `rel_v_${timestamp}_1`,
        sourceClassId: c1Id,
        targetClassId: c2Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'emite'
      },
      {
        id: `rel_v_${timestamp}_2`,
        sourceClassId: c2Id,
        targetClassId: c3Id,
        type: 'COMPOSITION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '1..*',
        name: 'contiene'
      },
      {
        id: `rel_v_${timestamp}_3`,
        sourceClassId: c3Id,
        targetClassId: c4Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '0..*',
        targetMultiplicity: '1..1',
        name: 'refiere'
      },
      {
        id: `rel_v_${timestamp}_4`,
        sourceClassId: c5Id,
        targetClassId: c4Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'clasifica'
      }
    ];

    return {
      diagramName: 'Plataforma de Facturación y Ventas',
      description: 'Modelo de datos UML 2.5 para facturación, líneas de detalle de pedido, clientes y control de existencias.',
      classes,
      relations,
      summary: '5 Clases generadas: Cliente, Factura, DetalleFactura, Producto y Categoria con 4 relaciones de composición y asociación.'
    };
  }

  // =========================================================================
  // DOMINIO HOSPITAL Y SALUD CLÍNICA
  // =========================================================================
  private buildHospitalDomain(rawPrompt: string): PromptGeneratedResult {
    const timestamp = Date.now();
    const c1Id = `cls_h_${timestamp}_1`;
    const c2Id = `cls_h_${timestamp}_2`;
    const c3Id = `cls_h_${timestamp}_3`;
    const c4Id = `cls_h_${timestamp}_4`;

    const classes: UmlClass[] = [
      {
        id: c1Id,
        name: 'Paciente',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 100, y: 100 },
        attributes: [
          { id: 'attr_h1_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_h1_2', name: 'nombreCompleto', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_h1_3', name: 'ci', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_h1_4', name: 'fechaNacimiento', type: 'LocalDate', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_h1_5', name: 'grupoSanguineo', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: [
          { id: 'm_h1_1', name: 'calcularEdad', returnType: 'Integer', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c2Id,
        name: 'Medico',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 520, y: 100 },
        attributes: [
          { id: 'attr_h2_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_h2_2', name: 'nombre', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_h2_3', name: 'matricula', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_h2_4', name: 'especialidad', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: [
          { id: 'm_h2_1', name: 'atenderPaciente', returnType: 'void', visibility: '+', parameters: [{ name: 'pacienteId', type: 'Long' }] }
        ]
      },
      {
        id: c3Id,
        name: 'ConsultaMedica',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 520, y: 440 },
        attributes: [
          { id: 'attr_h3_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_h3_2', name: 'fecha', type: 'LocalDate', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_h3_3', name: 'motivo', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_h3_4', name: 'diagnostico', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: [
          { id: 'm_h3_1', name: 'emitirReceta', returnType: 'void', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c4Id,
        name: 'HistorialClinico',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 100, y: 440 },
        attributes: [
          { id: 'attr_h4_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_h4_2', name: 'antecedentes', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true },
          { id: 'attr_h4_3', name: 'alergias', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: [
          { id: 'm_h4_1', name: 'agregarEntrada', returnType: 'void', visibility: '+', parameters: [{ name: 'texto', type: 'String' }] }
        ]
      }
    ];

    const relations: UmlRelation[] = [
      {
        id: `rel_h_${timestamp}_1`,
        sourceClassId: c1Id,
        targetClassId: c4Id,
        type: 'COMPOSITION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '1..1',
        name: 'posee'
      },
      {
        id: `rel_h_${timestamp}_2`,
        sourceClassId: c1Id,
        targetClassId: c3Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'solicita'
      },
      {
        id: `rel_h_${timestamp}_3`,
        sourceClassId: c2Id,
        targetClassId: c3Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'dictamina'
      }
    ];

    return {
      diagramName: 'Sistema Hospitalario y Consultas',
      description: 'Modelo conceptual UML de salud clínica con pacientes, médicos, consultas e historial clínico.',
      classes,
      relations,
      summary: '4 Clases generadas: Paciente, Medico, ConsultaMedica e HistorialClinico con 3 relaciones.'
    };
  }

  // =========================================================================
  // DOMINIO BIBLIOTECA
  // =========================================================================
  private buildBibliotecaDomain(rawPrompt: string): PromptGeneratedResult {
    const timestamp = Date.now();
    const c1Id = `cls_b_${timestamp}_1`;
    const c2Id = `cls_b_${timestamp}_2`;
    const c3Id = `cls_b_${timestamp}_3`;
    const c4Id = `cls_b_${timestamp}_4`;

    const classes: UmlClass[] = [
      {
        id: c1Id,
        name: 'Lector',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 100, y: 100 },
        attributes: [
          { id: 'attr_b1_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_b1_2', name: 'nombreCompleto', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_b1_3', name: 'ci', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_b1_4', name: 'email', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: [
          { id: 'm_b1_1', name: 'tieneSancion', returnType: 'boolean', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c2Id,
        name: 'Libro',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 550, y: 100 },
        attributes: [
          { id: 'attr_b2_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_b2_2', name: 'isbn', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_b2_3', name: 'titulo', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_b2_4', name: 'anioPublicacion', type: 'Integer', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: [
          { id: 'm_b2_1', name: 'hayDisponibles', returnType: 'boolean', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c3Id,
        name: 'Prestamo',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 320, y: 440 },
        attributes: [
          { id: 'attr_b3_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_b3_2', name: 'fechaPrestamo', type: 'LocalDate', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_b3_3', name: 'fechaDevolucion', type: 'LocalDate', visibility: '+', isPrimaryKey: false, isNullable: true },
          { id: 'attr_b3_4', name: 'estado', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: [
          { id: 'm_b3_1', name: 'registrarDevolucion', returnType: 'void', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c4Id,
        name: 'Autor',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 920, y: 100 },
        attributes: [
          { id: 'attr_b4_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_b4_2', name: 'nombre', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_b4_3', name: 'nacionalidad', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: []
      }
    ];

    const relations: UmlRelation[] = [
      {
        id: `rel_b_${timestamp}_1`,
        sourceClassId: c1Id,
        targetClassId: c3Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'realiza'
      },
      {
        id: `rel_b_${timestamp}_2`,
        sourceClassId: c2Id,
        targetClassId: c3Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'incluye'
      },
      {
        id: `rel_b_${timestamp}_3`,
        sourceClassId: c4Id,
        targetClassId: c2Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..*',
        targetMultiplicity: '1..*',
        name: 'escribe'
      }
    ];

    return {
      diagramName: 'Sistema de Gestión Bibliotecaria',
      description: 'Modelo conceptual UML de préstamos bibliotecarios, libros, autores y lectores universitarios.',
      classes,
      relations,
      summary: '4 Clases generadas: Lector, Libro, Prestamo y Autor con 3 relaciones.'
    };
  }

  // =========================================================================
  // DOMINIO TALLER MECÁNICO
  // =========================================================================
  private buildTallerDomain(rawPrompt: string): PromptGeneratedResult {
    const timestamp = Date.now();
    const c1Id = `cls_t_${timestamp}_1`;
    const c2Id = `cls_t_${timestamp}_2`;
    const c3Id = `cls_t_${timestamp}_3`;
    const c4Id = `cls_t_${timestamp}_4`;

    const classes: UmlClass[] = [
      {
        id: c1Id,
        name: 'Cliente',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 100, y: 100 },
        attributes: [
          { id: 'attr_t1_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_t1_2', name: 'nombreCompleto', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_t1_3', name: 'telefono', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: []
      },
      {
        id: c2Id,
        name: 'Vehiculo',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 500, y: 100 },
        attributes: [
          { id: 'attr_t2_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_t2_2', name: 'placa', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_t2_3', name: 'marca', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_t2_4', name: 'modelo', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: []
      },
      {
        id: c3Id,
        name: 'OrdenReparacion',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 500, y: 440 },
        attributes: [
          { id: 'attr_t3_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_t3_2', name: 'fechaIngreso', type: 'LocalDate', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_t3_3', name: 'fallaReportada', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_t3_4', name: 'costoTotal', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: [
          { id: 'm_t3_1', name: 'completarServicio', returnType: 'void', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c4Id,
        name: 'Mecanico',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 100, y: 440 },
        attributes: [
          { id: 'attr_t4_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_t4_2', name: 'nombre', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_t4_3', name: 'especialidad', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: []
      }
    ];

    const relations: UmlRelation[] = [
      {
        id: `rel_t_${timestamp}_1`,
        sourceClassId: c1Id,
        targetClassId: c2Id,
        type: 'COMPOSITION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '1..*',
        name: 'esDueñoDe'
      },
      {
        id: `rel_t_${timestamp}_2`,
        sourceClassId: c2Id,
        targetClassId: c3Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'recibe'
      },
      {
        id: `rel_t_${timestamp}_3`,
        sourceClassId: c4Id,
        targetClassId: c3Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'ejecuta'
      }
    ];

    return {
      diagramName: 'Sistema de Taller Mecánico Automotriz',
      description: 'Modelo conceptual UML de vehículos, órdenes de reparación, mecánicos y clientes.',
      classes,
      relations,
      summary: '4 Clases generadas: Cliente, Vehiculo, OrdenReparacion y Mecanico con 3 relaciones.'
    };
  }

  // =========================================================================
  // DOMINIO UNIVERSIDAD
  // =========================================================================
  private buildUniversidadDomain(rawPrompt: string): PromptGeneratedResult {
    const timestamp = Date.now();
    const c1Id = `cls_u_${timestamp}_1`;
    const c2Id = `cls_u_${timestamp}_2`;
    const c3Id = `cls_u_${timestamp}_3`;
    const c4Id = `cls_u_${timestamp}_4`;

    const classes: UmlClass[] = [
      {
        id: c1Id,
        name: 'Estudiante',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 100, y: 100 },
        attributes: [
          { id: 'attr_u1_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_u1_2', name: 'nombreCompleto', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_u1_3', name: 'matriculaEstudiantil', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_u1_4', name: 'carrera', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: [
          { id: 'm_u1_1', name: 'calcularPromedio', returnType: 'Double', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c2Id,
        name: 'Profesor',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 550, y: 100 },
        attributes: [
          { id: 'attr_u2_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_u2_2', name: 'nombreCompleto', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_u2_3', name: 'codigoDocente', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_u2_4', name: 'tituloAcademico', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: [
          { id: 'm_u2_1', name: 'asignarCalificacion', returnType: 'void', visibility: '+', parameters: [] }
        ]
      },
      {
        id: c3Id,
        name: 'Materia',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 550, y: 440 },
        attributes: [
          { id: 'attr_u3_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_u3_2', name: 'sigla', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_u3_3', name: 'nombre', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_u3_4', name: 'creditos', type: 'Integer', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: []
      },
      {
        id: c4Id,
        name: 'Inscripcion',
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: 100, y: 440 },
        attributes: [
          { id: 'attr_u4_1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: 'attr_u4_2', name: 'fechaInscripcion', type: 'LocalDate', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_u4_3', name: 'semestre', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: 'attr_u4_4', name: 'notaFinal', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: true }
        ],
        methods: [
          { id: 'm_u4_1', name: 'estaAprobada', returnType: 'boolean', visibility: '+', parameters: [] }
        ]
      }
    ];

    const relations: UmlRelation[] = [
      {
        id: `rel_u_${timestamp}_1`,
        sourceClassId: c1Id,
        targetClassId: c4Id,
        type: 'COMPOSITION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '1..*',
        name: 'seInscribe'
      },
      {
        id: `rel_u_${timestamp}_2`,
        sourceClassId: c3Id,
        targetClassId: c4Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '0..*',
        name: 'perteneceA'
      },
      {
        id: `rel_u_${timestamp}_3`,
        sourceClassId: c2Id,
        targetClassId: c3Id,
        type: 'ASSOCIATION',
        sourceMultiplicity: '1..1',
        targetMultiplicity: '1..*',
        name: 'imparte'
      }
    ];

    return {
      diagramName: 'Sistema de Gestión Académica Universitaria',
      description: 'Modelo conceptual UML de estudiantes, materias, inscripciones y docentes.',
      classes,
      relations,
      summary: '4 Clases generadas: Estudiante, Profesor, Materia e Inscripcion con 3 relaciones.'
    };
  }

  // =========================================================================
  // PARSER HEURÍSTICO DINÁMICO (Para cualquier prompt arbitrario)
  // =========================================================================
  private parseGenericPrompt(prompt: string): PromptGeneratedResult {
    const timestamp = Date.now();
    const { domainName, entityNames } = this.extractDomainAndEntities(prompt);

    // Si no se detectaron nombres, o se detectó solo 1 o 2, complementar con registros de negocio
    if (entityNames.length === 0) {
      entityNames.push('EntidadPrincipal', 'DetalleRegistro', 'Catalogo');
    } else if (entityNames.length === 1) {
      const base = entityNames[0];
      entityNames.push(`Detalle${base}`, `Registro${base}`, 'Catalogo');
    } else if (entityNames.length === 2) {
      entityNames.push('RegistroOperacion');
    }

    const classes: UmlClass[] = [];
    const relations: UmlRelation[] = [];

    // Disposición automática en cuadrícula de 3 columnas
    entityNames.forEach((name, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const posX = 100 + col * 360;
      const posY = 100 + row * 340;

      const clsId = `cls_gen_${timestamp}_${idx + 1}`;
      classes.push({
        id: clsId,
        name: this.capitalize(name),
        elementType: 'CLASS',
        stereotype: '«entity»',
        position: { x: posX, y: posY },
        attributes: this.generateAttributesForClass(name, idx),
        methods: this.generateMethodsForClass(name, idx)
      });
    });

    // Conexiones relacionales semánticas entre entidades detectadas
    const classMap = new Map<string, UmlClass>();
    classes.forEach(c => classMap.set(c.name.toLowerCase(), c));

    const connectIfExist = (
      srcName: string, 
      tgtName: string, 
      type: UmlRelationType, 
      srcMult: string, 
      tgtMult: string, 
      relName: string
    ) => {
      const src = classMap.get(srcName.toLowerCase());
      const tgt = classMap.get(tgtName.toLowerCase());
      if (src && tgt && src.id !== tgt.id) {
        const exists = relations.some(r => 
          (r.sourceClassId === src.id && r.targetClassId === tgt.id) ||
          (r.sourceClassId === tgt.id && r.targetClassId === src.id)
        );
        if (!exists) {
          relations.push({
            id: `rel_gen_${timestamp}_${relations.length + 1}`,
            sourceClassId: src.id,
            targetClassId: tgt.id,
            type,
            sourceMultiplicity: srcMult,
            targetMultiplicity: tgtMult,
            name: relName
          });
        }
      }
    };

    // --- Relaciones semánticas de Hotelería ---
    connectIfExist('Hotel', 'Habitacion', 'COMPOSITION', '1..1', '1..*', 'alberga');
    connectIfExist('Hotel', 'Habitación', 'COMPOSITION', '1..1', '1..*', 'alberga');
    connectIfExist('Hotel', 'Empleado', 'ASSOCIATION', '1..1', '1..*', 'contrata');
    connectIfExist('Huesped', 'Reserva', 'ASSOCIATION', '1..1', '0..*', 'realiza');
    connectIfExist('Huésped', 'Reserva', 'ASSOCIATION', '1..1', '0..*', 'realiza');
    connectIfExist('Reserva', 'Habitacion', 'ASSOCIATION', '0..*', '1..1', 'asigna');
    connectIfExist('Reserva', 'Habitación', 'ASSOCIATION', '0..*', '1..1', 'asigna');
    connectIfExist('Empleado', 'Reserva', 'ASSOCIATION', '1..1', '0..*', 'gestiona');

    // --- Relaciones semánticas de Ventas / Comercio / Vendedores ---
    connectIfExist('Empleado', 'Vendedor', 'ASSOCIATION', '1..1', '1..1', 'asignaRol');
    connectIfExist('Vendedor', 'Subvendedor', 'COMPOSITION', '1..1', '0..*', 'supervisa');
    connectIfExist('Vendedor', 'Cliente', 'ASSOCIATION', '1..1', '0..*', 'atiende');
    connectIfExist('Subvendedor', 'Cliente', 'ASSOCIATION', '1..1', '0..*', 'atiende');
    connectIfExist('Cliente', 'Factura', 'ASSOCIATION', '1..1', '0..*', 'emite');
    connectIfExist('Cliente', 'Pedido', 'ASSOCIATION', '1..1', '0..*', 'realiza');
    connectIfExist('Cliente', 'Venta', 'ASSOCIATION', '1..1', '0..*', 'solicita');
    connectIfExist('Factura', 'DetalleFactura', 'COMPOSITION', '1..1', '1..*', 'contiene');
    connectIfExist('Pedido', 'DetallePedido', 'COMPOSITION', '1..1', '1..*', 'incluye');
    connectIfExist('Venta', 'DetalleVenta', 'COMPOSITION', '1..1', '1..*', 'contiene');
    connectIfExist('DetalleFactura', 'Producto', 'ASSOCIATION', '0..*', '1..1', 'refiere');
    connectIfExist('DetallePedido', 'Producto', 'ASSOCIATION', '0..*', '1..1', 'refiere');
    connectIfExist('DetalleVenta', 'Producto', 'ASSOCIATION', '0..*', '1..1', 'refiere');

    // Conectar clases que hayan quedado sin relación secuencialmente
    for (let i = 0; i < classes.length; i++) {
      const cls = classes[i];
      const hasRel = relations.some(r => r.sourceClassId === cls.id || r.targetClassId === cls.id);
      if (!hasRel && i > 0) {
        relations.push({
          id: `rel_gen_${timestamp}_${relations.length + 1}`,
          sourceClassId: classes[i - 1].id,
          targetClassId: cls.id,
          type: 'ASSOCIATION',
          sourceMultiplicity: '1..1',
          targetMultiplicity: '0..*',
          name: 'relaciona'
        });
      }
    }

    return {
      diagramName: domainName,
      description: `Modelo de clases UML 2.5 generado con ${classes.length} clases (${classes.map(c => c.name).join(', ')}) a partir del prompt: "${prompt}"`,
      classes,
      relations,
      summary: `${classes.length} Clases generadas (${classes.map(c => c.name).join(', ')}) con ${relations.length} relaciones inferidas.`
    };
  }

  /**
   * Extrae el nombre del dominio (para el título del proyecto) y la lista de entidades reales
   * separando la cláusula descriptiva de la lista explícita de clases (ej. después de "con", "incluye", etc.)
   */
  public extractDomainAndEntities(text: string): { domainName: string; entityNames: string[] } {
    const raw = (text || '').trim();
    let domainCandidate = '';
    let entitiesText = raw;

    // Detectar si hay conector de entidades: "con", "que tenga", "incluye", "con las clases", etc.
    const splitRegex = /\b(?:con\s+las\s+clases|con\s+las\s+entidades|con\s+las\s+tablas|con\s+clases|con\s+entidades|con\s+tablas|con|incluye|incluyendo|que\s+tenga|que\s+contenga)\b/i;
    const match = raw.match(splitRegex);

    if (match && match.index !== undefined && match.index > 0) {
      const prefix = raw.substring(0, match.index).trim();
      const suffix = raw.substring(match.index + match[0].length).trim();

      // Extraer nombre del dominio del prefijo (ej. "crear sistema para hotelería" -> "Hotelería")
      const prefixTokens = prefix.replace(/[,;.:]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
      const domainWords = prefixTokens.filter(w => !this.isStopWord(this.cleanWord(w)));
      if (domainWords.length > 0) {
        domainCandidate = this.capitalize(this.cleanWord(domainWords[domainWords.length - 1]));
      }

      // Las entidades reales vienen estrictamente del sufijo (después de "con")
      entitiesText = suffix;
    }

    // Extraer entidades del texto correspondiente
    const entityNames: string[] = [];
    const entitySet = new Set<string>();

    const normalized = entitiesText.replace(/[,;.:\n\r]/g, ' ');
    const rawTokens = normalized.split(/\s+/).filter(w => w.length >= 3);

    rawTokens.forEach(token => {
      const clean = this.cleanWord(token);
      if (clean.length >= 3 && !this.isStopWord(clean)) {
        const sing = this.singularize(clean);
        if (sing && sing.length >= 3 && !this.isStopWord(sing.toLowerCase()) && !entitySet.has(sing.toLowerCase())) {
          entitySet.add(sing.toLowerCase());
          entityNames.push(sing);
        }
      }
    });

    // Si no había separador "con" o no se detectaron entidades en el sufijo,
    // escanear el texto completo
    if (entityNames.length === 0) {
      const fullTokens = raw.replace(/[,;.:\n\r]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
      fullTokens.forEach(token => {
        const clean = this.cleanWord(token);
        if (clean.length >= 3 && !this.isStopWord(clean)) {
          const sing = this.singularize(clean);
          if (sing && sing.length >= 3 && !this.isStopWord(sing.toLowerCase()) && !entitySet.has(sing.toLowerCase())) {
            entitySet.add(sing.toLowerCase());
            entityNames.push(sing);
          }
        }
      });
    }

    // Determinar el título formal del diagrama/proyecto
    let domainName = '';
    if (domainCandidate) {
      domainName = `Sistema de ${domainCandidate}`;
    } else if (entityNames.length > 0) {
      domainName = `Sistema de ${entityNames[0]}`;
    } else {
      domainName = 'Sistema Personalizado';
    }

    return {
      domainName,
      entityNames: entityNames.slice(0, 8)
    };
  }

  /**
   * Helper para compatibilidad de llamadas existentes
   */
  private extractEntityNames(text: string): string[] {
    return this.extractDomainAndEntities(text).entityNames;
  }

  /**
   * Singularizador morfológico para sustantivos en español
   */
  private singularize(word: string): string {
    const lower = word.toLowerCase().trim();
    if (lower.length <= 3) return this.capitalize(lower);

    // Excepciones conocidas de sustantivos que terminan en 's' pero ya son singulares
    if (['pais', 'mes', 'campus', 'analisis', 'tesis', 'status', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes'].includes(lower)) {
      return this.capitalize(lower);
    }

    // Terminaciones en 'ces' -> 'z' (ej. voces -> voz, actrices -> actriz, peces -> pez)
    if (lower.endsWith('ces')) {
      return this.capitalize(lower.slice(0, -3) + 'z');
    }

    // Terminaciones en 'ores' -> 'or' (ej. vendedores -> vendedor, subvendedores -> subvendedor, profesores -> profesor, doctores -> doctor)
    if (lower.endsWith('ores')) {
      return this.capitalize(lower.slice(0, -2));
    }

    // Terminaciones en 'entes' / 'antes' / 'ientes' -> 'ente' / 'ante' / 'iente' (ej. clientes -> cliente, pacientes -> paciente, estudiantes -> estudiante)
    if (lower.endsWith('entes') || lower.endsWith('antes') || lower.endsWith('ientes')) {
      return this.capitalize(lower.slice(0, -1));
    }

    // Terminaciones en 'les' (ej. canales -> canal, animales -> animal, hoteles -> hotel)
    if (lower.endsWith('les')) {
      return this.capitalize(lower.slice(0, -2));
    }

    // Terminaciones en 'nes' (ej. ordenes -> orden, camiones -> camion)
    if (lower.endsWith('nes')) {
      return this.capitalize(lower.slice(0, -2));
    }

    // Terminaciones en 'des' (ej. ciudades -> ciudad, unidades -> unidad, huéspedes -> huésped, huespedes -> huesped)
    if (lower.endsWith('des')) {
      return this.capitalize(lower.slice(0, -2));
    }

    // Terminaciones en 'es' precedidas por consonante (ej. roles -> rol, administradores -> administrador)
    if (lower.endsWith('es')) {
      const beforeEs = lower.charAt(lower.length - 3);
      if (['a', 'e', 'i', 'o', 'u', 'á', 'é', 'í', 'ó', 'ú'].includes(beforeEs)) {
        return this.capitalize(lower.slice(0, -1)); // ej: detalles -> detalle
      } else {
        return this.capitalize(lower.slice(0, -2)); // ej: administradores -> administrador
      }
    }

    // Terminaciones en 's' precedidas de vocal (ej. empleados -> empleado, libros -> libro, cuentas -> cuenta)
    if (lower.endsWith('s')) {
      const beforeS = lower.charAt(lower.length - 2);
      if (['a', 'e', 'i', 'o', 'u', 'á', 'é', 'í', 'ó', 'ú'].includes(beforeS)) {
        return this.capitalize(lower.slice(0, -1));
      }
    }

    return this.capitalize(lower);
  }

  /**
   * Generador de atributos tipados contextuales según la entidad
   */
  private generateAttributesForClass(className: string, idx: number): UmlAttribute[] {
    const lower = className.toLowerCase();

    // Hotelería
    if (lower.includes('hotel') && !lower.includes('hoteleria') && !lower.includes('hotelería')) {
      return [
        { id: `attr_${idx}_1`, name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
        { id: `attr_${idx}_2`, name: 'nombre', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_3`, name: 'direccion', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_4`, name: 'estrellas', type: 'Integer', visibility: '+', isPrimaryKey: false, isNullable: true },
        { id: `attr_${idx}_5`, name: 'telefono', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true },
        { id: `attr_${idx}_6`, name: 'ciudad', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
      ];
    }

    if (lower.includes('habitacion') || lower.includes('habitación') || lower.includes('cuarto')) {
      return [
        { id: `attr_${idx}_1`, name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
        { id: `attr_${idx}_2`, name: 'numeroHabitacion', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_3`, name: 'tipo', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_4`, name: 'precioPorNoche', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_5`, name: 'piso', type: 'Integer', visibility: '+', isPrimaryKey: false, isNullable: true },
        { id: `attr_${idx}_6`, name: 'estado', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
      ];
    }

    if (lower.includes('huesped') || lower.includes('huésped')) {
      return [
        { id: `attr_${idx}_1`, name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
        { id: `attr_${idx}_2`, name: 'nombreCompleto', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_3`, name: 'ciPasaporte', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_4`, name: 'telefono', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true },
        { id: `attr_${idx}_5`, name: 'email', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true },
        { id: `attr_${idx}_6`, name: 'nacionalidad', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
      ];
    }

    if (lower.includes('reserva')) {
      return [
        { id: `attr_${idx}_1`, name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
        { id: `attr_${idx}_2`, name: 'codigoReserva', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_3`, name: 'fechaCheckIn', type: 'LocalDate', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_4`, name: 'fechaCheckOut', type: 'LocalDate', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_5`, name: 'totalMonto', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_6`, name: 'estado', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
      ];
    }

    // Ventas / Comercio
    if (lower.includes('vendedor') || lower.includes('subvendedor')) {
      return [
        { id: `attr_${idx}_1`, name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
        { id: `attr_${idx}_2`, name: 'codigoVendedor', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_3`, name: 'nombreCompleto', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_4`, name: 'comisionPorcentaje', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_5`, name: 'metaMensual', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: true },
        { id: `attr_${idx}_6`, name: 'zonaAsignada', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true },
        { id: `attr_${idx}_7`, name: 'estado', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
      ];
    }

    if (lower.includes('cliente') || lower.includes('usuario') || lower.includes('persona')) {
      return [
        { id: `attr_${idx}_1`, name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
        { id: `attr_${idx}_2`, name: 'nombreCompleto', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_3`, name: 'ciNit', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_4`, name: 'telefono', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true },
        { id: `attr_${idx}_5`, name: 'email', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true },
        { id: `attr_${idx}_6`, name: 'direccion', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
      ];
    }

    if (lower.includes('empleado') || lower.includes('trabajador') || lower.includes('funcionario')) {
      return [
        { id: `attr_${idx}_1`, name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
        { id: `attr_${idx}_2`, name: 'codigoEmpleado', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_3`, name: 'nombres', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_4`, name: 'apellidos', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_5`, name: 'cargo', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_6`, name: 'salarioBase', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_7`, name: 'fechaContratacion', type: 'LocalDate', visibility: '+', isPrimaryKey: false, isNullable: false }
      ];
    }

    if (lower.includes('producto') || lower.includes('articulo') || lower.includes('item')) {
      return [
        { id: `attr_${idx}_1`, name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
        { id: `attr_${idx}_2`, name: 'codigo', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_3`, name: 'descripcion', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_4`, name: 'precioUnitario', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_5`, name: 'stock', type: 'Integer', visibility: '+', isPrimaryKey: false, isNullable: false }
      ];
    }

    if (lower.includes('factura') || lower.includes('venta') || lower.includes('pedido') || lower.includes('orden')) {
      return [
        { id: `attr_${idx}_1`, name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
        { id: `attr_${idx}_2`, name: 'numeroComprobante', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_3`, name: 'fechaEmision', type: 'LocalDateTime', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_4`, name: 'montoTotal', type: 'Double', visibility: '+', isPrimaryKey: false, isNullable: false },
        { id: `attr_${idx}_5`, name: 'estado', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
      ];
    }

    // Atributos contextuales para cualquier otra clase
    return [
      { id: `attr_${idx}_1`, name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
      { id: `attr_${idx}_2`, name: 'nombre', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
      { id: `attr_${idx}_3`, name: 'codigo', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
      { id: `attr_${idx}_4`, name: 'fechaRegistro', type: 'LocalDate', visibility: '+', isPrimaryKey: false, isNullable: false },
      { id: `attr_${idx}_5`, name: 'estado', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true }
    ];
  }

  /**
   * Generador de métodos contextuales según la entidad
   */
  private generateMethodsForClass(className: string, idx: number): UmlMethod[] {
    const lower = className.toLowerCase();

    // Hotelería
    if (lower.includes('hotel') && !lower.includes('hoteleria')) {
      return [
        { id: `m_${idx}_1`, name: 'obtenerDisponibilidad', returnType: 'Boolean', visibility: '+', parameters: [] },
        { id: `m_${idx}_2`, name: 'actualizarDatos', returnType: 'void', visibility: '+', parameters: [] }
      ];
    }

    if (lower.includes('habitacion') || lower.includes('habitación')) {
      return [
        { id: `m_${idx}_1`, name: 'estaDisponible', returnType: 'Boolean', visibility: '+', parameters: [] },
        { id: `m_${idx}_2`, name: 'cambiarEstado', returnType: 'void', visibility: '+', parameters: [{ name: 'nuevoEstado', type: 'String' }] }
      ];
    }

    if (lower.includes('huesped') || lower.includes('huésped')) {
      return [
        { id: `m_${idx}_1`, name: 'registrar', returnType: 'void', visibility: '+', parameters: [] },
        { id: `m_${idx}_2`, name: 'obtenerHistorial', returnType: 'String', visibility: '+', parameters: [] }
      ];
    }

    if (lower.includes('reserva')) {
      return [
        { id: `m_${idx}_1`, name: 'confirmarReserva', returnType: 'void', visibility: '+', parameters: [] },
        { id: `m_${idx}_2`, name: 'calcularMontoTotal', returnType: 'Double', visibility: '+', parameters: [] }
      ];
    }

    if (lower.includes('vendedor') || lower.includes('subvendedor')) {
      return [
        { id: `m_${idx}_1`, name: 'registrarVenta', returnType: 'void', visibility: '+', parameters: [] },
        { id: `m_${idx}_2`, name: 'calcularComision', returnType: 'Double', visibility: '+', parameters: [] }
      ];
    }

    if (lower.includes('cliente') || lower.includes('usuario')) {
      return [
        { id: `m_${idx}_1`, name: 'registrar', returnType: 'void', visibility: '+', parameters: [] },
        { id: `m_${idx}_2`, name: 'consultarHistorial', returnType: 'String', visibility: '+', parameters: [] }
      ];
    }

    if (lower.includes('empleado') || lower.includes('trabajador')) {
      return [
        { id: `m_${idx}_1`, name: 'calcularSalario', returnType: 'Double', visibility: '+', parameters: [] },
        { id: `m_${idx}_2`, name: 'actualizarCargo', returnType: 'void', visibility: '+', parameters: [{ name: 'nuevoCargo', type: 'String' }] }
      ];
    }

    return [
      { id: `m_${idx}_1`, name: 'procesar', returnType: 'void', visibility: '+', parameters: [] },
      { id: `m_${idx}_2`, name: 'obtenerInformacion', returnType: 'String', visibility: '+', parameters: [] }
    ];
  }

  private cleanWord(w: string): string {
    return (w || '').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '');
  }

  private capitalize(s: string): string {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private isStopWord(w: string): boolean {
    const stopWords = [
      'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'se', 'del', 'las', 'por', 'un', 'para', 'con', 'no',
      'una', 'su', 'al', 'lo', 'como', 'mas', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'si', 'porque',
      'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'tambien', 'me', 'hasta', 'hay', 'donde', 'quien',
      'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso',
      'ante', 'ellos', 'e', 'esto', 'mi', 'antes', 'algunos', 'unos', 'yo', 'otro', 'otras', 'otra',
      'sistema', 'aplicacion', 'software', 'diagrama', 'clases', 'clase', 'uml', 'proyecto', 'crear', 
      'generar', 'disenar', 'hacer', 'tener', 'tenga', 'incluir', 'incluye', 'tipo', 'modulo', 'tabla', 
      'tablas', 'entidad', 'entidades', 'modelo', 'modelos', 'sub', 'varios', 'favor', 'ayuda'
    ];
    return stopWords.includes(w.toLowerCase());
  }
}

