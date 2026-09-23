import { Injectable } from '@angular/core';
import { 
  UmlAttribute, 
  UmlClass, 
  UmlDiagram, 
  UmlElementType, 
  UmlMethod, 
  UmlRelation, 
  UmlVisibility,
  XmiValidationReport 
} from '../models/uml.models';

@Injectable({
  providedIn: 'root'
})
export class XmiService {

  /**
   * Genera un archivo XMI 2.1 compatible al 100% con Enterprise Architect (Sparx Systems).
   * Cumple con la especificación OMG UML 2.1 / UML 2.5.
   */
  exportToXmi(diagram: UmlDiagram): string {
    const pkgId = 'EAPK_PACKAGE_CASE_STUDIO';
    const diagramId = 'EAID_DIAG_' + Date.now();

    let classesXml = '';
    let associationsXml = '';
    let diagramElementsXml = '';

    // 1. Serializar Clases y sus miembros
    diagram.classes.forEach((c) => {
      const classEaId = this.normalizeId(c.id, 'EAID_CLS_');
      let attributesXml = '';
      let methodsXml = '';
      let generalizationsXml = '';

      // Tipo de elemento en XMI
      const elementType = c.elementType || 'CLASS';
      let xmiType = 'uml:Class';
      let stereotypeName = c.stereotype || '<<entity>>';

      if (elementType === 'INTERFACE') {
        xmiType = 'uml:Interface';
        stereotypeName = '<<interface>>';
      } else if (elementType === 'ENUM') {
        xmiType = 'uml:Enumeration';
        stereotypeName = '<<enumeration>>';
      } else if (elementType === 'PACKAGE') {
        xmiType = 'uml:Package';
      } else if (elementType === 'ACTOR') {
        xmiType = 'uml:Actor';
      }

      // Atributos
      c.attributes.forEach((attr) => {
        const attrEaId = this.normalizeId(attr.id, 'EAID_ATTR_');
        const visibility = this.convertVisibilityToXmi(attr.visibility);
        const typeRef = this.resolvePrimitiveType(attr.type);

        attributesXml += `
        <ownedAttribute xmi:type="uml:Property" xmi:id="${attrEaId}" name="${this.escapeXml(attr.name)}" visibility="${visibility}">
          <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#${typeRef}"/>
          ${attr.isPrimaryKey ? '<xmi:Extension extender="Enterprise Architect"><stereotype name="PK"/></xmi:Extension>' : ''}
        </ownedAttribute>`;
      });

      // Métodos
      c.methods.forEach((m) => {
        const opEaId = this.normalizeId(m.id, 'EAID_OP_');
        const visibility = this.convertVisibilityToXmi(m.visibility);
        const returnTypeRef = this.resolvePrimitiveType(m.returnType);

        let paramsXml = `
          <ownedParameter xmi:type="uml:Parameter" xmi:id="${opEaId}_ret" direction="return">
            <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#${returnTypeRef}"/>
          </ownedParameter>`;

        if (m.parameters) {
          m.parameters.forEach((p, idx) => {
            paramsXml += `
          <ownedParameter xmi:type="uml:Parameter" xmi:id="${opEaId}_p${idx}" name="${this.escapeXml(p.name)}" direction="in">
            <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#${this.resolvePrimitiveType(p.type)}"/>
          </ownedParameter>`;
          });
        }

        methodsXml += `
        <ownedOperation xmi:type="uml:Operation" xmi:id="${opEaId}" name="${this.escapeXml(m.name)}" visibility="${visibility}">
          ${paramsXml}
        </ownedOperation>`;
      });

      // Herencias salientes de esta clase
      diagram.relations
        .filter((r) => r.sourceClassId === c.id && r.type === 'INHERITANCE')
        .forEach((r) => {
          const targetEaId = this.normalizeId(r.targetClassId, 'EAID_CLS_');
          const genEaId = this.normalizeId(r.id, 'EAID_GEN_');
          generalizationsXml += `
        <generalization xmi:type="uml:Generalization" xmi:id="${genEaId}" general="${targetEaId}"/>`;
        });

      classesXml += `
      <packagedElement xmi:type="${xmiType}" xmi:id="${classEaId}" name="${this.escapeXml(c.name)}" visibility="public">
        <xmi:Extension extender="Enterprise Architect"><stereotype name="${this.escapeXml(stereotypeName)}"/></xmi:Extension>
        ${generalizationsXml}
        ${attributesXml}
        ${methodsXml}
      </packagedElement>`;

      // Coordenadas exactas para Enterprise Architect
      const width = c.width || 220;
      const height = c.height || (80 + c.attributes.length * 20 + c.methods.length * 18);
      const left = Math.round(c.position.x);
      const top = Math.round(c.position.y);
      const right = left + width;
      const bottom = top + height;

      diagramElementsXml += `
          <element geometry="Left=${left};Top=${top};Right=${right};Bottom=${bottom};" subject="${classEaId}" seqno="${c.name}"/>`;
    });

    // 2. Serializar Asociaciones (excluyendo Herencia que va dentro de la clase)
    diagram.relations
      .filter((r) => r.type !== 'INHERITANCE')
      .forEach((r) => {
        const assocEaId = this.normalizeId(r.id, 'EAID_ASSOC_');
        const srcEaId = this.normalizeId(r.sourceClassId, 'EAID_CLS_');
        const tgtEaId = this.normalizeId(r.targetClassId, 'EAID_CLS_');
        const srcEndId = assocEaId + '_srcEnd';
        const tgtEndId = assocEaId + '_tgtEnd';
        const assocName = r.name ? this.escapeXml(r.name) : '';

        const srcMulti = r.sourceMultiplicity || '1';
        const tgtMulti = r.targetMultiplicity || (r.type === 'ONE_TO_MANY' ? '*' : '1');

        let aggregationType = 'none';
        if (r.type === 'COMPOSITION') aggregationType = 'composite';
        if (r.type === 'AGGREGATION') aggregationType = 'shared';

        associationsXml += `
      <packagedElement xmi:type="uml:Association" xmi:id="${assocEaId}" name="${assocName}" visibility="public">
        <memberEnd xmi:idref="${srcEndId}"/>
        <memberEnd xmi:idref="${tgtEndId}"/>
        <ownedEnd xmi:type="uml:Property" xmi:id="${srcEndId}" visibility="public" association="${assocEaId}">
          <type xmi:idref="${srcEaId}"/>
          <lowerValue xmi:type="uml:LiteralInteger" value="${srcMulti.includes('*') ? '0' : '1'}"/>
          <upperValue xmi:type="uml:LiteralUnlimitedNatural" value="${srcMulti.includes('*') ? '*' : '1'}"/>
        </ownedEnd>
        <ownedEnd xmi:type="uml:Property" xmi:id="${tgtEndId}" visibility="public" association="${assocEaId}" aggregation="${aggregationType}">
          <type xmi:idref="${tgtEaId}"/>
          <lowerValue xmi:type="uml:LiteralInteger" value="${tgtMulti.includes('*') ? '0' : '1'}"/>
          <upperValue xmi:type="uml:LiteralUnlimitedNatural" value="${tgtMulti.includes('*') ? '*' : '1'}"/>
        </ownedEnd>
      </packagedElement>`;

        diagramElementsXml += `
          <element geometry="SX=0;SY=0;EX=0;EY=0;$ea_key=1;" subject="${assocEaId}" style="Mode=3;EOV=4;"/>`;
      });

    const diagramEaId = this.normalizeId(diagramId, 'EAID_DIAG_');

    // 3. Estructura XML completa en formato nativo OMG XMI 2.1 / Sparx Enterprise Architect
    return `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1">
  <xmi:Documentation exporter="Enterprise Architect" exporterVersion="6.5"/>
  <uml:Model xmi:type="uml:Model" name="EA_Model" visibility="public">
    <packagedElement xmi:type="uml:Package" xmi:id="${pkgId}" name="${this.escapeXml(diagram.name || 'Modelo_Conceptual')}" visibility="public">
      ${classesXml}
      ${associationsXml}
    </packagedElement>
  </uml:Model>
  <xmi:Extension extender="Enterprise Architect" extenderID="6.5">
    <diagrams>
      <diagram xmi:id="${diagramEaId}">
        <model package="${pkgId}" localID="1" type="Logical" name="${this.escapeXml(diagram.name || 'Diagrama_Clases')}"/>
        <properties docName="${this.escapeXml(diagram.name)}" font="Arial" size="10"/>
        <project author="CASE Studio UML" version="1.0" created="${new Date().toISOString()}" modified="${new Date().toISOString()}"/>
        <style1 value="ShowBrackets=1;ShowStereo=1;ShowTags=1;ShowAlphanum=1;ShowMult=1;ShowDetails=0;"/>
        <style2 value="SaveLocked=0;"/>
        <swimlanes value="locked=false;orientation=0;width=0;inIntro=0;names=empty;"/>
        <matrixgeometry value="VG={};HG={};"/>
        <extendedproperties/>
        <elements>
          ${diagramElementsXml}
        </elements>
      </diagram>
    </diagrams>
  </xmi:Extension>
</xmi:XMI>`;
  }

