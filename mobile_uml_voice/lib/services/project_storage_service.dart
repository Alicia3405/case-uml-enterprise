import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/auth_models.dart';
import '../models/uml_models.dart';
import 'api_sync_helper.dart';

/// Servicio de Persistencia Local y Sincronización REST con Backend
class ProjectStorageService {
  static final ProjectStorageService _instance = ProjectStorageService._internal();
  factory ProjectStorageService() => _instance;
  ProjectStorageService._internal();

  static const String _projectsKey = 'case_enterprise_projects';
  static const String _legacyProjectsKey = 'case_mobile_projects';
  static const String _activeDiagramKey = 'case_mobile_active_diagram_';

  /// Obtiene la lista de proyectos guardados y sincroniza con el backend
  Future<List<ProjectSummary>> getProjects() async {
    final prefs = await SharedPreferences.getInstance();
    List<ProjectSummary> localProjects = [];

    var raw = prefs.getString(_projectsKey);
    if (raw == null || raw.isEmpty) {
      raw = prefs.getString(_legacyProjectsKey);
    }

    if (raw != null && raw.isNotEmpty) {
      try {
        final List<dynamic> list = jsonDecode(raw);
        localProjects = list.map((item) => ProjectSummary.fromJson(item as Map<String, dynamic>)).toList();
      } catch (e) {
        debugPrint('Error leyendo proyectos locales: $e');
      }
    }

    // Sincronizar con backend REST en AWS EC2
    try {
      final backendResp = await ApiSyncHelper.httpGet('/api/v1/proyectos');
      if (backendResp != null && backendResp.isNotEmpty) {
        final decoded = jsonDecode(backendResp);
        final dynamic rawList = (decoded is Map && decoded['datos'] != null)
            ? decoded['datos']
            : (decoded is List ? decoded : null);

        if (rawList != null && rawList is List) {
          final List<ProjectSummary> backendProjects = rawList
              .map((item) => ProjectSummary.fromJson(item as Map<String, dynamic>))
              .toList();

          final mergedMap = <String, ProjectSummary>{};
          for (final bp in backendProjects) {
            if (bp.id.isNotEmpty) mergedMap[bp.id] = bp;
          }
          for (final lp in localProjects) {
            if (!mergedMap.containsKey(lp.id) && lp.id.isNotEmpty) {
              mergedMap[lp.id] = lp;
            } else if (mergedMap.containsKey(lp.id)) {
              // Fusionar colaboradores
              final existing = mergedMap[lp.id]!;
              final colabMap = <String, ProjectMember>{};
              for (final m in existing.members) {
                colabMap[m.userId.toLowerCase()] = m;
              }
              for (final m in lp.members) {
                if (!colabMap.containsKey(m.userId.toLowerCase())) {
                  existing.members.add(m);
                }
              }
            }
          }

          final mergedList = mergedMap.values.toList();
          await prefs.setString(_projectsKey, jsonEncode(mergedList.map((p) => p.toJson()).toList()));
          return mergedList;
        }
      }
    } catch (e) {
      debugPrint('Error sincronizando con backend: $e');
    }

    final catalog = [
      ProjectSummary(
        id: 'proj_plasfi_2026',
        name: 'plasfi',
        description: 'Modelo conceptual UML 2.5',
        ownerId: 'usr_sofia',
        ownerName: 'Sofía Rojas',
        classCount: 0,
        relationCount: 0,
        isCollaborative: true,
        members: [
          ProjectMember(userId: 'usr_laura', username: 'laura', nombreCompleto: 'Dra. Laura Paredes', role: 'EDITOR', canDownloadBackend: true),
          ProjectMember(userId: 'usr_carlos', username: 'carlos', nombreCompleto: 'Ing. Carlos Mendoza', role: 'EDITOR', canDownloadBackend: true),
          ProjectMember(userId: 'usr_pedro', username: 'pedro', nombreCompleto: 'Ing. Pedro Quispe', role: 'VIEWER', canDownloadBackend: false),
        ],
      ),
      ProjectSummary(
        id: 'proj_vet_2026',
        name: 'Sistema de Veterinaria',
        description: 'Modelo conceptual UML 2.5',
        ownerId: 'usr_sofia',
        ownerName: 'Sofía Rojas',
        classCount: 3,
        relationCount: 2,
        isCollaborative: true,
        members: [
          ProjectMember(userId: 'usr_laura', username: 'laura', nombreCompleto: 'Dra. Laura Paredes', role: 'EDITOR', canDownloadBackend: true),
          ProjectMember(userId: 'usr_carlos', username: 'carlos', nombreCompleto: 'Ing. Carlos Mendoza', role: 'EDITOR', canDownloadBackend: true),
          ProjectMember(userId: 'usr_pedro', username: 'pedro', nombreCompleto: 'Ing. Pedro Quispe', role: 'VIEWER', canDownloadBackend: false),
        ],
      ),
      ProjectSummary(
        id: 'proj_salud_2026',
        name: 'Sistema de Gestión - Modelo Conceptual',
        description: 'Modelo conceptual de datos UML 2.5 para consultas, médicos y pacientes.',
        ownerId: 'usr_carlos',
        ownerName: 'Ing. Carlos Mendoza',
        classCount: 4,
        relationCount: 3,
        isCollaborative: true,
        members: [
          ProjectMember(userId: 'usr_laura', username: 'laura', nombreCompleto: 'Dra. Laura Paredes', role: 'EDITOR', canDownloadBackend: true),
          ProjectMember(userId: 'usr_pedro', username: 'pedro', nombreCompleto: 'Ing. Pedro Quispe', role: 'VIEWER', canDownloadBackend: false),
          ProjectMember(userId: 'usr_sofia', username: 'sofia', nombreCompleto: 'Sofía Rojas', role: 'EDITOR', canDownloadBackend: true),
        ],
      ),
      ProjectSummary(
        id: 'proj_ecommerce_2026',
        name: 'Plataforma de Facturación y Pedidos',
        description: 'Diagrama de clases para el módulo de pagos y comprobantes fiscales.',
        ownerId: 'usr_carlos',
        ownerName: 'Ing. Carlos Mendoza',
        classCount: 5,
        relationCount: 4,
        isCollaborative: true,
        members: [
          ProjectMember(userId: 'usr_laura', username: 'laura', nombreCompleto: 'Dra. Laura Paredes', role: 'VIEWER', canDownloadBackend: false),
          ProjectMember(userId: 'usr_sofia', username: 'sofia', nombreCompleto: 'Sofía Rojas', role: 'EDITOR', canDownloadBackend: true),
        ],
      ),
      ProjectSummary(
        id: 'proj_farmacia_2026',
        name: 'Modelo Importado Enterprise Architect',
        description: 'Control de stocks de medicamentos, lotes y prescripciones médicas.',
        ownerId: 'usr_pedro',
        ownerName: 'Ing. Pedro Quispe',
        classCount: 4,
        relationCount: 3,
        isCollaborative: true,
        members: [
          ProjectMember(userId: 'usr_carlos', username: 'carlos', nombreCompleto: 'Ing. Carlos Mendoza', role: 'EDITOR', canDownloadBackend: true),
          ProjectMember(userId: 'usr_laura', username: 'laura', nombreCompleto: 'Dra. Laura Paredes', role: 'EDITOR', canDownloadBackend: true),
          ProjectMember(userId: 'usr_sofia', username: 'sofia', nombreCompleto: 'Sofía Rojas', role: 'EDITOR', canDownloadBackend: true),
        ],
      ),
      ProjectSummary(
        id: 'proj_laboratorio_2026',
        name: 'Gestión de Laboratorio Clínico y Muestras',
        description: 'Modelo de entidades UML para análisis de sangre, reactivos y resultados.',
        ownerId: 'usr_laura',
        ownerName: 'Dra. Laura Paredes',
        classCount: 3,
        relationCount: 2,
        isCollaborative: true,
        members: [
          ProjectMember(userId: 'usr_carlos', username: 'carlos', nombreCompleto: 'Ing. Carlos Mendoza', role: 'EDITOR', canDownloadBackend: true),
          ProjectMember(userId: 'usr_pedro', username: 'pedro', nombreCompleto: 'Ing. Pedro Quispe', role: 'VIEWER', canDownloadBackend: false),
          ProjectMember(userId: 'usr_sofia', username: 'sofia', nombreCompleto: 'Sofía Rojas', role: 'EDITOR', canDownloadBackend: true),
        ],
      ),
    ];

    // Asegurar que todos los proyectos del catálogo estén presentes
    final mergedMap = <String, ProjectSummary>{};
    for (final catP in catalog) {
      mergedMap[catP.id] = catP;
    }
    for (final lp in localProjects) {
      if (lp.id.isNotEmpty) {
        if (mergedMap.containsKey(lp.id)) {
          // Mantener o fusionar miembros si se añadieron dinámicamente
          final base = mergedMap[lp.id]!;
          for (final m in lp.members) {
            if (!base.members.any((x) => x.userId.toLowerCase() == m.userId.toLowerCase())) {
              base.members.add(m);
            }
          }
        } else {
          mergedMap[lp.id] = lp;
        }
      }
    }

    final finalResult = mergedMap.values.toList();
    await prefs.setString(_projectsKey, jsonEncode(finalResult.map((p) => p.toJson()).toList()));
    return finalResult;
  }

