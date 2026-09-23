import 'dart:convert';
import 'package:flutter/material.dart';
import 'auth_models.dart';

/// Visibilidad UML: + (public), - (private), # (protected), ~ (package)
enum UmlVisibility {
  public('+', 'Público'),
  private('-', 'Privado'),
  protected('#', 'Protegido'),
  package('~', 'Paquete');

  final String symbol;
  final String label;
  const UmlVisibility(this.symbol, this.label);

  static UmlVisibility fromString(String val) {
    switch (val) {
      case '-':
        return UmlVisibility.private;
      case '#':
        return UmlVisibility.protected;
      case '~':
        return UmlVisibility.package;
      case '+':
      default:
        return UmlVisibility.public;
    }
  }
}

/// Tipo de Relación UML
enum UmlRelationType {
  association('ASSOCIATION', 'Asociación'),
  composition('COMPOSITION', 'Composición'),
  aggregation('AGGREGATION', 'Agregación'),
  inheritance('INHERITANCE', 'Herencia'),
  dependency('DEPENDENCY', 'Dependencia');

  final String code;
  final String label;
  const UmlRelationType(this.code, this.label);

  static UmlRelationType fromString(String val) {
    switch (val.toUpperCase()) {
      case 'COMPOSITION':
        return UmlRelationType.composition;
      case 'AGGREGATION':
        return UmlRelationType.aggregation;
      case 'INHERITANCE':
        return UmlRelationType.inheritance;
      case 'DEPENDENCY':
        return UmlRelationType.dependency;
      case 'ASSOCIATION':
      default:
        return UmlRelationType.association;
    }
  }
}

/// Atributo de Clase UML
class UmlAttribute {
  final String id;
  String name;
  String type;
  UmlVisibility visibility;
  bool isPrimaryKey;
  bool isNullable;

  UmlAttribute({
    required this.id,
    required this.name,
    this.type = 'String',
    this.visibility = UmlVisibility.public,
    this.isPrimaryKey = false,
    this.isNullable = false,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'type': type,
    'visibility': visibility.symbol,
    'isPrimaryKey': isPrimaryKey,
    'isNullable': isNullable,
  };

  factory UmlAttribute.fromJson(Map<String, dynamic> json) => UmlAttribute(
    id: json['id'] ?? '',
    name: json['name'] ?? 'campo',
    type: json['type'] ?? 'String',
    visibility: UmlVisibility.fromString(json['visibility'] ?? '+'),
    isPrimaryKey: json['isPrimaryKey'] ?? false,
    isNullable: json['isNullable'] ?? false,
  );
}

/// Parámetro de Método
class UmlMethodParam {
  final String name;
  final String type;

  UmlMethodParam({required this.name, required this.type});

  Map<String, dynamic> toJson() => {'name': name, 'type': type};

  factory UmlMethodParam.fromJson(Map<String, dynamic> json) =>
      UmlMethodParam(name: json['name'] ?? '', type: json['type'] ?? 'String');
}

/// Método / Operación UML
class UmlMethod {
  final String id;
  String name;
  String returnType;
  UmlVisibility visibility;
  List<UmlMethodParam> parameters;

  UmlMethod({
    required this.id,
    required this.name,
    this.returnType = 'void',
    this.visibility = UmlVisibility.public,
    List<UmlMethodParam>? parameters,
  }) : parameters = parameters ?? [];

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'returnType': returnType,
    'visibility': visibility.symbol,
    'parameters': parameters.map((p) => p.toJson()).toList(),
  };

  factory UmlMethod.fromJson(Map<String, dynamic> json) => UmlMethod(
    id: json['id'] ?? '',
    name: json['name'] ?? 'metodo',
    returnType: json['returnType'] ?? 'void',
    visibility: UmlVisibility.fromString(json['visibility'] ?? '+'),
    parameters: (json['parameters'] as List<dynamic>?)
            ?.map((p) => UmlMethodParam.fromJson(p))
            .toList() ??
        [],
  );
}

/// Clase / Entidad UML
class UmlClass {
  final String id;
  String name;
  String stereotype;
  Offset position;
  List<UmlAttribute> attributes;
  List<UmlMethod> methods;

  UmlClass({
    required this.id,
    required this.name,
    this.stereotype = '«entity»',
    this.position = const Offset(100, 100),
    List<UmlAttribute>? attributes,
    List<UmlMethod>? methods,
  })  : attributes = attributes ?? [],
        methods = methods ?? [];

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'stereotype': stereotype,
    'position': {'x': position.dx, 'y': position.dy},
    'attributes': attributes.map((a) => a.toJson()).toList(),
    'methods': methods.map((m) => m.toJson()).toList(),
  };

  factory UmlClass.fromJson(Map<String, dynamic> json) {
    final pos = json['position'] as Map<String, dynamic>?;
    final dx = (pos?['x'] as num?)?.toDouble() ?? 100.0;
    final dy = (pos?['y'] as num?)?.toDouble() ?? 100.0;

    return UmlClass(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Clase',
      stereotype: json['stereotype'] ?? '«entity»',
      position: Offset(dx, dy),
      attributes: (json['attributes'] as List<dynamic>?)
              ?.map((a) => UmlAttribute.fromJson(a))
              .toList() ??
          [],
      methods: (json['methods'] as List<dynamic>?)
              ?.map((m) => UmlMethod.fromJson(m))
              .toList() ??
          [],
    );
  }
}