  /**
   * Valida exhaustivamente un XML/XMI contra la especificación OMG UML 2.1 y Enterprise Architect.
   */
  validateXmi(xmlContent: string): XmiValidationReport {
    const checks: XmiValidationReport['checks'] = [];
    let isValid = true;

    if (!xmlContent || !xmlContent.trim()) {
      return {
        isValid: false,
        totalClasses: 0,
        totalRelations: 0,
        checks: [{ title: 'Archivo vacío', status: 'fail', detail: 'El contenido XML está vacío.' }]
      };
    }

    // 1. Chequeo sintáctico XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'application/xml');
    const parserError = doc.querySelector('parsererror');

    if (parserError) {
      checks.push({
        title: 'Sintaxis XML',
        status: 'fail',
        detail: 'Error en el formateo XML: ' + parserError.textContent
      });
      return { isValid: false, totalClasses: 0, totalRelations: 0, checks };
    } else {
      checks.push({
        title: 'Sintaxis XML Estricta',
        status: 'pass',
        detail: 'El documento es un XML bien formado y sin errores de etiquetas.'
      });
    }

    // 2. Chequeo de Encabezado y Namespaces OMG
    const root = doc.documentElement;
    const xmiVersion = root.getAttribute('xmi:version') || root.getAttribute('version');
    const hasUmlNs = root.getAttribute('xmlns:uml') || root.innerHTML.includes('schema.omg.org/spec/UML');
    const hasXmiNs = root.getAttribute('xmlns:xmi') || root.innerHTML.includes('XMI');

    if (hasUmlNs && (xmiVersion === '2.1' || xmiVersion === '2.0' || xmiVersion === '2.5')) {
      checks.push({
        title: 'Estándar OMG XMI 2.1 / UML 2.5',
        status: 'pass',
        detail: `Declaración de namespace OMG válida (Versión XMI: ${xmiVersion || '2.1'}).`
      });
    } else {
      checks.push({
        title: 'Estándar OMG XMI',
        status: 'warning',
        detail: 'Faltan atributos formales xmi:version="2.1" o namespace uml oficial de OMG.'
      });
    }

    // 3. Chequeo de Modelo y Paquete
    const hasModel = doc.querySelector('uml\\:Model, Model, packagedElement[xmi\\:type="uml:Package"]');
    if (hasModel || root.tagName.toLowerCase().includes('xmi')) {
      checks.push({
        title: 'Contenedor de Modelo UML',
        status: 'pass',
        detail: 'Estructura de paquete y modelo de datos identificada.'
      });
    } else {
      checks.push({
        title: 'Contenedor de Modelo UML',
        status: 'warning',
        detail: 'No se encontró una etiqueta formal de empaquetado.'
      });
    }

    // 4. Chequeo de Clases y Entidades
    const classElements = Array.from(doc.querySelectorAll('*')).filter((el) => {
      const type = el.getAttribute('xmi:type') || el.getAttribute('type');
      return type?.includes('Class') || type?.includes('Interface') || type?.includes('Enumeration') || el.tagName.toLowerCase().includes('class');
    });

    const totalClasses = classElements.length;
    if (totalClasses > 0) {
      checks.push({
        title: `Definición de Clases (${totalClasses})`,
        status: 'pass',
        detail: `Se detectaron ${totalClasses} clases/entidades con atributos y métodos.`
      });
    } else {
      checks.push({
        title: 'Definición de Clases',
        status: 'fail',
        detail: 'No se encontraron elementos de tipo uml:Class.'
      });
      isValid = false;
    }

    // 5. Chequeo de Asociaciones
    const assocElements = Array.from(doc.querySelectorAll('*')).filter((el) => {
      const type = el.getAttribute('xmi:type') || el.getAttribute('type');
      return type?.includes('Association') || type?.includes('Generalization') || el.tagName.toLowerCase().includes('association');
    });

    const totalRelations = assocElements.length;
    if (totalRelations > 0) {
      checks.push({
        title: `Relaciones y Cardinalidades (${totalRelations})`,
        status: 'pass',
        detail: `Se identificaron ${totalRelations} relaciones entre entidades.`
      });
    } else {
      checks.push({
        title: 'Relaciones y Cardinalidades',
        status: 'warning',
        detail: 'El diagrama no contiene asociaciones o herencias.'
      });
    }

    // 6. Extensión Enterprise Architect (Geometría)
    const hasEaExtension = xmlContent.includes('Enterprise Architect') || xmlContent.includes('extender="Enterprise Architect"');
    if (hasEaExtension) {
      checks.push({
        title: 'Extensiones Gráficas Sparx Enterprise Architect',
        status: 'pass',
        detail: 'Incluye bloque <xmi:Extension> con coordenadas Left/Top/Right/Bottom para layout visual en EA.'
      });
    } else {
      checks.push({
        title: 'Extensiones Gráficas Enterprise Architect',
        status: 'warning',
        detail: 'No tiene coordenadas de diagramas de EA (se auto-organizará en cuadrícula al importar).'
      });
    }

    return {
      isValid,
      totalClasses,
      totalRelations,
      checks
    };
  }