  /// Guarda la lista de proyectos localmente y la sincroniza con el backend
  Future<void> saveProjects(List<ProjectSummary> projects) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = jsonEncode(projects.map((p) => p.toJson()).toList());
    await prefs.setString(_projectsKey, jsonStr);

    // Push al backend
    try {
      final payload = projects.map((p) => {
        'id': p.id,
        'name': p.name,
        'description': p.description,
        'ownerId': p.ownerId,
        'ownerName': p.ownerName,
        'totalClases': p.classCount,
        'totalRelaciones': p.relationCount,
        'updatedAt': p.lastModified.toIso8601String(),
        'colaboradores': p.members.map((m) => {
          'userId': m.userId,
          'username': m.username,
          'nombreCompleto': m.nombreCompleto,
          'color': m.color,
          'permission': m.role,
          'canDownloadBackend': m.canDownloadBackend,
        }).toList(),
      }).toList();
      await ApiSyncHelper.httpPostList('/api/v1/proyectos', payload);
    } catch (_) {}
  }

  /// Carga un diagrama específico por ID
  Future<UmlDiagram?> loadDiagram(String projectId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('$_activeDiagramKey$projectId');
    if (raw == null || raw.isEmpty) return null;
    try {
      final Map<String, dynamic> data = jsonDecode(raw);
      return UmlDiagram.fromJson(data);
    } catch (e) {
      return null;
    }
  }

  /// Guarda un diagrama en almacenamiento local y actualiza métricas
  Future<void> saveDiagram(String projectId, UmlDiagram diagram) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = jsonEncode(diagram.toJson());
    await prefs.setString('$_activeDiagramKey$projectId', jsonStr);

    // Actualizar resumen en la lista de proyectos
    final projects = await getProjects();
    final idx = projects.indexWhere((p) => p.id == projectId);
    if (idx >= 0) {
      projects[idx].name = diagram.name;
      projects[idx].description = diagram.description;
      projects[idx].classCount = diagram.classes.length;
      projects[idx].relationCount = diagram.relations.length;
      projects[idx].lastModified = DateTime.now();
      await saveProjects(projects);
    }
  }

  /// Importa un diagrama a partir de una cadena JSON (compatible con Web Angular)
  UmlDiagram importFromJson(String rawJson) {
    final Map<String, dynamic> data = jsonDecode(rawJson);
    return UmlDiagram.fromJson(data);
  }
}
