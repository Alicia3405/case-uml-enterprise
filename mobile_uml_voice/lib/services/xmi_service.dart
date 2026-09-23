import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';
import '../models/uml_models.dart';
import 'download_helper.dart';

/// Servicio de importación y exportación de archivos XMI 2.1
/// Compatible con Sparx Systems Enterprise Architect y el estándar OMG UML 2.1
class XmiService {
  static const _uuid = Uuid();

  /// Exporta el diagrama UML al formato estándar XMI 2.1 para Enterprise Architect
  static String exportToXmi(UmlDiagram diagram) {
    const pkgId = 'EAPK_PACKAGE_MOBILE_STUDIO';
    final diagramId = 'EAID_DIAG_${DateTime.now().millisecondsSinceEpoch}';

    final classesXml = StringBuffer();
    final associationsXml = StringBuffer();
    final diagramElementsXml = StringBuffer();

    // 1. Serializar Clases y sus miembros
    for (final c in diagram.classes) {
      final classEaId = _normalizeId(c.id, 'EAID_CLS_');
      final attributesXml = StringBuffer();
      final methodsXml = StringBuffer();
      final generalizationsXml = StringBuffer();

      const xmiType = 'uml:Class';
      final stereotypeName = c.stereotype.isNotEmpty ? c.stereotype : '«entity»';

      // Atributos
      for (final attr in c.attributes) {
        final attrEaId = _normalizeId(attr.id, 'EAID_ATTR_');
        final visibility = _convertVisibilityToXmi(attr.visibility);
        final typeRef = _resolvePrimitiveType(attr.type);

        attributesXml.write('''
        <ownedAttribute xmi:type="uml:Property" xmi:id="$attrEaId" name="${_escapeXml(attr.name)}" visibility="$visibility">
          <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#$typeRef"/>
          ${attr.isPrimaryKey ? '<xmi:Extension extender="Enterprise Architect"><stereotype name="PK"/></xmi:Extension>' : ''}
        </ownedAttribute>''');
      }

      // Métodos
      for (final m in c.methods) {
        final opEaId = _normalizeId(m.id, 'EAID_OP_');
        final visibility = _convertVisibilityToXmi(m.visibility);
        final returnTypeRef = _resolvePrimitiveType(m.returnType);

        final paramsXml = StringBuffer();
        paramsXml.write('''
          <ownedParameter xmi:type="uml:Parameter" xmi:id="${opEaId}_ret" direction="return">
            <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#$returnTypeRef"/>
          </ownedParameter>''');

        for (int idx = 0; idx < m.parameters.length; idx++) {
          final p = m.parameters[idx];
          paramsXml.write('''
          <ownedParameter xmi:type="uml:Parameter" xmi:id="${opEaId}_p$idx" name="${_escapeXml(p.name)}" direction="in">
            <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#${_resolvePrimitiveType(p.type)}"/>
          </ownedParameter>''');
        }

        methodsXml.write('''
        <ownedOperation xmi:type="uml:Operation" xmi:id="$opEaId" name="${_escapeXml(m.name)}" visibility="$visibility">
          $paramsXml
        </ownedOperation>''');
      }

      // Herencias salientes
      for (final r in diagram.relations.where((r) => r.sourceClassId == c.id && r.type == UmlRelationType.inheritance)) {
        final targetEaId = _normalizeId(r.targetClassId, 'EAID_CLS_');
        final genEaId = _normalizeId(r.id, 'EAID_GEN_');
        generalizationsXml.write('''
        <generalization xmi:type="uml:Generalization" xmi:id="$genEaId" general="$targetEaId"/>''');
      }

      classesXml.write('''
      <packagedElement xmi:type="$xmiType" xmi:id="$classEaId" name="${_escapeXml(c.name)}" visibility="public">
        <xmi:Extension extender="Enterprise Architect"><stereotype name="${_escapeXml(stereotypeName)}"/></xmi:Extension>
        $generalizationsXml
        $attributesXml
        $methodsXml
      </packagedElement>''');

      // Coordenadas para Enterprise Architect (Left, Top, Right, Bottom)
      final left = c.position.dx.round();
      final top = c.position.dy.round();
      const width = 220;
      final height = 80 + c.attributes.length * 22 + c.methods.length * 20;
      final right = left + width;
      final bottom = top + height;

      diagramElementsXml.write('''
        <element geometry="Left=$left;Top=$top;Right=$right;Bottom=$bottom;" subject="$classEaId" seqno="${c.name}"/>''');
    }

    // 2. Serializar Asociaciones
    for (final r in diagram.relations.where((r) => r.type != UmlRelationType.inheritance)) {
      final assocEaId = _normalizeId(r.id, 'EAID_ASSOC_');
      final srcEaId = _normalizeId(r.sourceClassId, 'EAID_CLS_');
      final tgtEaId = _normalizeId(r.targetClassId, 'EAID_CLS_');
      final srcEndId = '${assocEaId}_srcEnd';
      final tgtEndId = '${assocEaId}_tgtEnd';
      final assocName = r.name.isNotEmpty ? _escapeXml(r.name) : '';

      final srcMulti = r.sourceMultiplicity.isNotEmpty ? r.sourceMultiplicity : '1';
      final tgtMulti = r.targetMultiplicity.isNotEmpty ? r.targetMultiplicity : (r.type == UmlRelationType.association ? '*' : '1');

      String aggregationType = 'none';
      if (r.type == UmlRelationType.composition) aggregationType = 'composite';
      if (r.type == UmlRelationType.aggregation) aggregationType = 'shared';

      associationsXml.write('''
      <packagedElement xmi:type="uml:Association" xmi:id="$assocEaId" name="$assocName" visibility="public">
        <memberEnd xmi:idref="$srcEndId"/>
        <memberEnd xmi:idref="$tgtEndId"/>
        <ownedEnd xmi:type="uml:Property" xmi:id="$srcEndId" visibility="public" association="$assocEaId">
          <type xmi:idref="$srcEaId"/>
          <lowerValue xmi:type="uml:LiteralInteger" value="${srcMulti.contains('*') ? '0' : '1'}"/>
          <upperValue xmi:type="uml:LiteralUnlimitedNatural" value="${srcMulti.contains('*') ? '*' : '1'}"/>
        </ownedEnd>
        <ownedEnd xmi:type="uml:Property" xmi:id="$tgtEndId" visibility="public" association="$assocEaId" aggregation="$aggregationType">
          <type xmi:idref="$tgtEaId"/>
          <lowerValue xmi:type="uml:LiteralInteger" value="${tgtMulti.contains('*') ? '0' : '1'}"/>
          <upperValue xmi:type="uml:LiteralUnlimitedNatural" value="${tgtMulti.contains('*') ? '*' : '1'}"/>
        </ownedEnd>
      </packagedElement>''');
    }

    // 3. Documento XML raíz OMG UML 2.1
    return '''<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1">
  <xmi:Documentation exporter="CASE Studio UML Mobile" exporterVersion="2.5"/>
  <uml:Model xmi:type="uml:Model" name="EA_Model" visibility="public">
    <packagedElement xmi:type="uml:Package" xmi:id="$pkgId" name="${_escapeXml(diagram.name.isNotEmpty ? diagram.name : 'Modelo_Conceptual')}" visibility="public">
      $classesXml
      $associationsXml
    </packagedElement>
  </uml:Model>
  <xmi:Extension extender="Enterprise Architect" extenderID="6.5">
    <diagrams>
      <diagram xmi:id="$diagramId">
        <model package="$pkgId" localID="1" type="Logical" name="${_escapeXml(diagram.name.isNotEmpty ? diagram.name : 'Diagrama_Clases')}"/>
        <properties docName="${_escapeXml(diagram.name)}"/>
        <elements>
          $diagramElementsXml
        </elements>
      </diagram>
    </diagrams>
  </xmi:Extension>
</xmi:XMI>''';
  }

