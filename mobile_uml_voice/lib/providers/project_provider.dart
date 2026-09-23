import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../models/auth_models.dart';
import '../models/uml_models.dart';
import '../services/auth_service.dart';
import '../services/project_storage_service.dart';
import '../services/tts_service.dart';
import '../services/uml_ai_generator.dart';
import '../services/uml_voice_commander.dart';

class ProjectProvider extends ChangeNotifier {
  final _storage = ProjectStorageService();
  final _tts = TtsService();
  final _uuid = const Uuid();

  List<ProjectSummary> _projects = [];
  ProjectSummary? _activeProject;
  UmlDiagram _activeDiagram = UmlDiagram(id: 'default', name: 'Nuevo Diagrama UML');
  bool _isLoading = false;
  bool _isReadOnly = false;

  // Historial para Deshacer
  final List<String> _history = [];

  // Diálogo de voz segregado estrictamente por usuario
  final Map<String, List<Map<String, String>>> _userVoiceDialogues = {};

  List<ProjectSummary> get projects => _projects;
  ProjectSummary? get activeProject => _activeProject;
  UmlDiagram get activeDiagram => _activeDiagram;
  bool get isLoading => _isLoading;
  bool get isReadOnly => _isReadOnly;

  List<Map<String, String>> get voiceDialogue {
    final curUser = AuthService().currentUser;
    final uid = curUser?.id ?? 'usr_pedro_01';
    if (!_userVoiceDialogues.containsKey(uid)) {
      _loadVoiceDialogueForUser(uid);
      return [];
    }
    return _userVoiceDialogues[uid] ?? [];
  }

