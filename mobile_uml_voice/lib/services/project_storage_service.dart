import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/auth_models.dart';
import '../models/uml_models.dart';

/// Servicio de Persistencia Local e Interoperabilidad JSON
class ProjectStorageService {
  static final ProjectStorageService _instance = ProjectStorageService._internal();
  factory ProjectStorageService() => _instance;
  ProjectStorageService._internal();

  static const String _projectsKey = 'case_mobile_projects';
  static const String _activeDiagramKey = 'case_mobile_active_diagram_';

  /// Obtiene la lista de proyectos guardados
  Future<List<ProjectSummary>> getProjects() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_projectsKey);
    if (raw == null || raw.isEmpty) {
      // Proyectos iniciales de demostración
      final initial = [
        ProjectSummary(
          id: 'proj_vet_demo',
          name: 'Clínica Veterinaria (Caso Oficial)',
          description: 'Modelo conceptual del examen con Cliente, Mascota, Veterinario y Citas.',
          ownerId: 'usr_pedro_01',
          ownerName: 'Ing. Pedro Quispe',
          classCount: 4,
          relationCount: 3,
          isCollaborative: true,
          members: [
            ProjectMember(
              userId: 'usr_pedro_01',
              username: 'pedro.quispe',
              nombreCompleto: 'Ing. Pedro Quispe',
              role: 'OWNER',
              status: 'ACEPTADA',
              color: '#38BDF8',
              canDownloadBackend: true,
            ),
            ProjectMember(
              userId: 'usr_maria_02',
              username: 'maria.lopez',
              nombreCompleto: 'Ing. María López',
              role: 'EDITOR',
              status: 'ACEPTADA',
              color: '#EC4899',
              canDownloadBackend: true,
            ),
            ProjectMember(
              userId: 'usr_carlos_03',
              username: 'carlos.gomez',
              nombreCompleto: 'Ing. Carlos Gómez',
              role: 'VIEWER',
              status: 'PENDIENTE',
              color: '#10B981',
              canDownloadBackend: false,
            ),
          ],
        ),
        ProjectSummary(
          id: 'proj_hotel_demo',
          name: 'Sistema de Hotelería',
          description: 'Gestión hotelera con Hotel, Habitaciones, Huéspedes y Reservas.',
          ownerId: 'usr_maria_02',
          ownerName: 'Ing. María López',
          classCount: 5,
          relationCount: 4,
          isCollaborative: true,
          members: [
            ProjectMember(
              userId: 'usr_maria_02',
              username: 'maria.lopez',
              nombreCompleto: 'Ing. María López',
              role: 'OWNER',
              status: 'ACEPTADA',
              color: '#EC4899',
              canDownloadBackend: true,
            ),
            ProjectMember(
              userId: 'usr_pedro_01',
              username: 'pedro.quispe',
              nombreCompleto: 'Ing. Pedro Quispe',
              role: 'VIEWER',
              status: 'ACEPTADA',
              color: '#38BDF8',
              canDownloadBackend: false,
            ),
          ],
        ),
      ];
      await saveProjects(initial);
      return initial;
    }

    try {
      final List<dynamic> list = jsonDecode(raw);
      return list.map((item) => ProjectSummary.fromJson(item)).toList();
    } catch (e) {
      return [];
    }
  }

  /// Guarda la lista de proyectos
  Future<void> saveProjects(List<ProjectSummary> projects) async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = jsonEncode(projects.map((p) => p.toJson()).toList());
    await prefs.setString(_projectsKey, jsonStr);
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

  /// Guarda un diagrama en almacenamiento local
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