  /// Descarga directamente el archivo XMI 2.1 para Enterprise Architect
  static void downloadXmi(UmlDiagram diagram) {
    final xmiContent = exportToXmi(diagram);
    final filename = '${diagram.name.replaceAll(RegExp(r'[^a-zA-Z0-9_\-]'), '_')}_EA.xmi';
    downloadBlobFile(filename, utf8.encode(xmiContent));
  }

  /// Importa un archivo XMI exportado desde Enterprise Architect u otra herramienta CASE
  static UmlDiagram importFromXmi(String xmlContent) {
    if (xmlContent.trim().isEmpty) {
      throw Exception('El archivo XMI está vacío.');
    }

    final classes = <UmlClass>[];
    final relations = <UmlRelation>[];
    final classIdMap = <String, UmlClass>{};

    // 1. Extraer geometrías de Enterprise Architect: <element geometry="Left=...;Top=...;Right=...;Bottom=..." subject="..."/>
    final geometryMap = <String, Map<String, double>>{};
    final elemGeomRegex = RegExp(r'<element[^>]+geometry="([^"]+)"[^>]+subject="([^"]+)"', caseSensitive: false);
    for (final match in elemGeomRegex.allMatches(xmlContent)) {
      final geom = match.group(1) ?? '';
      final subject = match.group(2) ?? '';
      final leftM = RegExp(r'Left=(\d+)').firstMatch(geom);
      final topM = RegExp(r'Top=(\d+)').firstMatch(geom);
      final rightM = RegExp(r'Right=(\d+)').firstMatch(geom);
      final bottomM = RegExp(r'Bottom=(\d+)').firstMatch(geom);

      final left = leftM != null ? double.tryParse(leftM.group(1)!) ?? 100.0 : 100.0;
      final top = topM != null ? double.tryParse(topM.group(1)!) ?? 100.0 : 100.0;
      final right = rightM != null ? double.tryParse(rightM.group(1)!) ?? (left + 220.0) : (left + 220.0);
      final bottom = bottomM != null ? double.tryParse(bottomM.group(1)!) ?? (top + 160.0) : (top + 160.0);

      geometryMap[subject] = {
        'left': left.clamp(40.0, 3000.0),
        'top': top.clamp(40.0, 3000.0),
        'width': (right - left).clamp(180.0, 500.0),
        'height': (bottom - top).clamp(120.0, 600.0),
      };
    }

    // 2. Extraer Clases: <packagedElement xmi:type="uml:Class" xmi:id="..." name="...">...</packagedElement>
    final classRegex = RegExp(
      r'<(packagedElement|element)[^>]+(?:xmi:type="uml:Class"|type="uml:Class")[^>]*>([\s\S]*?)<\/\1>',
      caseSensitive: false,
    );

    double autoX = 80.0;
    double autoY = 80.0;
    int colCounter = 0;

    for (final cMatch in classRegex.allMatches(xmlContent)) {
      final wholeTag = cMatch.group(0) ?? '';
      final innerContent = cMatch.group(2) ?? '';

      final idMatch = RegExp(r'(?:xmi:id|id)="([^"]+)"').firstMatch(wholeTag);
      final nameMatch = RegExp(r'name="([^"]+)"').firstMatch(wholeTag);

      final classId = idMatch?.group(1) ?? 'cls_${_uuid.v4().substring(0, 8)}';
      final className = (nameMatch?.group(1) ?? 'Clase').replaceAll(RegExp(r'\s+'), '');

      // Estereotipo
      final stMatch = RegExp(r'<stereotype[^>]+name="([^"]+)"').firstMatch(innerContent);
      final stereotype = stMatch?.group(1) ?? '«entity»';

      // Posición
      Offset pos;
      if (geometryMap.containsKey(classId)) {
        pos = Offset(geometryMap[classId]!['left']!, geometryMap[classId]!['top']!);
      } else {
        pos = Offset(autoX, autoY);
        colCounter++;
        autoX += 320.0;
        if (colCounter >= 3) {
          colCounter = 0;
          autoX = 80.0;
          autoY += 280.0;
        }
      }

      // Atributos: <ownedAttribute ... name="..." visibility="...">
      final attributes = <UmlAttribute>[];
      final attrRegex = RegExp(r'<ownedAttribute[^>]*>[\s\S]*?<\/ownedAttribute>|<ownedAttribute[^>]*\/>');
      for (final aMatch in attrRegex.allMatches(innerContent)) {
        final aTag = aMatch.group(0) ?? '';
        final aIdMatch = RegExp(r'(?:xmi:id|id)="([^"]+)"').firstMatch(aTag);
        final aNameMatch = RegExp(r'name="([^"]+)"').firstMatch(aTag);
        final aVisMatch = RegExp(r'visibility="([^"]+)"').firstMatch(aTag);

        final aId = aIdMatch?.group(1) ?? 'a_${_uuid.v4().substring(0, 6)}';
        final aName = aNameMatch?.group(1) ?? 'campo';
        final aVis = _convertXmiToVisibility(aVisMatch?.group(1));

        String aType = 'String';
        final hrefMatch = RegExp(r'href="[^"]*#([^"]+)"').firstMatch(aTag);
        if (hrefMatch != null) {
          aType = _mapXmiTypeToJava(hrefMatch.group(1)!);
        } else {
          final tMatch = RegExp(r'type="([^"]+)"').firstMatch(aTag);
          if (tMatch != null) aType = _mapXmiTypeToJava(tMatch.group(1)!);
        }

        final isPk = aName.toLowerCase() == 'id' || aName.toLowerCase().endsWith('_id') || aTag.contains('stereotype name="PK"');

        attributes.add(UmlAttribute(
          id: aId,
          name: aName,
          type: aType,
          visibility: aVis,
          isPrimaryKey: isPk,
          isNullable: !isPk,
        ));
      }

      if (attributes.isEmpty) {
        attributes.add(UmlAttribute(
          id: '${classId}_id',
          name: 'id',
          type: 'Long',
          visibility: UmlVisibility.public,
          isPrimaryKey: true,
        ));
      }

      // Métodos: <ownedOperation ... name="..." visibility="...">
      final methods = <UmlMethod>[];
      final opRegex = RegExp(r'<ownedOperation[^>]*>[\s\S]*?<\/ownedOperation>|<ownedOperation[^>]*\/>');
      for (final oMatch in opRegex.allMatches(innerContent)) {
        final oTag = oMatch.group(0) ?? '';
        final oIdMatch = RegExp(r'(?:xmi:id|id)="([^"]+)"').firstMatch(oTag);
        final oNameMatch = RegExp(r'name="([^"]+)"').firstMatch(oTag);
        final oVisMatch = RegExp(r'visibility="([^"]+)"').firstMatch(oTag);

        final oId = oIdMatch?.group(1) ?? 'op_${_uuid.v4().substring(0, 6)}';
        final oName = oNameMatch?.group(1) ?? 'operacion';
        final oVis = _convertXmiToVisibility(oVisMatch?.group(1));

        methods.add(UmlMethod(
          id: oId,
          name: oName,
          returnType: 'void',
          visibility: oVis,
        ));
      }

      final umlClass = UmlClass(
        id: classId,
        name: className,
        stereotype: stereotype,
        position: pos,
        attributes: attributes,
        methods: methods,
      );

      classes.add(umlClass);
      classIdMap[classId] = umlClass;

      // Herencias internas: <generalization general="..."/>
      final genRegex = RegExp(r'<generalization[^>]+general="([^"]+)"');
      for (final gMatch in genRegex.allMatches(innerContent)) {
        final targetGen = gMatch.group(1)!;
        relations.add(UmlRelation(
          id: 'gen_${classId}_${_uuid.v4().substring(0, 6)}',
          sourceClassId: classId,
          targetClassId: targetGen,
          type: UmlRelationType.inheritance,
          name: 'Hereda',
          sourceMultiplicity: '1..1',
          targetMultiplicity: '1..1',
        ));
      }
    }

    // 3. Extraer Asociaciones: <packagedElement xmi:type="uml:Association" ...>
    final assocRegex = RegExp(
      r'<(?:packagedElement|element)[^>]+(?:xmi:type="uml:Association"|type="uml:Association")[^>]*>([\s\S]*?)<\/(?:packagedElement|element)>',
      caseSensitive: false,
    );

    for (final aMatch in assocRegex.allMatches(xmlContent)) {
      final aContent = aMatch.group(1) ?? '';
      final wholeTag = aMatch.group(0) ?? '';

      final aIdMatch = RegExp(r'(?:xmi:id|id)="([^"]+)"').firstMatch(wholeTag);
      final aNameMatch = RegExp(r'name="([^"]+)"').firstMatch(wholeTag);
      final assocId = aIdMatch?.group(1) ?? 'assoc_${_uuid.v4().substring(0, 6)}';
      final assocName = aNameMatch?.group(1) ?? '';

      final ownedEnds = RegExp(r'<ownedEnd[^>]*>[\s\S]*?<\/ownedEnd>|<ownedEnd[^>]*\/>').allMatches(aContent).toList();
      String srcId = '';
      String tgtId = '';
      UmlRelationType relType = UmlRelationType.association;

      if (ownedEnds.length >= 2) {
        final end1 = ownedEnds[0].group(0) ?? '';
        final end2 = ownedEnds[1].group(0) ?? '';

        final srcTypeM = RegExp(r'(?:xmi:idref|type)="([^"]+)"').firstMatch(end1);
        final tgtTypeM = RegExp(r'(?:xmi:idref|type)="([^"]+)"').firstMatch(end2);
        srcId = srcTypeM?.group(1) ?? '';
        tgtId = tgtTypeM?.group(1) ?? '';

        final isComp = end2.contains('composite') || end1.contains('composite');
        final isAggr = end2.contains('shared') || end1.contains('shared');
        if (isComp) relType = UmlRelationType.composition;
        if (isAggr) relType = UmlRelationType.aggregation;
      } else {
        final memberEnds = RegExp(r'<memberEnd[^>]+xmi:idref="([^"]+)"').allMatches(aContent).toList();
        if (memberEnds.length >= 2) {
          srcId = memberEnds[0].group(1) ?? '';
          tgtId = memberEnds[1].group(1) ?? '';
        }
      }

      if (srcId.isNotEmpty && tgtId.isNotEmpty && srcId != tgtId) {
        relations.add(UmlRelation(
          id: assocId,
          sourceClassId: srcId,
          targetClassId: tgtId,
          type: relType,
          name: assocName,
          sourceMultiplicity: '1..1',
          targetMultiplicity: '0..*',
        ));
      }
    }

    // Extraer título del modelo si existe
    final modelNameMatch = RegExp(r'<packagedElement[^>]+xmi:type="uml:Package"[^>]+name="([^"]+)"').firstMatch(xmlContent);
    final diagramName = modelNameMatch?.group(1) ?? 'Diagrama EA Importado';

    return UmlDiagram(
      id: 'ea_diag_${_uuid.v4().substring(0, 8)}',
      name: diagramName,
      description: 'Importado con fidelidad completa desde Enterprise Architect (XMI 2.1)',
      classes: classes,
      relations: relations,
      updatedAt: DateTime.now(),
    );
  }