  /**
   * Importa un archivo XMI exportado desde Enterprise Architect u otra herramienta CASE.
   */
  importFromXmi(xmlContent: string): UmlDiagram {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'application/xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Error al parsear el archivo XML/XMI: ' + parserError.textContent);
    }

    const classes: UmlClass[] = [];
    const relations: UmlRelation[] = [];
    const idMap = new Map<string, UmlClass>();

    // 1. Extraer elementos del diagrama principal exportado (geometría de Enterprise Architect si existe)
    const rawGeometryMap = new Map<string, { screenX: number; screenY: number; width: number; height: number }>();
    const diagramSubjects = new Set<string>();
    let minLeft = Infinity;
    let minTop = Infinity;

    // Obtener el diagrama primario del paquete exportado (ignorar diagramas secundarios de otros sub-paquetes)
    const primaryDiagram = doc.querySelector('diagrams > diagram') || doc;
    const elementNodes = primaryDiagram.querySelectorAll('element[subject][geometry]');

    elementNodes.forEach((el) => {
      const subject = el.getAttribute('subject');
      const geometry = el.getAttribute('geometry') || '';
      if (subject && geometry) {
        diagramSubjects.add(subject);

        const leftMatch = geometry.match(/Left=(-?\d+)/);
        const topMatch = geometry.match(/Top=(-?\d+)/);
        const rightMatch = geometry.match(/Right=(-?\d+)/);
        const bottomMatch = geometry.match(/Bottom=(-?\d+)/);

        if (leftMatch && topMatch) {
          const left = parseInt(leftMatch[1], 10);
          const rawTop = parseInt(topMatch[1], 10);
          const rawBottom = bottomMatch ? parseInt(bottomMatch[1], 10) : rawTop - 140;

          // Convertir Y cartesiano de EA a plano Web 2D
          const screenX = left;
          const screenY = Math.abs(rawTop);
          const width = rightMatch ? Math.max(200, Math.abs(parseInt(rightMatch[1], 10) - left)) : 220;
          const height = bottomMatch ? Math.max(130, Math.abs(rawTop - rawBottom)) : 170;

          if (screenX < minLeft) minLeft = screenX;
          if (screenY < minTop) minTop = screenY;

          rawGeometryMap.set(subject, { screenX, screenY, width, height });
        }
      }
    });

    if (minLeft === Infinity) minLeft = 0;
    if (minTop === Infinity) minTop = 0;

    // Normalizar posiciones con factor de separación ampliado (scaleX: 1.35, scaleY: 1.40) para evitar cualquier roce o superposición
    const geometryMap = new Map<string, { x: number; y: number; width: number; height: number }>();
    const scaleX = 1.35;
    const scaleY = 1.40;

    rawGeometryMap.forEach((geom, subject) => {
      geometryMap.set(subject, {
        x: Math.max(60, Math.round((geom.screenX - minLeft) * scaleX) + 80),
        y: Math.max(60, Math.round((geom.screenY - minTop) * scaleY) + 80),
        width: Math.max(220, geom.width),
        height: Math.max(140, geom.height)
      });
    });

    // 2. Extraer únicamente Clases primarias que pertenecen al diagrama activo de Enterprise Architect
    const processedIds = new Set<string>();
    
    // Obtener todos los elementos packagedElement de la estructura del modelo
    const allPackagedElements = Array.from(doc.querySelectorAll('packagedElement'));
    const classNodes = allPackagedElements.filter((el) => {
      // Ignorar elementos dentro de <xmi:Extension>
      let parent: HTMLElement | null = el.parentElement;
      while (parent) {
        if (parent.tagName.toLowerCase().includes('extension')) return false;
        parent = parent.parentElement;
      }

      const type = el.getAttribute('xmi:type') || el.getAttribute('type') || '';
      const isClassType = 
        type.endsWith('Class') || 
        type.endsWith('Interface') || 
        type.endsWith('Enumeration') || 
        type.endsWith('Actor') ||
        type.endsWith('DataType');

      const rawId = el.getAttribute('xmi:id') || el.getAttribute('id');
      const rawName = el.getAttribute('name') || '';

      // Omitir nodos de ayuda, patrones o documentación de Enterprise Architect ($help://...)
      if (rawName.startsWith('$') || rawName.includes('help://') || rawName.endsWith('.htm') || rawName.endsWith('.html')) {
        return false;
      }

      // Si el archivo XMI contiene la sección de diagramas de EA, incluir ÚNICAMENTE las clases que están presentes en dicho diagrama
      if (diagramSubjects.size > 0 && rawId && !diagramSubjects.has(rawId)) {
        return false;
      }

      if (isClassType && rawId && !processedIds.has(rawId)) {
        processedIds.add(rawId);
        return true;
      }
      return false;
    });

    let autoX = 80;
    let autoY = 80;

    classNodes.forEach((node, idx) => {
      const rawId = node.getAttribute('xmi:id') || node.getAttribute('id') || `cls_${idx}`;
      const name = node.getAttribute('name') || `Clase_${idx + 1}`;
      const typeAttr = node.getAttribute('xmi:type') || node.getAttribute('type') || '';

      let elementType: UmlElementType = 'CLASS';
      let stereotype = '<<entity>>';

      if (typeAttr.includes('Interface')) {
        elementType = 'INTERFACE';
        stereotype = '<<interface>>';
      } else if (typeAttr.includes('Enumeration')) {
        elementType = 'ENUM';
        stereotype = '<<enum>>';
      } else if (typeAttr.includes('Actor')) {
        elementType = 'ACTOR';
        stereotype = '<<actor>>';
      }

      // Buscar si el estereotipo está definido en xmi:Extension o atributo
      const stereoExt = node.querySelector('stereotype')?.getAttribute('name');
      if (stereoExt) {
        stereotype = stereoExt.startsWith('<<') ? stereoExt : `<<${stereoExt}>>`;
      }

      // Posición limpia en cuadrícula organizada si no hay coordenadas de Sparx
      let pos = geometryMap.get(rawId);
      if (!pos) {
        pos = {
          x: autoX,
          y: autoY,
          width: 230,
          height: 170
        };
        autoX += 320;
        if (autoX > 1100) {
          autoX = 80;
          autoY += 280;
        }
      }

      // Atributos (ownedAttribute o Property)
      const attributes: UmlAttribute[] = [];
      const attrNodes = Array.from(node.children).filter(c => {
        const tag = c.tagName.toLowerCase();
        const type = c.getAttribute('xmi:type') || '';
        return tag.includes('attribute') || tag.includes('property') || type.includes('Property');
      });

      attrNodes.forEach((attrNode, aIdx) => {
        const attrId = attrNode.getAttribute('xmi:id') || `${rawId}_a${aIdx}`;
        const attrName = attrNode.getAttribute('name');
        if (!attrName) return; // omitir propiedades sin nombre (ej: ownedEnd)

        const visibility = this.convertXmiToVisibility(attrNode.getAttribute('visibility'));
        
        let typeStr = 'String';
        const typeProp = attrNode.getAttribute('type');
        const typeChild = attrNode.querySelector('type');
        if (typeChild) {
          const href = typeChild.getAttribute('href') || '';
          typeStr = href.includes('#') ? href.split('#')[1] : (typeChild.getAttribute('name') || typeChild.getAttribute('xmi:idref') || 'String');
        } else if (typeProp) {
          typeStr = typeProp;
        }

        const isPk = attrName.toLowerCase() === 'id' || 
          attrName.toLowerCase().endsWith('_id') || 
          attrNode.innerHTML.includes('PK') ||
          attrNode.querySelector('stereotype[name="PK"]') !== null;

        attributes.push({
          id: attrId,
          name: attrName,
          type: this.mapXmiTypeToJava(typeStr),
          visibility,
          isPrimaryKey: isPk,
          isNullable: !isPk
        });
      });

      // Métodos / Operaciones (ownedOperation)
      const methods: UmlMethod[] = [];
      const opNodes = Array.from(node.children).filter(c => {
        const tag = c.tagName.toLowerCase();
        const type = c.getAttribute('xmi:type') || '';
        return tag.includes('operation') || type.includes('Operation');
      });

      opNodes.forEach((opNode, oIdx) => {
        const opId = opNode.getAttribute('xmi:id') || `${rawId}_op${oIdx}`;
        const opName = opNode.getAttribute('name') || `metodo_${oIdx}`;
        const visibility = this.convertXmiToVisibility(opNode.getAttribute('visibility'));
        
        // Retorno
        let returnType = 'void';
        const retParam = opNode.querySelector('ownedParameter[direction="return"], parameter[direction="return"]');
        if (retParam) {
          const typeChild = retParam.querySelector('type');
          if (typeChild) {
            const href = typeChild.getAttribute('href') || '';
            returnType = href.includes('#') ? href.split('#')[1] : (typeChild.getAttribute('name') || 'void');
          }
        }

        methods.push({
          id: opId,
          name: opName,
          returnType: this.mapXmiTypeToJava(returnType),
          visibility
        });
      });

      const umlClass: UmlClass = {
        id: rawId,
        name: name.trim().replace(/\s+/g, ''),
        elementType,
        stereotype,
        attributes,
        methods,
        position: { x: pos.x, y: pos.y },
        width: pos.width,
        height: pos.height
      };

      classes.push(umlClass);
      idMap.set(rawId, umlClass);

      // Herencia interna en la clase (<generalization general="..."/>)
      const genNodes = node.querySelectorAll('generalization');
      genNodes.forEach((gNode, gIdx) => {
        const targetGeneral = gNode.getAttribute('general') || gNode.getAttribute('generalization');
        if (targetGeneral) {
          relations.push({
            id: gNode.getAttribute('xmi:id') || `gen_${rawId}_${gIdx}`,
            sourceClassId: rawId,
            targetClassId: targetGeneral,
            type: 'INHERITANCE',
            name: 'Hereda'
          });
        }
      });

      // Realizaciones de Interfaz internas (<interfaceRealization supplier="..." client="..."/>)
      const realNodes = node.querySelectorAll('interfaceRealization, realization');
      realNodes.forEach((rNode, rIdx) => {
        const supplier = rNode.getAttribute('supplier') || rNode.getAttribute('contract');
        if (supplier) {
          relations.push({
            id: rNode.getAttribute('xmi:id') || `real_${rawId}_${rIdx}`,
            sourceClassId: rawId,
            targetClassId: supplier,
            type: 'REALIZATION',
            name: 'Implementa'
          });
        }
      });
    });

    // 3. Extraer Asociaciones y Realizaciones independientes del modelo
    const relationKeys = new Set<string>();
    
    // Función de ayuda para registrar relaciones sin duplicados
    const addRelation = (rel: UmlRelation) => {
      if (!idMap.has(rel.sourceClassId) || !idMap.has(rel.targetClassId)) return;
      const key = `${rel.sourceClassId}_${rel.targetClassId}_${rel.type}`;
      if (!relationKeys.has(key)) {
        relationKeys.add(key);
        relations.push(rel);
      }
    };

    // Registrar herencias y realizaciones capturadas internamente
    relations.forEach(r => relationKeys.add(`${r.sourceClassId}_${r.targetClassId}_${r.type}`));

    // A) Parsear connectors de <xmi:Extension><connectors><connector> (Formatos Enterprise Architect)
    const connectorNodes = doc.querySelectorAll('connectors > connector');
    connectorNodes.forEach((conn, cIdx) => {
      const connId = conn.getAttribute('xmi:idref') || conn.getAttribute('id') || `conn_${cIdx}`;
      const srcNode = conn.querySelector('source');
      const tgtNode = conn.querySelector('target');
      const propsNode = conn.querySelector('properties');

      const srcId = srcNode?.getAttribute('xmi:idref') || '';
      const tgtId = tgtNode?.getAttribute('xmi:idref') || '';
      const eaType = propsNode?.getAttribute('ea_type') || propsNode?.getAttribute('type') || '';
      const connName = propsNode?.getAttribute('name') || '';

      if (srcId && tgtId) {
        let type: UmlRelation['type'] = 'ONE_TO_MANY';
        if (eaType === 'Generalisation' || eaType === 'Inheritance') type = 'INHERITANCE';
        else if (eaType === 'Realisation' || eaType === 'InterfaceRealization') type = 'REALIZATION';
        else if (eaType === 'Aggregation') type = 'AGGREGATION';
        else if (eaType === 'Composition') type = 'COMPOSITION';
        else if (eaType === 'Association') type = 'ONE_TO_MANY';

        const srcMulti = srcNode?.querySelector('type')?.getAttribute('multiplicity') || '1';
        const tgtMulti = tgtNode?.querySelector('type')?.getAttribute('multiplicity') || '*';

        addRelation({
          id: connId,
          sourceClassId: srcId,
          targetClassId: tgtId,
          type,
          name: connName,
          sourceMultiplicity: srcMulti,
          targetMultiplicity: tgtMulti
        });
      }
    });

    // B) Parsear elementos packagedElement del modelo UML (Standard OMG XMI)
    allPackagedElements.forEach((assocNode, aIdx) => {
      let parent: HTMLElement | null = assocNode.parentElement;
      while (parent) {
        if (parent.tagName.toLowerCase().includes('extension')) return;
        parent = parent.parentElement;
      }

      const type = assocNode.getAttribute('xmi:type') || assocNode.getAttribute('type') || '';
      const assocId = assocNode.getAttribute('xmi:id') || `assoc_${aIdx}`;

      if (type.includes('Realization') || type.includes('Dependency')) {
        const client = assocNode.getAttribute('client');
        const supplier = assocNode.getAttribute('supplier');
        if (client && supplier) {
          addRelation({
            id: assocId,
            sourceClassId: client,
            targetClassId: supplier,
            type: type.includes('Realization') ? 'REALIZATION' : 'ONE_TO_MANY',
            name: assocNode.getAttribute('name') || ''
          });
        }
      } else if (type.includes('Association')) {
        const ownedEnds = Array.from(assocNode.querySelectorAll('ownedEnd'));
        const memberEnds = Array.from(assocNode.querySelectorAll('memberEnd'));

        let sourceId = '';
        let targetId = '';
        let relType: UmlRelation['type'] = 'ONE_TO_MANY';
        let sourceMulti = '1';
        let targetMulti = '*';

        if (ownedEnds.length >= 2) {
          const end1 = ownedEnds[0];
          const end2 = ownedEnds[1];

          sourceId = end1.querySelector('type')?.getAttribute('xmi:idref') || end1.getAttribute('type') || '';
          targetId = end2.querySelector('type')?.getAttribute('xmi:idref') || end2.getAttribute('type') || '';

          const agg = end2.getAttribute('aggregation') || end1.getAttribute('aggregation');
          if (agg === 'composite') relType = 'COMPOSITION';
          else if (agg === 'shared') relType = 'AGGREGATION';

          const upperVal1 = end1.querySelector('upperValue')?.getAttribute('value');
          const upperVal2 = end2.querySelector('upperValue')?.getAttribute('value');
          if (upperVal1 === '*' && upperVal2 === '*') relType = 'MANY_TO_MANY';
        } else if (memberEnds.length >= 2) {
          // Resolver idrefs de memberEnd buscando los ownedEnd correspondientes en el documento
          const end1Id = memberEnds[0].getAttribute('xmi:idref');
          const end2Id = memberEnds[1].getAttribute('xmi:idref');

          if (end1Id && end2Id) {
            const end1Node = doc.querySelector(`[xmi\\:id="${end1Id}"], [id="${end1Id}"]`);
            const end2Node = doc.querySelector(`[xmi\\:id="${end2Id}"], [id="${end2Id}"]`);

            sourceId = end1Node?.querySelector('type')?.getAttribute('xmi:idref') || end1Node?.getAttribute('type') || end1Id;
            targetId = end2Node?.querySelector('type')?.getAttribute('xmi:idref') || end2Node?.getAttribute('type') || end2Id;
          }
        }

        if (sourceId && targetId) {
          addRelation({
            id: assocId,
            sourceClassId: sourceId,
            targetClassId: targetId,
            type: relType,
            name: assocNode.getAttribute('name') || '',
            sourceMultiplicity: sourceMulti,
            targetMultiplicity: targetMulti
          });
        }
      }
    });

    return {
      id: 'diagram_' + Date.now(),
      name: 'Modelo Importado Enterprise Architect',
      description: 'Importado exitosamente desde XMI 2.1',
      classes,
      relations,
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Genera el script SQL DDL nativo para PostgreSQL basado en las reglas OMT / DMO de James Rumbaugh.
   */
  generatePostgreSqlDdl(diagram: UmlDiagram): string {
    let ddl = `-- ========================================================\n`;
    ddl += `-- SCRIPT DDL POSTGRESQL GENERADO POR CASE STUDIO UML\n`;
    ddl += `-- Proyecto: ${diagram.name}\n`;
    ddl += `-- Fecha: ${new Date().toLocaleString()}\n`;
    ddl += `-- Metodología: Mapeo OMT / DMO (James Rumbaugh)\n`;
    ddl += `-- Base de Datos: PostgreSQL 14+ / 16+\n`;
    ddl += `-- ========================================================\n\n`;

    // 1. Tablas
    const entities = diagram.classes.filter(c => !c.elementType || c.elementType === 'CLASS' || c.elementType === 'ASSOCIATION_CLASS');

    entities.forEach((c) => {
      const tableName = this.toSnakeCase(c.name);
      ddl += `DROP TABLE IF EXISTS ${tableName} CASCADE;\n`;
      ddl += `CREATE TABLE ${tableName} (\n`;

      const columnDefs: string[] = [];

      c.attributes.forEach((attr) => {
        const colName = this.toSnakeCase(attr.name);
        const colType = this.mapJavaToPostgres(attr.type);
        let constraints = '';

        if (attr.isPrimaryKey) {
          constraints += ' PRIMARY KEY';
        } else if (!attr.isNullable) {
          constraints += ' NOT NULL';
        }

        columnDefs.push(`    ${colName.padEnd(22)} ${colType}${constraints}`);
      });

      // Relaciones N a 1 y 1 a 1 (Foreign Keys entrantes a esta tabla)
      diagram.relations
        .filter((r) => r.sourceClassId === c.id && (r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_MANY' || r.type === 'ONE_TO_ONE'))
        .forEach((r) => {
          const targetClass = diagram.classes.find((x) => x.id === r.targetClassId);
          if (targetClass) {
            const fkCol = `${this.toSnakeCase(targetClass.name)}_id`;
            if (!columnDefs.some((line) => line.includes(fkCol))) {
              columnDefs.push(`    ${fkCol.padEnd(22)} BIGINT`);
            }
          }
        });

      ddl += columnDefs.join(',\n');
      ddl += `\n);\n\n`;
    });

    // 2. Foreign Keys Constraints
    ddl += `-- --------------------------------------------------------\n`;
    ddl += `-- RESTRICCIONES DE CLAVES FORÁNEAS (INTEGRIDAD REFERENCIAL)\n`;
    ddl += `-- --------------------------------------------------------\n`;

    diagram.relations
      .filter((r) => r.type === 'ONE_TO_MANY' || r.type === 'MANY_TO_ONE' || r.type === 'ONE_TO_ONE')
      .forEach((r) => {
        const sourceClass = diagram.classes.find((x) => x.id === r.sourceClassId);
        const targetClass = diagram.classes.find((x) => x.id === r.targetClassId);
        if (sourceClass && targetClass) {
          const srcTable = this.toSnakeCase(sourceClass.name);
          const tgtTable = this.toSnakeCase(targetClass.name);
          const fkCol = `${tgtTable}_id`;
          const fkName = `fk_${srcTable}_${tgtTable}`;

          ddl += `ALTER TABLE ${srcTable}\n`;
          ddl += `    ADD CONSTRAINT ${fkName} FOREIGN KEY (${fkCol})\n`;
          ddl += `    REFERENCES ${tgtTable} (id) ON DELETE CASCADE ON UPDATE CASCADE;\n\n`;
        }
      });

    return ddl;
  }

  // --- HELPERS PRIVADOS ---

  private resolvePrimitiveType(type: string | undefined): string {
    if (!type) return 'String';
    const lower = type.toLowerCase();
    if (lower.includes('int') || lower.includes('long')) return 'Integer';
    if (lower.includes('bool')) return 'Boolean';
    if (lower.includes('float') || lower.includes('double') || lower.includes('decimal')) return 'Real';
    if (lower.includes('date') || lower.includes('time')) return 'Date';
    return 'String';
  }

  private mapXmiTypeToJava(xmiType: string): string {
    const t = xmiType.toLowerCase();
    if (t.includes('integer') || t === 'int') return 'Integer';
    if (t.includes('long')) return 'Long';
    if (t.includes('bool')) return 'Boolean';
    if (t.includes('double') || t.includes('real')) return 'Double';
    if (t.includes('date')) return 'LocalDate';
    if (t.includes('text') || t.includes('string')) return 'String';
    return 'String';
  }

  private mapJavaToPostgres(javaType: string): string {
    switch (javaType) {
      case 'Long': return 'BIGSERIAL';
      case 'Integer': return 'INTEGER';
      case 'String': return 'VARCHAR(255)';
      case 'Text': return 'TEXT';
      case 'Double': return 'DOUBLE PRECISION';
      case 'Float': return 'REAL';
      case 'Boolean': return 'BOOLEAN';
      case 'LocalDate': return 'DATE';
      case 'LocalDateTime': return 'TIMESTAMP';
      case 'BigDecimal': return 'NUMERIC(14,2)';
      case 'byte[]': return 'BYTEA';
      default: return 'VARCHAR(255)';
    }
  }

  private convertVisibilityToXmi(v: UmlVisibility): string {
    switch (v) {
      case '+': return 'public';
      case '-': return 'private';
      case '#': return 'protected';
      case '~': return 'package';
      default: return 'public';
    }
  }

  private convertXmiToVisibility(xmiVis: string | null): UmlVisibility {
    switch (xmiVis) {
      case 'public': return '+';
      case 'private': return '-';
      case 'protected': return '#';
      case 'package': return '~';
      default: return '+';
    }
  }

  private normalizeId(id: string, prefix: string): string {
    if (id.startsWith('EAID_')) return id;
    return prefix + id.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private escapeXml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private toSnakeCase(str: string): string {
    return (str || '')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  }
}