/// Relación UML
class UmlRelation {
  final String id;
  final String sourceClassId;
  final String targetClassId;
  UmlRelationType type;
  String name;
  String sourceMultiplicity;
  String targetMultiplicity;

  UmlRelation({
    required this.id,
    required this.sourceClassId,
    required this.targetClassId,
    this.type = UmlRelationType.association,
    this.name = '',
    this.sourceMultiplicity = '1..1',
    this.targetMultiplicity = '0..*',
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'sourceClassId': sourceClassId,
    'targetClassId': targetClassId,
    'type': type.code,
    'name': name,
    'sourceMultiplicity': sourceMultiplicity,
    'targetMultiplicity': targetMultiplicity,
  };

  factory UmlRelation.fromJson(Map<String, dynamic> json) => UmlRelation(
    id: json['id'] ?? '',
    sourceClassId: json['sourceClassId'] ?? '',
    targetClassId: json['targetClassId'] ?? '',
    type: UmlRelationType.fromString(json['type'] ?? 'ASSOCIATION'),
    name: json['name'] ?? json['label'] ?? '',
    sourceMultiplicity: json['sourceMultiplicity'] ?? '1..1',
    targetMultiplicity: json['targetMultiplicity'] ?? '0..*',
  );
}

/// Diagrama UML Completo
class UmlDiagram {
  final String id;
  String name;
  String description;
  List<UmlClass> classes;
  List<UmlRelation> relations;
  DateTime updatedAt;

  UmlDiagram({
    required this.id,
    required this.name,
    this.description = '',
    List<UmlClass>? classes,
    List<UmlRelation>? relations,
    DateTime? updatedAt,
  })  : classes = classes ?? [],
        relations = relations ?? [],
        updatedAt = updatedAt ?? DateTime.now();

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'classes': classes.map((c) => c.toJson()).toList(),
    'relations': relations.map((r) => r.toJson()).toList(),
    'updatedAt': updatedAt.toIso8601String(),
  };

  factory UmlDiagram.fromJson(Map<String, dynamic> json) => UmlDiagram(
    id: json['id'] ?? 'diag_1',
    name: json['name'] ?? 'Nuevo Diagrama',
    description: json['description'] ?? '',
    classes: (json['classes'] as List<dynamic>?)
            ?.map((c) => UmlClass.fromJson(c))
            .toList() ??
        [],
    relations: (json['relations'] as List<dynamic>?)
            ?.map((r) => UmlRelation.fromJson(r))
            .toList() ??
        [],
    updatedAt: json['updatedAt'] != null
        ? DateTime.tryParse(json['updatedAt']) ?? DateTime.now()
        : DateTime.now(),
  );

  String toFormattedJson() => const JsonEncoder.withIndent('  ').convert(toJson());
}

/// Resumen de Proyecto para Dashboard
class ProjectSummary {
  final String id;
  String name;
  String description;
  String ownerId;
  String ownerName;
  bool isCollaborative;
  List<ProjectMember> members;
  int classCount;
  int relationCount;
  DateTime lastModified;

  ProjectSummary({
    required this.id,
    required this.name,
    required this.description,
    this.ownerId = 'usr_pedro_01',
    this.ownerName = 'Ing. Pedro Quispe',
    this.isCollaborative = false,
    List<ProjectMember>? members,
    this.classCount = 0,
    this.relationCount = 0,
    DateTime? lastModified,
  }) : members = members ?? [],
       lastModified = lastModified ?? DateTime.now();

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'ownerId': ownerId,
    'ownerName': ownerName,
    'isCollaborative': isCollaborative,
    'members': members.map((m) => m.toJson()).toList(),
    'classCount': classCount,
    'relationCount': relationCount,
    'lastModified': lastModified.toIso8601String(),
  };

  factory ProjectSummary.fromJson(Map<String, dynamic> json) {
    List<ProjectMember> parsedMembers = [];
    final rawList = json['members'] ?? json['colaboradores'];
    if (rawList != null && rawList is List) {
      try {
        parsedMembers = rawList
            .map((m) => ProjectMember.fromJson(m as Map<String, dynamic>))
            .toList();
      } catch (_) {}
    }

    final cCount = json['classCount'] ?? json['totalClases'] ?? 0;
    final rCount = json['relationCount'] ?? json['totalRelaciones'] ?? 0;
    final modStr = json['lastModified'] ?? json['updatedAt'] ?? json['createdAt'];

    return ProjectSummary(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Proyecto',
      description: json['description'] ?? '',
      ownerId: json['ownerId'] ?? 'usr_carlos',
      ownerName: json['ownerName'] ?? 'Propietario',
      isCollaborative: json['isCollaborative'] ?? parsedMembers.isNotEmpty,
      members: parsedMembers,
      classCount: cCount is int ? cCount : int.tryParse(cCount.toString()) ?? 0,
      relationCount: rCount is int ? rCount : int.tryParse(rCount.toString()) ?? 0,
      lastModified: modStr != null
          ? DateTime.tryParse(modStr.toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}