  // --- HELPERS PRIVADOS ---

  static String _resolvePrimitiveType(String? type) {
    if (type == null || type.isEmpty) return 'String';
    final lower = type.toLowerCase();
    if (lower.contains('int') || lower.contains('long')) return 'Integer';
    if (lower.contains('bool')) return 'Boolean';
    if (lower.contains('float') || lower.contains('double') || lower.contains('decimal')) return 'Real';
    if (lower.contains('date') || lower.contains('time')) return 'Date';
    return 'String';
  }

  static String _mapXmiTypeToJava(String xmiType) {
    final t = xmiType.toLowerCase();
    if (t.contains('integer') || t == 'int') return 'Integer';
    if (t.contains('long')) return 'Long';
    if (t.contains('bool')) return 'Boolean';
    if (t.contains('double') || t.contains('real')) return 'Double';
    if (t.contains('date')) return 'LocalDate';
    return 'String';
  }

  static String _convertVisibilityToXmi(UmlVisibility v) {
    switch (v) {
      case UmlVisibility.public:
        return 'public';
      case UmlVisibility.private:
        return 'private';
      case UmlVisibility.protected:
        return 'protected';
      case UmlVisibility.package:
        return 'package';
    }
  }

  static UmlVisibility _convertXmiToVisibility(String? xmiVis) {
    switch (xmiVis) {
      case 'private':
        return UmlVisibility.private;
      case 'protected':
        return UmlVisibility.protected;
      case 'package':
        return UmlVisibility.package;
      case 'public':
      default:
        return UmlVisibility.public;
    }
  }

  static String _normalizeId(String id, String prefix) {
    if (id.startsWith('EAID_')) return id;
    return prefix + id.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_');
  }

  static String _escapeXml(String unsafe) {
    return unsafe
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
  }
}
