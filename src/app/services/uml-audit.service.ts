import { Injectable } from '@angular/core';
import { UmlAttribute, UmlClass, UmlDiagram, UmlMethod, UmlRelation } from '../models/uml.models';

export interface AuditRecommendation {
  id: string;
  category: '1NF' | '2NF' | '3NF' | 'RELATION' | 'TYPE' | 'OPTIMIZATION';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  targetClassId?: string;
  targetClassName?: string;
  suggestedAction: 'ADD_PK' | 'CREATE_JUNCTION_TABLE' | 'FIX_TYPE' | 'SPLIT_ATTRIBUTE' | 'CONNECT_ISOLATED' | 'ADD_COHESIVE_ATTRIBUTE' | 'ADD_DOMAIN_TABLE' | 'ADD_METHODS';
  payload?: any;
}

export interface AuditReport {
  timestamp: string;
  score: number; // 0 a 100
  recommendations: AuditRecommendation[];
  stats: {
    totalClasses: number;
    totalRelations: number;
    classesMissingPk: number;
    directManyToManys: number;
    isolatedClasses: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class UmlAuditService {

  /**
   * Analiza exhaustivamente el diagrama UML evaluando reglas de normalización (1NF, 2NF, 3NF), integridad y arquitectura de dominio.
   */
  auditDiagram(diagram: UmlDiagram): AuditReport {
    const recommendations: AuditRecommendation[] = [];
    const classes = diagram.classes || [];
    const relations = diagram.relations || [];

    let classesMissingPk = 0;
    let directManyToManys = 0;
    let isolatedClasses = 0;

    // 1. Evaluación de Claves Primarias (2NF / Integridad de Entidades)
    classes.forEach((c) => {
      const hasPk = c.attributes.some(a => a.isPrimaryKey || a.name.toLowerCase() === 'id' || a.name.toLowerCase().endsWith('_id'));
      if (!hasPk) {
        classesMissingPk++;
        recommendations.push({
          id: `rec_pk_${c.id}`,
          category: '2NF',
          severity: 'CRITICAL',
          title: `Falta Clave Primaria en entidad '${c.name}'`,
          description: `La clase '${c.name}' no define ningún atributo identificador (PK). Se agregará 'id: Long [PK]'.`,
          targetClassId: c.id,
          targetClassName: c.name,
          suggestedAction: 'ADD_PK'
        });
      }
    });

    // 2. Evaluación de Relaciones Muchos a Muchos (N:M -> Necesitan Tabla Intermedia)
    relations.forEach((r) => {
      if (r.type === 'MANY_TO_MANY') {
        directManyToManys++;
        const src = classes.find(c => c.id === r.sourceClassId);
        const tgt = classes.find(c => c.id === r.targetClassId);
        if (src && tgt) {
          recommendations.push({
            id: `rec_nm_${r.id}`,
            category: 'RELATION',
            severity: 'WARNING',
            title: `Relación N:M entre '${src.name}' y '${tgt.name}'`,
            description: `Se creará la Tabla Intermedia de Unión '${src.name}${tgt.name}' con sus claves foráneas.`,
            targetClassId: src.id,
            targetClassName: `${src.name} <-> ${tgt.name}`,
            suggestedAction: 'CREATE_JUNCTION_TABLE',
            payload: { relation: r, sourceClass: src, targetClass: tgt }
          });
        }
      }
    });

    // 3. Detección de Tablas Aisladas (Sin conexiones)
    classes.forEach((c) => {
      const isConnected = relations.some(r => r.sourceClassId === c.id || r.targetClassId === c.id);
      if (!isConnected && classes.length > 1) {
        isolatedClasses++;
        recommendations.push({
          id: `rec_iso_${c.id}`,
          category: 'OPTIMIZATION',
          severity: 'INFO',
          title: `Entidad '${c.name}' aislada sin relaciones`,
          description: `Se conectará '${c.name}' con el resto del modelo mediante relación de Clave Foránea.`,
          targetClassId: c.id,
          targetClassName: c.name,
          suggestedAction: 'CONNECT_ISOLATED'
        });
      }
    });

    // 4. Detección de Conexiones Faltantes entre Pares de Dominio
    const findClass = (kw: string) => classes.find(c => c.name.toLowerCase().includes(kw));

    // Reglas Académicas (Estudiante, Profesor, Materia, Asignacion, Asistencia, Nota, Curso)
    const est = findClass('estudiante');
    const prof = findClass('profesor');
    const mat = findClass('materia');
    const asig = findClass('asignacion') || findClass('asistencia');
    const nota = findClass('nota');
    const curso = findClass('curso');

    // Estudiante <-> Asignacion / Asistencia / Nota
    if (est && asig) {
      const isRel = relations.some(r => (r.sourceClassId === est.id && r.targetClassId === asig.id) || (r.sourceClassId === asig.id && r.targetClassId === est.id));
      if (!isRel) {
        recommendations.push({
          id: `rec_link_est_asig`,
          category: 'RELATION',
          severity: 'WARNING',
          title: `Vincular '${est.name}' con '${asig.name}'`,
          description: `Establece la relación 1..* para asociar cada '${est.name}' con sus registros de '${asig.name}'.`,
          targetClassId: est.id,
          targetClassName: `${est.name} -> ${asig.name}`,
          suggestedAction: 'CONNECT_ISOLATED',
          payload: { sourceId: est.id, targetId: asig.id, relName: 'registra_asistencia' }
        });
      }
    }

    // Estudiante <-> Nota
    if (est && nota) {
      const isRel = relations.some(r => (r.sourceClassId === est.id && r.targetClassId === nota.id) || (r.sourceClassId === nota.id && r.targetClassId === est.id));
      if (!isRel) {
        recommendations.push({
          id: `rec_link_est_nota`,
          category: 'RELATION',
          severity: 'WARNING',
          title: `Vincular '${est.name}' con '${nota.name}'`,
          description: `Establece la relación 1..* para asignar calificaciones del estudiante.`,
          targetClassId: est.id,
          targetClassName: `${est.name} -> ${nota.name}`,
          suggestedAction: 'CONNECT_ISOLATED',
          payload: { sourceId: est.id, targetId: nota.id, relName: 'tiene_notas' }
        });
      }
    }

    // Profesor <-> Materia / Asignacion
    if (prof && mat) {
      const isRel = relations.some(r => (r.sourceClassId === prof.id && r.targetClassId === mat.id) || (r.sourceClassId === mat.id && r.targetClassId === prof.id));
      if (!isRel) {
        recommendations.push({
          id: `rec_link_prof_mat`,
          category: 'RELATION',
          severity: 'WARNING',
          title: `Vincular '${prof.name}' con '${mat.name}'`,
          description: `Relaciona al '${prof.name}' con las materias que dicta (1..*).`,
          targetClassId: prof.id,
          targetClassName: `${prof.name} -> ${mat.name}`,
          suggestedAction: 'CONNECT_ISOLATED',
          payload: { sourceId: prof.id, targetId: mat.id, relName: 'dicta_materia' }
        });
      }
    }

    // Materia <-> Nota
    if (mat && nota) {
      const isRel = relations.some(r => (r.sourceClassId === mat.id && r.targetClassId === nota.id) || (r.sourceClassId === nota.id && r.targetClassId === mat.id));
      if (!isRel) {
        recommendations.push({
          id: `rec_link_mat_nota`,
          category: 'RELATION',
          severity: 'WARNING',
          title: `Vincular '${mat.name}' con '${nota.name}'`,
          description: `Asocia cada nota evaluada con su correspondiente '${mat.name}'.`,
          targetClassId: mat.id,
          targetClassName: `${mat.name} -> ${nota.name}`,
          suggestedAction: 'CONNECT_ISOLATED',
          payload: { sourceId: mat.id, targetId: nota.id, relName: 'evalua_materia' }
        });
      }
    }

    // Regla de Dominio Comercial
    const hasProducto = classes.find(c => c.name.toLowerCase().includes('producto'));
    const hasDetalle = classes.find(c => c.name.toLowerCase().includes('detalle'));
    if (hasProducto && hasDetalle) {
      const isRel = relations.some(r => (r.sourceClassId === hasProducto.id && r.targetClassId === hasDetalle.id) || (r.sourceClassId === hasDetalle.id && r.targetClassId === hasProducto.id));
      if (!isRel) {
        recommendations.push({
          id: `rec_link_prod_det`,
          category: 'RELATION',
          severity: 'WARNING',
          title: `Establecer Conexión 1..* entre '${hasProducto.name}' y '${hasDetalle.name}'`,
          description: `Conecta '${hasProducto.name}' (1) con '${hasDetalle.name}' (1..*) mediante relación 'contiene_producto'.`,
          targetClassId: hasProducto.id,
          targetClassName: `${hasProducto.name} -> ${hasDetalle.name}`,
          suggestedAction: 'CONNECT_ISOLATED',
          payload: { sourceId: hasProducto.id, targetId: hasDetalle.id, relName: 'contiene_producto' }
        });
      }
    }

    const hasCompra = classes.find(c => c.name.toLowerCase().includes('compra'));
    const hasProveedor = classes.find(c => c.name.toLowerCase().includes('proveedor'));
    if (hasCompra && hasProveedor) {
      const isRel = relations.some(r => (r.sourceClassId === hasProveedor.id && r.targetClassId === hasCompra.id) || (r.sourceClassId === hasCompra.id && r.targetClassId === hasProveedor.id));
      if (!isRel) {
        recommendations.push({
          id: `rec_link_prov_comp`,
          category: 'RELATION',
          severity: 'WARNING',
          title: `Establecer Conexión 1..* entre '${hasProveedor.name}' y '${hasCompra.name}'`,
          description: `Conecta '${hasProveedor.name}' (1) con '${hasCompra.name}' (1..*) mediante relación 'provee_compras'.`,
          targetClassId: hasProveedor.id,
          targetClassName: `${hasProveedor.name} -> ${hasCompra.name}`,
          suggestedAction: 'CONNECT_ISOLATED',
          payload: { sourceId: hasProveedor.id, targetId: hasCompra.id, relName: 'provee_compras' }
        });
      }
    }

    // 5. Verificación de Métodos y Operaciones en Clases sin métodos
    classes.forEach((c) => {
      if (!c.methods || c.methods.length === 0) {
        recommendations.push({
          id: `rec_method_${c.id}`,
          category: 'OPTIMIZATION',
          severity: 'INFO',
          title: `Faltan Métodos/Operaciones en entidad '${c.name}'`,
          description: `Se recomienda agregar métodos de negocio ('procesar(): void', 'obtenerInformacion(): String') a '${c.name}'.`,
          targetClassId: c.id,
          targetClassName: c.name,
          suggestedAction: 'ADD_METHODS',
          payload: { classId: c.id }
        });
      }
    });

    // 6. Verificación de Tipos de Datos y Nombres (1NF)
    classes.forEach((c) => {
      c.attributes.forEach((attr) => {
        if (!attr.type || attr.type === 'Object' || attr.type === 'Any') {
          recommendations.push({
            id: `rec_type_${c.id}_${attr.id}`,
            category: 'TYPE',
            severity: 'INFO',
            title: `Tipo genérico en '${c.name}.${attr.name}'`,
            description: `Se tipará '${attr.name}' como 'String'.`,
            targetClassId: c.id,
            targetClassName: c.name,
            suggestedAction: 'FIX_TYPE',
            payload: { attributeId: attr.id, attrName: attr.name }
          });
        }
      });
    });

    // 7. Recomendaciones de Tablas de Arquitectura según Dominio
    const classNamesLower = classes.map(c => c.name.toLowerCase());
    const isAcademicDomain = classNamesLower.some(n => n.includes('estudiante') || n.includes('profesor') || n.includes('materia'));
    const isHealthDomain = classNamesLower.some(n => n.includes('paciente') || n.includes('medico') || n.includes('historiaclinica'));
    const isSalesDomain = classNamesLower.some(n => n.includes('factura') || n.includes('cliente') || n.includes('venta'));

    if (isAcademicDomain && !classNamesLower.some(n => n.includes('curso'))) {
      recommendations.push({
        id: `rec_domain_curso`,
        category: 'OPTIMIZATION',
        severity: 'INFO',
        title: `Incorporar Tabla de Dominio 'Curso'`,
        description: `Se recomienda agregar la entidad 'Curso' (con sigla, cupos, gestion y métodos) para organizar las materias por período lectivo.`,
        suggestedAction: 'ADD_DOMAIN_TABLE',
        payload: {
          tableName: 'Curso',
          stereotype: '<<entity>>',
          attributes: [
            { id: 'cur_a1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
            { id: 'cur_a2', name: 'sigla', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false },
            { id: 'cur_a3', name: 'cuposMaximos', type: 'Integer', visibility: '+', isPrimaryKey: false, isNullable: false },
            { id: 'cur_a4', name: 'gestion', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
          ],
          methods: [
            { id: 'cur_m1', name: 'verificarCupoAvailable', returnType: 'Boolean', visibility: '+' },
            { id: 'cur_m2', name: 'inscritosTotal', returnType: 'Integer', visibility: '+' }
          ],
          connectToNames: ['Materia', 'Profesor']
        }
      });
    }

    if (isHealthDomain && !classNamesLower.some(n => n.includes('cita'))) {
      recommendations.push({
        id: `rec_domain_cita`,
        category: 'OPTIMIZATION',
        severity: 'INFO',
        title: `Incorporar Tabla de Dominio 'CitaMedica'`,
        description: `Se recomienda agregar la entidad 'CitaMedica' (con atributos y métodos) conectada a Paciente y Medico.`,
        suggestedAction: 'ADD_DOMAIN_TABLE',
        payload: {
          tableName: 'CitaMedica',
          stereotype: '<<entity>>',
          attributes: [
            { id: 'c_a1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
            { id: 'c_a2', name: 'fechaHora', type: 'LocalDateTime', visibility: '+', isPrimaryKey: false, isNullable: false },
            { id: 'c_a3', name: 'motivoConsulta', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: true },
            { id: 'c_a4', name: 'estadoCita', type: 'String', visibility: '+', isPrimaryKey: false, isNullable: false }
          ],
          methods: [
            { id: 'c_m1', name: 'programarCita', returnType: 'Boolean', visibility: '+' },
            { id: 'c_m2', name: 'cancelarCita', returnType: 'void', visibility: '+' }
          ],
          connectToNames: ['Paciente', 'Medico']
        }
      });
    }

    if (isSalesDomain && !classNamesLower.some(n => n.includes('detalle'))) {
      recommendations.push({
        id: `rec_domain_detalle`,
        category: 'OPTIMIZATION',
        severity: 'INFO',
        title: `Incorporar Tabla de Dominio 'DetalleFactura'`,
        description: `Se recomienda agregar la entidad 'DetalleFactura' (con cantidad, precioUnitario, subtotal y métodos) para desglose.`,
        suggestedAction: 'ADD_DOMAIN_TABLE',
        payload: {
          tableName: 'DetalleFactura',
          stereotype: '<<entity>>',
          attributes: [
            { id: 'd_a1', name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
            { id: 'd_a2', name: 'cantidad', type: 'Integer', visibility: '+', isPrimaryKey: false, isNullable: false },
            { id: 'd_a3', name: 'precioUnitario', type: 'BigDecimal', visibility: '+', isPrimaryKey: false, isNullable: false },
            { id: 'd_a4', name: 'subtotal', type: 'BigDecimal', visibility: '+', isPrimaryKey: false, isNullable: false }
          ],
          methods: [
            { id: 'd_m1', name: 'calcularSubtotal', returnType: 'BigDecimal', visibility: '+' }
          ],
          connectToNames: ['Factura']
        }
      });
    }

    // 8. Verificación de Cohesión de Atributos
    classes.forEach((c) => {
      const lowerName = c.name.toLowerCase();
      const attrNames = c.attributes.map(a => a.name.toLowerCase());

      if ((lowerName.includes('paciente') || lowerName.includes('cliente') || lowerName.includes('usuario')) && !attrNames.includes('email') && !attrNames.includes('correo')) {
        recommendations.push({
          id: `rec_coh_email_${c.id}`,
          category: 'OPTIMIZATION',
          severity: 'INFO',
          title: `Atributo 'email' en '${c.name}'`,
          description: `Agregar el atributo de contacto 'email: String' a la entidad '${c.name}'.`,
          targetClassId: c.id,
          targetClassName: c.name,
          suggestedAction: 'ADD_COHESIVE_ATTRIBUTE',
          payload: { attrName: 'email', attrType: 'String', classId: c.id }
        });
      }
    });

    // Calcular puntaje de salud del modelo (0 a 100)
    let score = 100;
    score -= classesMissingPk * 20;
    score -= directManyToManys * 15;
    score -= isolatedClasses * 10;
    score -= recommendations.length * 8;
    score = Math.max(0, Math.min(100, score));

    return {
      timestamp: new Date().toISOString(),
      score,
      recommendations,
      stats: {
        totalClasses: classes.length,
        totalRelations: relations.length,
        classesMissingPk,
        directManyToManys,
        isolatedClasses
      }
    };
  }

  /**
   * Aplica un conjunto seleccionado de recomendaciones en un solo paso.
   */
  applyFixes(diagram: UmlDiagram, selectedRecIds: Set<string>): UmlDiagram {
    const report = this.auditDiagram(diagram);
    let currentDiagram: UmlDiagram = JSON.parse(JSON.stringify(diagram));

    report.recommendations.forEach((rec) => {
      if (selectedRecIds.has(rec.id)) {
        currentDiagram = this.applyFix(currentDiagram, rec);
      }
    });

    return currentDiagram;
  }

  /**
   * Aplica una recomendación específica sobre el diagrama.
   */
  applyFix(diagram: UmlDiagram, recommendation: AuditRecommendation): UmlDiagram {
    const updatedDiagram: UmlDiagram = JSON.parse(JSON.stringify(diagram));
    const classes = updatedDiagram.classes;
    const relations = updatedDiagram.relations;

    if (recommendation.suggestedAction === 'ADD_PK' && recommendation.targetClassId) {
      const cls = classes.find(c => c.id === recommendation.targetClassId);
      if (cls) {
        const existingIdAttr = cls.attributes.find(a => a.name.toLowerCase() === 'id');
        if (existingIdAttr) {
          existingIdAttr.isPrimaryKey = true;
          existingIdAttr.type = 'Long';
        } else {
          cls.attributes.unshift({
            id: `pk_${cls.id}_${Date.now()}`,
            name: 'id',
            type: 'Long',
            visibility: '+',
            isPrimaryKey: true,
            isNullable: false
          });
        }
      }
    }

    if (recommendation.suggestedAction === 'CREATE_JUNCTION_TABLE' && recommendation.payload) {
      const { relation, sourceClass, targetClass } = recommendation.payload;
      const junctionName = `${sourceClass.name}${targetClass.name}`;
      const junctionId = `cls_junc_${Date.now()}`;

      const srcPos = sourceClass.position || { x: 100, y: 100 };
      const tgtPos = targetClass.position || { x: 400, y: 100 };
      const junctionPos = {
        x: Math.round((srcPos.x + tgtPos.x) / 2),
        y: Math.round((srcPos.y + tgtPos.y) / 2) + 140
      };

      const junctionClass: UmlClass = {
        id: junctionId,
        name: junctionName,
        elementType: 'CLASS',
        stereotype: '<<junction>>',
        attributes: [
          { id: `j_pk_${junctionId}`, name: 'id', type: 'Long', visibility: '+', isPrimaryKey: true, isNullable: false },
          { id: `j_fk1_${junctionId}`, name: `${sourceClass.name.toLowerCase()}_id`, type: 'Long', visibility: '+', isPrimaryKey: false, isNullable: false },
          { id: `j_fk2_${junctionId}`, name: `${targetClass.name.toLowerCase()}_id`, type: 'Long', visibility: '+', isPrimaryKey: false, isNullable: false }
        ],
        methods: [
          { id: `j_m1_${junctionId}`, name: 'procesarRelacion', returnType: 'void', visibility: '+' }
        ],
        position: junctionPos,
        width: 240,
        height: 160
      };

      classes.push(junctionClass);

      const relIdx = relations.findIndex(r => r.id === relation.id);
      if (relIdx !== -1) relations.splice(relIdx, 1);

      relations.push({
        id: `rel_j1_${junctionId}`,
        sourceClassId: sourceClass.id,
        targetClassId: junctionId,
        type: 'ONE_TO_MANY',
        name: 'contiene',
        sourceMultiplicity: '1',
        targetMultiplicity: '*'
      });

      relations.push({
        id: `rel_j2_${junctionId}`,
        sourceClassId: targetClass.id,
        targetClassId: junctionId,
        type: 'ONE_TO_MANY',
        name: 'posee',
        sourceMultiplicity: '1',
        targetMultiplicity: '*'
      });
    }

    if (recommendation.suggestedAction === 'CONNECT_ISOLATED') {
      if (recommendation.payload && recommendation.payload.sourceId && recommendation.payload.targetId) {
        const { sourceId, targetId, relName } = recommendation.payload;
        relations.push({
          id: `rel_link_${Date.now()}`,
          sourceClassId: sourceId,
          targetClassId: targetId,
          type: 'ONE_TO_MANY',
          name: relName || 'relaciona',
          sourceMultiplicity: '1',
          targetMultiplicity: '1..*'
        });
      } else if (recommendation.targetClassId) {
        const cls = classes.find(c => c.id === recommendation.targetClassId);
        if (cls) {
          const targetOther = classes.find(c => c.id !== cls.id);
          if (targetOther) {
            relations.push({
              id: `rel_iso_${cls.id}_${Date.now()}`,
              sourceClassId: targetOther.id,
              targetClassId: cls.id,
              type: 'ONE_TO_MANY',
              name: 'asociado',
              sourceMultiplicity: '1',
              targetMultiplicity: '1..*'
            });
          }
        }
      }
    }

    if (recommendation.suggestedAction === 'ADD_METHODS' && recommendation.payload) {
      const { classId } = recommendation.payload;
      const cls = classes.find(c => c.id === classId);
      if (cls) {
        if (!cls.methods) cls.methods = [];
        if (cls.methods.length === 0) {
          cls.methods.push({ id: `m1_${cls.id}`, name: 'procesar', returnType: 'void', visibility: '+' });
          cls.methods.push({ id: `m2_${cls.id}`, name: 'obtenerInformacion', returnType: 'String', visibility: '+' });
        }
      }
    }

    if (recommendation.suggestedAction === 'ADD_COHESIVE_ATTRIBUTE' && recommendation.payload) {
      const { classId, attrName, attrType } = recommendation.payload;
      const cls = classes.find(c => c.id === classId);
      if (cls) {
        cls.attributes.push({
          id: `coh_attr_${Date.now()}`,
          name: attrName,
          type: attrType,
          visibility: '+',
          isPrimaryKey: false,
          isNullable: true
        });
      }
    }

    if (recommendation.suggestedAction === 'ADD_DOMAIN_TABLE' && recommendation.payload) {
      const { tableName, stereotype, attributes, methods, connectToNames } = recommendation.payload;
      const newId = `cls_dom_${Date.now()}`;
      
      let maxX = 80;
      classes.forEach(c => { if (c.position.x > maxX) maxX = c.position.x; });

      const newClass: UmlClass = {
        id: newId,
        name: tableName,
        elementType: 'CLASS',
        stereotype: stereotype || '<<entity>>',
        attributes: attributes || [],
        methods: methods || [
          { id: `m_dom1_${newId}`, name: 'procesarRegistro', returnType: 'void', visibility: '+' },
          { id: `m_dom2_${newId}`, name: 'obtenerDetalles', returnType: 'String', visibility: '+' }
        ],
        position: { x: maxX + 320, y: 120 },
        width: 240,
        height: 180
      };

      classes.push(newClass);

      if (connectToNames && Array.isArray(connectToNames)) {
        connectToNames.forEach((targetName: string) => {
          const tgtClass = classes.find(c => c.name.toLowerCase() === targetName.toLowerCase());
          if (tgtClass) {
            relations.push({
              id: `rel_dom_${newId}_${tgtClass.id}`,
              sourceClassId: tgtClass.id,
              targetClassId: newId,
              type: 'ONE_TO_MANY',
              name: 'registra',
              sourceMultiplicity: '1',
              targetMultiplicity: '*'
            });
          }
        });
      }
    }

    if (recommendation.suggestedAction === 'FIX_TYPE' && recommendation.payload) {
      const { attributeId } = recommendation.payload;
      classes.forEach((c) => {
        const attr = c.attributes.find(a => a.id === attributeId);
        if (attr) {
          attr.type = 'String';
        }
      });
    }

    updatedDiagram.updatedAt = new Date().toISOString();
    return updatedDiagram;
  }

  applyFullNormalization(diagram: UmlDiagram): UmlDiagram {
    const report = this.auditDiagram(diagram);
    const allIds = new Set(report.recommendations.map(r => r.id));
    return this.applyFixes(diagram, allIds);
  }
}