  Future<void> _loadVoiceDialogueForUser(String userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('case_voice_dialogue_$userId');
      if (raw != null && raw.isNotEmpty) {
        final List<dynamic> list = jsonDecode(raw);
        _userVoiceDialogues[userId] = list.map((item) => Map<String, String>.from(item)).toList();
      } else {
        _userVoiceDialogues[userId] = [];
      }
    } catch (_) {
      _userVoiceDialogues[userId] = [];
    }
    notifyListeners();
  }

  Future<void> _saveVoiceDialogue(String userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = _userVoiceDialogues[userId] ?? [];
      await prefs.setString('case_voice_dialogue_$userId', jsonEncode(list));
    } catch (_) {}
  }

  void setReadOnly(bool val) {
    _isReadOnly = val;
    notifyListeners();
  }

  Timer? _bgSyncTimer;

  ProjectProvider() {
    loadProjects();
    _startBackgroundSync();
  }

  void _startBackgroundSync() {
    _bgSyncTimer?.cancel();
    _bgSyncTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      try {
        final updated = await _storage.getProjects();
        if (updated.isNotEmpty && (updated.length != _projects.length || !_areProjectListsEqual(_projects, updated))) {
          _projects = updated;
          notifyListeners();
        }
      } catch (_) {}
    });
  }

  bool _areProjectListsEqual(List<ProjectSummary> a, List<ProjectSummary> b) {
    if (a.length != b.length) return false;
    for (int i = 0; i < a.length; i++) {
      if (a[i].id != b[i].id || 
          a[i].name != b[i].name || 
          a[i].members.length != b[i].members.length ||
          a[i].classCount != b[i].classCount) {
        return false;
      }
    }
    return true;
  }

  @override
  void dispose() {
    _bgSyncTimer?.cancel();
    super.dispose();
  }

  Future<void> loadProjects() async {
    _isLoading = true;
    notifyListeners();
    _projects = await _storage.getProjects();
    final curUser = AuthService().currentUser;
    final currentUserId = (curUser?.id ?? 'usr_laura').toLowerCase().trim();
    final currentUsername = (curUser?.username ?? 'laura').toLowerCase().trim();
    final usrPrefixed = 'usr_$currentUsername';

    await _loadVoiceDialogueForUser(currentUserId);
    final userProjects = _projects.where((p) {
      final owner = p.ownerId.toLowerCase().trim();
      final isOwner = owner == currentUserId || owner == currentUsername || owner == usrPrefixed || 'usr_$owner' == currentUserId;
      final isMember = p.members.any((m) {
        final mId = m.userId.toLowerCase().trim();
        final mUsername = m.username.toLowerCase().trim();
        return mId == currentUserId || mId == currentUsername || mUsername == currentUsername || mUsername == currentUserId;
      });
      return isOwner || isMember;
    }).toList();

    if (userProjects.isNotEmpty) {
      await openProject(userProjects.first.id, readOnly: false);
    } else if (_projects.isNotEmpty && _activeProject == null) {
      await openProject(_projects.first.id, readOnly: false);
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> switchUserProjects(String userId) async {
    await _loadVoiceDialogueForUser(userId);
    final userProjects = _projects.where((p) => p.ownerId == userId).toList();
    if (userProjects.isNotEmpty) {
      await openProject(userProjects.first.id, readOnly: false);
    } else {
      _activeProject = null;
      _activeDiagram = UmlDiagram(
        id: 'proj_${_uuid.v4().substring(0, 8)}',
        name: 'Nuevo Proyecto UML',
        description: 'Diagrama UML en blanco',
      );
      _isReadOnly = false;
      notifyListeners();
    }
  }

  Future<void> openProject(String projectId, {bool readOnly = false}) async {
    _isLoading = true;
    _isReadOnly = readOnly;
    notifyListeners();

    _activeProject = _projects.firstWhere(
      (p) => p.id == projectId,
      orElse: () => _projects.first,
    );

    final loaded = await _storage.loadDiagram(projectId);
    if (loaded != null) {
      _activeDiagram = loaded;
    } else {
      // Si no existe, inicializar con el caso veterinario por defecto si es demo
      if (projectId == 'proj_vet_demo') {
        final res = UmlAiGenerator.generateFromPrompt('veterinaria');
        _activeDiagram = UmlDiagram(
          id: projectId,
          name: res.diagramName,
          description: res.description,
          classes: res.classes,
          relations: res.relations,
        );
      } else if (projectId == 'proj_hotel_demo') {
        final res = UmlAiGenerator.generateFromPrompt('hoteleria');
        _activeDiagram = UmlDiagram(
          id: projectId,
          name: res.diagramName,
          description: res.description,
          classes: res.classes,
          relations: res.relations,
        );
      } else {
        _activeDiagram = UmlDiagram(
          id: projectId,
          name: _activeProject!.name,
          description: _activeProject!.description,
        );
      }
      await _storage.saveDiagram(projectId, _activeDiagram);
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> createProject(String name, String description) async {
    final curUser = AuthService().currentUser;
    final ownerId = curUser?.id ?? 'usr_pedro_01';
    final ownerName = curUser?.nombreCompleto ?? 'Ing. Pedro Quispe';

    final pId = 'proj_${_uuid.v4().substring(0, 8)}';
    final newP = ProjectSummary(
      id: pId,
      name: name.trim().isEmpty ? 'Nuevo Proyecto UML' : name.trim(),
      description: description,
      ownerId: ownerId,
      ownerName: ownerName,
      classCount: 0,
      relationCount: 0,
    );
    _projects.insert(0, newP);
    await _storage.saveProjects(_projects);
    await openProject(pId, readOnly: false);
  }

  void _saveSnapshot() {
    try {
      _history.add(jsonEncode(_activeDiagram.toJson()));
      if (_history.length > 20) _history.removeAt(0);
    } catch (e) {
      debugPrint('Error en snapshot: $e');
    }
  }

  void undo() {
    if (_history.isEmpty) {
      _tts.speak('No hay acciones previas para deshacer.');
      return;
    }
    final snap = _history.removeLast();
    _activeDiagram = UmlDiagram.fromJson(jsonDecode(snap));
    _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
    _tts.speak('Acción deshecha.');
    notifyListeners();
  }

  // Guardar explícitamente el proyecto actual
  Future<void> saveCurrentProject() async {
    if (_activeProject != null) {
      _activeProject!.classCount = _activeDiagram.classes.length;
      _activeProject!.relationCount = _activeDiagram.relations.length;
      _activeProject!.lastModified = DateTime.now();
      await _storage.saveProjects(_projects);
      await _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
      notifyListeners();
    }
  }

  // =========================================================================
  // CANAL 1: GENERADOR DE ARQUITECTURA IA POR PROMPT Y VOZ
  // =========================================================================
  Future<void> executeAiArchitecturePrompt(String prompt) async {
    if (prompt.trim().isEmpty) return;
    if (_isReadOnly) {
      await _tts.speak('Proyecto en modo solo lectura. No se permiten modificaciones.');
      return;
    }
    _saveSnapshot();

    final result = UmlAiGenerator.generateFromPrompt(prompt);

    final curUser = AuthService().currentUser;
    final ownerId = curUser?.id ?? 'usr_pedro_01';
    final ownerName = curUser?.nombreCompleto ?? 'Ing. Pedro Quispe';

    // Si ya existe un proyecto con clases, guardamos el anterior y creamos un NUEVO proyecto independiente para no sobrescribirlo
    final bool shouldCreateNew = _activeProject == null || 
        _activeDiagram.classes.isNotEmpty || 
        !_activeProject!.name.contains('Nuevo Proyecto');

    if (shouldCreateNew) {
      // Guardar el proyecto anterior si existía
      if (_activeProject != null) {
        await _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
      }

      final newPId = 'proj_${_uuid.v4().substring(0, 8)}';
      final newSummary = ProjectSummary(
        id: newPId,
        name: result.diagramName,
        description: result.description,
        ownerId: ownerId,
        ownerName: ownerName,
        classCount: result.classes.length,
        relationCount: result.relations.length,
        lastModified: DateTime.now(),
        isCollaborative: false,
      );

      _projects.insert(0, newSummary);
      _activeProject = newSummary;

      _activeDiagram = UmlDiagram(
        id: newPId,
        name: result.diagramName,
        description: result.description,
        classes: result.classes,
        relations: result.relations,
        updatedAt: DateTime.now(),
      );

      await _storage.saveProjects(_projects);
      await _storage.saveDiagram(newPId, _activeDiagram);
    } else {
      // Usar el proyecto vacío inicial
      _activeDiagram.name = result.diagramName;
      _activeDiagram.description = result.description;
      _activeDiagram.classes = result.classes;
      _activeDiagram.relations = result.relations;
      _activeDiagram.updatedAt = DateTime.now();

      _activeProject!.name = result.diagramName;
      _activeProject!.description = result.description;
      _activeProject!.classCount = result.classes.length;
      _activeProject!.relationCount = result.relations.length;

      await _storage.saveProjects(_projects);
      await _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
    }

    // Diálogo de voz segregado por usuario
    final uid = ownerId;
    final entry = {
      'type': 'ai',
      'user': prompt,
      'response': result.speechResponse,
      'time': '${DateTime.now().hour}:${DateTime.now().minute.toString().padLeft(2, "0")}',
    };
    _userVoiceDialogues.putIfAbsent(uid, () => []).insert(0, entry);
    _saveVoiceDialogue(uid);

    notifyListeners();

    // Respuesta auditiva
    await _tts.speak(result.speechResponse);
  }

  // =========================================================================
  // CANAL 2: COMANDO DE VOZ ATÓMICO EN TIEMPO REAL
  // =========================================================================
  Future<void> executeAtomicVoiceCommand(String command) async {
    if (command.trim().isEmpty) return;

    if (_isReadOnly) {
      await _tts.speak('Proyecto en modo solo lectura. No puedes modificar el diagrama.');
      return;
    }

    if (command.toLowerCase().trim() == 'deshacer') {
      undo();
      return;
    }

    _saveSnapshot();

    final result = UmlVoiceCommander.executeCommand(command, _activeDiagram);
    if (result.success) {
      await _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
    }

    // Diálogo de voz segregado por usuario
    final curUser = AuthService().currentUser;
    final uid = curUser?.id ?? 'usr_pedro_01';
    final entry = {
      'type': 'command',
      'user': command,
      'response': result.speechResponse,
      'time': '${DateTime.now().hour}:${DateTime.now().minute.toString().padLeft(2, "0")}',
    };
    _userVoiceDialogues.putIfAbsent(uid, () => []).insert(0, entry);
    _saveVoiceDialogue(uid);

    notifyListeners();

    // Respuesta auditiva
    await _tts.speak(result.speechResponse);
  }

  // Actualizar posición de clase arrastrada
  void updateClassPosition(String classId, Offset newPos) {
    if (_isReadOnly) return;
    final idx = _activeDiagram.classes.indexWhere((c) => c.id == classId);
    if (idx >= 0) {
      _activeDiagram.classes[idx].position = newPos;
      notifyListeners();
    }
  }

  void saveAfterDrag() {
    if (_isReadOnly) return;
    _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
  }

  // =========================================================================
  // MÉTODOS DE MANIPULACIÓN MANUAL (HERRAMIENTAS UML)
  // =========================================================================

  void addClassManual(UmlClass cls) {
    if (_isReadOnly) {
      _tts.speak('Modo solo lectura. No puedes agregar clases.');
      return;
    }
    _saveSnapshot();
    _activeDiagram.classes.add(cls);
    _activeDiagram.updatedAt = DateTime.now();
    _syncProjectMetrics();
    _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
    notifyListeners();
  }

  void updateClass(UmlClass updatedClass) {
    if (_isReadOnly) {
      _tts.speak('Modo solo lectura. No puedes modificar clases.');
      return;
    }
    _saveSnapshot();
    final idx = _activeDiagram.classes.indexWhere((c) => c.id == updatedClass.id);
    if (idx >= 0) {
      _activeDiagram.classes[idx] = updatedClass;
      _activeDiagram.updatedAt = DateTime.now();
      _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
      notifyListeners();
    }
  }

  void deleteClass(String classId) {
    if (_isReadOnly) {
      _tts.speak('Modo solo lectura. No puedes eliminar clases.');
      return;
    }
    _saveSnapshot();
    _activeDiagram.classes.removeWhere((c) => c.id == classId);
    _activeDiagram.relations.removeWhere((r) => r.sourceClassId == classId || r.targetClassId == classId);
    _activeDiagram.updatedAt = DateTime.now();
    _syncProjectMetrics();
    _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
    notifyListeners();
  }

  void addRelation(UmlRelation rel) {
    if (_isReadOnly) {
      _tts.speak('Modo solo lectura. No puedes conectar clases.');
      return;
    }
    _saveSnapshot();
    _activeDiagram.relations.add(rel);
    _activeDiagram.updatedAt = DateTime.now();
    _syncProjectMetrics();
    _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
    notifyListeners();
  }

  void deleteRelation(String relationId) {
    if (_isReadOnly) {
      _tts.speak('Modo solo lectura. No puedes eliminar relaciones.');
      return;
    }
    _saveSnapshot();
    _activeDiagram.relations.removeWhere((r) => r.id == relationId);
    _activeDiagram.updatedAt = DateTime.now();
    _syncProjectMetrics();
    _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
    notifyListeners();
  }

  void clearCanvas() {
    if (_isReadOnly) {
      _tts.speak('Modo solo lectura. No puedes limpiar el lienzo.');
      return;
    }
    _saveSnapshot();
    _activeDiagram.classes.clear();
    _activeDiagram.relations.clear();
    _activeDiagram.updatedAt = DateTime.now();
    _syncProjectMetrics();
    _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
    notifyListeners();
  }

  void _syncProjectMetrics() {
    if (_activeProject != null) {
      _activeProject!.classCount = _activeDiagram.classes.length;
      _activeProject!.relationCount = _activeDiagram.relations.length;
      _activeProject!.lastModified = DateTime.now();
      _storage.saveProjects(_projects);
    }
  }

  Future<void> loadImportedDiagram(UmlDiagram diagram) async {
    _saveSnapshot();
    _activeDiagram = diagram;
    if (_activeProject != null) {
      _activeProject!.name = diagram.name;
      _activeProject!.classCount = diagram.classes.length;
      _activeProject!.relationCount = diagram.relations.length;
      _activeProject!.lastModified = DateTime.now();
    }
    await _storage.saveDiagram(_activeDiagram.id, _activeDiagram);
    await _storage.saveProjects(_projects);
    notifyListeners();
  }

  // Limpiar diálogo de voz del usuario activo
  void clearDialogue() {
    final curUser = AuthService().currentUser;
    final uid = curUser?.id ?? 'usr_pedro_01';
    _userVoiceDialogues[uid]?.clear();
    _saveVoiceDialogue(uid);
    notifyListeners();
  }

  // =========================================================================
  // GESTIÓN DE COLABORADORES & INVITACIONES (100% PERSISTENTE EN STORAGE)
  // =========================================================================
  Future<void> addCollaborator(String projectId, ProjectMember member) async {
    final pIdx = _projects.indexWhere((p) => p.id == projectId);
    if (pIdx >= 0) {
      final p = _projects[pIdx];
      final mIdx = p.members.indexWhere((m) => m.userId == member.userId);
      if (mIdx >= 0) {
        p.members[mIdx] = member;
      } else {
        p.members.add(member);
      }
      p.isCollaborative = true;
      await _storage.saveProjects(_projects);
      notifyListeners();
    }
  }

  Future<void> removeCollaborator(String projectId, String userId) async {
    final pIdx = _projects.indexWhere((p) => p.id == projectId);
    if (pIdx >= 0) {
      final p = _projects[pIdx];
      p.members.removeWhere((m) => m.userId == userId);
      final hasOtherMembers = p.members.any((m) => m.userId != p.ownerId);
      p.isCollaborative = hasOtherMembers;
      await _storage.saveProjects(_projects);
      notifyListeners();
    }
  }

  Future<void> updateCollaboratorRole(String projectId, String userId, String newRole) async {
    final pIdx = _projects.indexWhere((p) => p.id == projectId);
    if (pIdx >= 0) {
      final p = _projects[pIdx];
      final mIdx = p.members.indexWhere((m) => m.userId == userId);
      if (mIdx >= 0) {
        p.members[mIdx].role = newRole;
        if (newRole == 'VIEWER') {
          p.members[mIdx].canDownloadBackend = false;
        }
        await _storage.saveProjects(_projects);
        notifyListeners();
      }
    }
  }

  Future<void> updateCollaboratorZip(String projectId, String userId, bool canDownload) async {
    final pIdx = _projects.indexWhere((p) => p.id == projectId);
    if (pIdx >= 0) {
      final p = _projects[pIdx];
      final mIdx = p.members.indexWhere((m) => m.userId == userId);
      if (mIdx >= 0) {
        p.members[mIdx].canDownloadBackend = canDownload;
        await _storage.saveProjects(_projects);
        notifyListeners();
      }
    }
  }

  Future<void> acceptInvitation(String projectId, String userId) async {
    final pIdx = _projects.indexWhere((p) => p.id == projectId);
    if (pIdx >= 0) {
      final p = _projects[pIdx];
      final mIdx = p.members.indexWhere((m) => m.userId == userId || m.username.toLowerCase() == userId.toLowerCase());
      if (mIdx >= 0) {
        p.members[mIdx].status = 'ACEPTADA';
        p.isCollaborative = true;
        await _storage.saveProjects(_projects);
        notifyListeners();
      }
    }
  }

  Future<void> rejectInvitation(String projectId, String userId) async {
    final pIdx = _projects.indexWhere((p) => p.id == projectId);
    if (pIdx >= 0) {
      final p = _projects[pIdx];
      p.members.removeWhere((m) => m.userId == userId || m.username.toLowerCase() == userId.toLowerCase());
      final hasOtherMembers = p.members.any((m) => m.userId != p.ownerId);
      p.isCollaborative = hasOtherMembers;
      await _storage.saveProjects(_projects);
      notifyListeners();
    }
  }
}
