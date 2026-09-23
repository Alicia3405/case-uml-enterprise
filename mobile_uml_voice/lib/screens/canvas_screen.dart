import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../models/uml_models.dart';
import '../providers/project_provider.dart';
import '../services/auth_service.dart';
import '../services/collab_lock_service.dart';
import '../services/file_picker_helper.dart';
import '../services/offline_collab_service.dart';
import '../services/spring_boot_zip_service.dart';
import '../services/xmi_service.dart';
import '../widgets/backend_history_sheet.dart';
import '../widgets/class_editor_sheet.dart';
import '../widgets/relation_editor_dialog.dart';
import '../widgets/relation_painter.dart';
import '../widgets/team_collaborators_sheet.dart';
import '../widgets/tutorial_dialog.dart';
import '../widgets/uml_class_box.dart';
import '../widgets/vision_scanner_sheet.dart';
import '../widgets/voice_dock_sheet.dart';

class CanvasScreen extends StatefulWidget {
  final VoidCallback? onStartTour;
  const CanvasScreen({Key? key, this.onStartTour}) : super(key: key);

  @override
  State<CanvasScreen> createState() => _CanvasScreenState();
}

class _CanvasScreenState extends State<CanvasScreen> {
  String? _selectedClassId;
  bool _isDownloadingZip = false;
  final _uuid = const Uuid();
  bool _isOnline = true;
  int _pendingSyncCount = 0;

  @override
  void initState() {
    super.initState();
    OfflineCollabService().addListener(_onOfflineStateChanged);
    CollabLockService().addListener(_onCollabLockChanged);
    CollabLockService().syncLocksFromStorage();
    _isOnline = OfflineCollabService().isOnline;
    _pendingSyncCount = OfflineCollabService().pendingCount;
  }

  @override
  void dispose() {
    OfflineCollabService().removeListener(_onOfflineStateChanged);
    CollabLockService().removeListener(_onCollabLockChanged);
    super.dispose();
  }

  void _onCollabLockChanged() {
    if (mounted) setState(() {});
  }

  void _onOfflineStateChanged() {
    if (mounted) {
      setState(() {
        _isOnline = OfflineCollabService().isOnline;
        _pendingSyncCount = OfflineCollabService().pendingCount;
      });
    }
  }

  void _openVoiceDock() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const VoiceDockSheet(),
    );
  }

  void _openClassInspector(UmlClass cls, ProjectProvider provider) {
    if (provider.isReadOnly) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFFF59E0B),
          content: Text('👁️ Modo Supervisión (Lector): No se pueden modificar clases de otro usuario.'),
        ),
      );
      return;
    }

    final lockService = CollabLockService();
    final currentUser = AuthService().currentUser;
    final currentUserId = currentUser?.id ?? 'guest';
    final currentUserName = currentUser?.nombreCompleto.isNotEmpty == true
        ? currentUser!.nombreCompleto
        : (currentUser?.username ?? 'Colaborador');
    final currentUserColor = currentUser?.color ?? '#38BDF8';

    final existingLock = lockService.getLock(cls.id);
    if (existingLock != null && existingLock.userId != currentUserId) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFFEF4444),
          duration: const Duration(seconds: 4),
          content: Row(
            children: [
              const Icon(Icons.lock, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '🔒 Exclusión mutua activa: La tabla "${cls.name}" está siendo editada por ${existingLock.userName}. Espera a que termine para editarla.',
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      );
      return;
    }

    // Adquirir candado colaborativo real
    lockService.acquireLock(
      classId: cls.id,
      userId: currentUserId,
      userName: currentUserName,
      userColor: currentUserColor,
    );

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => ClassEditorSheet(
        umlClass: cls,
        onSave: (updated) {
          provider.updateClass(updated);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Clase ${updated.name} actualizada con éxito.')),
          );
        },
        onDelete: () {
          provider.deleteClass(cls.id);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Clase ${cls.name} eliminada del lienzo.')),
          );
        },
      ),
    ).whenComplete(() {
      // Liberar candado automáticamente al terminar la edición
      lockService.releaseLock(cls.id, userId: currentUserId);
    });
  }

  void _showAddClassDialog(ProjectProvider provider) {
    if (provider.isReadOnly) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFFF59E0B),
          content: Text('👁️ Modo Supervisión (Lector): No se pueden agregar clases en modo lectura.'),
        ),
      );
      return;
    }
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Nueva Clase UML', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            hintText: 'Nombre de la clase (ej. Factura, Habitacion)',
            hintStyle: TextStyle(color: Color(0xFF64748B)),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton(
            onPressed: () {
              if (ctrl.text.trim().isNotEmpty) {
                final cName = ctrl.text.trim();
                final offset = Offset(
                  150.0 + (provider.activeDiagram.classes.length % 4) * 260.0,
                  150.0 + (provider.activeDiagram.classes.length ~/ 4) * 230.0,
                );
                final newClass = UmlClass(
                  id: 'cls_${_uuid.v4().substring(0, 8)}',
                  name: cName[0].toUpperCase() + cName.substring(1),
                  position: offset,
                  attributes: [
                    UmlAttribute(id: 'a_${_uuid.v4().substring(0, 6)}', name: 'id', type: 'Long', isPrimaryKey: true),
                    UmlAttribute(id: 'a_${_uuid.v4().substring(0, 6)}', name: 'nombre', type: 'String'),
                  ],
                  methods: [
                    UmlMethod(id: 'm_${_uuid.v4().substring(0, 6)}', name: 'procesar', returnType: 'void'),
                  ],
                );
                provider.addClassManual(newClass);
                Navigator.pop(ctx);
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
            child: const Text('Crear Clase', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showConnectDialog(ProjectProvider provider) {
    if (provider.isReadOnly) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFFF59E0B),
          content: Text('👁️ Modo Supervisión (Lector): No se pueden conectar clases en modo lectura.'),
        ),
      );
      return;
    }
    if (provider.activeDiagram.classes.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Se necesitan al menos 2 clases en el lienzo para conectarlas.')),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (ctx) => RelationEditorDialog(
        classes: provider.activeDiagram.classes,
        initialSourceId: _selectedClassId,
        onSave: (rel) {
          provider.addRelation(rel);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Conexión UML establecida.')),
          );
        },
      ),
    );
  }

  void _confirmClearCanvas(ProjectProvider provider) {
    if (provider.isReadOnly) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFFF59E0B),
          content: Text('👁️ Modo Supervisión (Lector): No se puede limpiar el lienzo en modo lectura.'),
        ),
      );
      return;
    }
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('¿Limpiar Lienzo?', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: const Text(
          'Se eliminarán todas las clases y relaciones de este diagrama. Podrás deshacer esta acción si lo necesitas.',
          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              provider.clearCanvas();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            child: const Text('Limpiar Todo', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _downloadBackendZip(UmlDiagram diagram) async {
    if (diagram.classes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Crea al menos una clase antes de generar el Backend.')),
      );
      return;
    }

    setState(() => _isDownloadingZip = true);
    final ownerId = AuthService().currentUser?.id ?? 'u1';
    final ok = await SpringBootZipService.generateAndDownloadZip(diagram, ownerId: ownerId);
    if (mounted) {
      setState(() => _isDownloadingZip = false);
      if (ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Text('Backend Spring Boot 3 descargado: ${diagram.name}-springboot.zip'),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFFEF4444),
            content: Text('Error al generar el archivo ZIP.'),
          ),
        );
      }
    }
  }

  void _downloadSchemaSql(UmlDiagram diagram) {
    if (diagram.classes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Crea al menos una clase antes de exportar el DDL SQL.')),
      );
      return;
    }
    SpringBootZipService.downloadSchemaSql(diagram);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFF0EA5E9),
        content: Text('Descargando archivo schema.sql (PostgreSQL DDL)...'),
      ),
    );
  }

  void _downloadPostman(UmlDiagram diagram) {
    if (diagram.classes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Crea al menos una clase antes de exportar la colección Postman.')),
      );
      return;
    }
    SpringBootZipService.downloadPostmanCollection(diagram);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        backgroundColor: Color(0xFFF97316),
        content: Text('Descargando colección Postman v2.1...'),
      ),
    );
  }

  void _showBackendHistorySheet(UmlDiagram diagram) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => BackendHistorySheet(currentDiagram: diagram),
    );
  }

  void _showTeamSheet(String projectId, String projectName) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => TeamCollaboratorsSheet(
        projectId: projectId,
        projectName: projectName,
      ),
    );
  }

  void _showTutorialDialog() {
    if (widget.onStartTour != null) {
      widget.onStartTour!();
    } else {
      showDialog(
        context: context,
        builder: (ctx) => const TutorialDialog(),
      );
    }
  }

  void _toggleOfflineMode() async {
    final s = OfflineCollabService();
    s.toggleConnection();
    if (s.isOnline) {
      final synced = await s.syncPendingMutations();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Text(synced > 0
                ? '🟢 Conexión restablecida: $synced cambios pendientes sincronizados automáticamente.'
                : '🟢 Conexión en línea activa y sincronizada.'),
          ),
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFFEF4444),
            content: Text('🔴 Modo Offline activado: Los cambios se encolan localmente y se sincronizan al recuperar señal.'),
          ),
        );
      }
    }
  }

  void _openVisionScanner() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const VisionScannerSheet(),
    );
  }

  void _exportXmi(UmlDiagram diagram) {
    if (diagram.classes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Crea al menos una clase antes de exportar a Enterprise Architect.')),
      );
      return;
    }
    XmiService.downloadXmi(diagram);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: const Color(0xFF38BDF8),
        content: Text('Exportando archivo XMI 2.1 (Sparx Enterprise Architect): ${diagram.name}_EA.xmi'),
      ),
    );
  }

  Future<void> _importXmi(ProjectProvider provider) async {
    final content = await pickTextFileWeb(extensions: ['xmi', 'xml']);
    if (content != null && content.isNotEmpty) {
      try {
        final imported = XmiService.importFromXmi(content);
        await provider.loadImportedDiagram(imported);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFF10B981),
              content: Text('✅ Diagrama "${imported.name}" importado exitosamente con ${imported.classes.length} clases y ${imported.relations.length} relaciones.'),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFFEF4444),
              content: Text('Error al importar archivo XMI: $e'),
            ),
          );
        }
      }
    }
  }



  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProjectProvider>();
    final diagram = provider.activeDiagram;

    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B0F19),
        elevation: 0,
        titleSpacing: 0,
        title: Row(
          children: [
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    diagram.name,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${diagram.classes.length} clases • ${diagram.relations.length} relaciones',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF38BDF8)),
                  ),
                ],
              ),
            ),
            // Chip de Estado de Conectividad / Offline-First Auto-Sync
            InkWell(
              onTap: _toggleOfflineMode,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                margin: const EdgeInsets.only(right: 6),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _isOnline ? const Color(0xFF10B981).withOpacity(0.15) : const Color(0xFFEF4444).withOpacity(0.2),
                  border: Border.all(color: _isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444), width: 1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: _isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      _isOnline ? 'Online' : 'Offline${_pendingSyncCount > 0 ? " ($_pendingSyncCount)" : ""}',
                      style: TextStyle(
                        color: _isOnline ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        actions: [
          // Botón Escanear Boceto UML con IA (Cámara / Galería)
          IconButton(
            onPressed: _openVisionScanner,
            tooltip: 'Escanear Boceto UML con IA (Cámara / Galería)',
            icon: const Icon(Icons.document_scanner_outlined, color: Color(0xFFA855F7), size: 21),
          ),
          // Botón Guardar Proyecto
          IconButton(
            onPressed: () async {
              await provider.saveCurrentProject();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    backgroundColor: const Color(0xFF10B981),
                    content: Text('💾 Proyecto "${diagram.name}" guardado exitosamente.'),
                    duration: const Duration(seconds: 2),
                  ),
                );
              }
            },
            tooltip: 'Guardar Proyecto',
            icon: const Icon(Icons.save_outlined, color: Color(0xFF10B981), size: 21),
          ),
          // Botón Deshacer
          IconButton(
            onPressed: provider.undo,
            tooltip: 'Deshacer (Undo)',
            icon: const Icon(Icons.undo, color: Color(0xFF94A3B8), size: 20),
          ),
          // Botón Conectar Clases
          IconButton(
            onPressed: () => _showConnectDialog(provider),
            tooltip: 'Conectar Clases UML',
            icon: const Icon(Icons.hub_outlined, color: Color(0xFF38BDF8), size: 20),
          ),
          // Botón Nueva Clase
          IconButton(
            onPressed: () => _showAddClassDialog(provider),
            tooltip: 'Nueva Clase',
            icon: const Icon(Icons.add_box_outlined, color: Color(0xFF2DD4BF), size: 22),
          ),
          // Botón Descargar Backend ZIP
          IconButton(
            onPressed: _isDownloadingZip ? null : () => _downloadBackendZip(diagram),
            tooltip: 'Descargar Backend Spring Boot ZIP',
            icon: _isDownloadingZip
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFF59E0B)))
                : const Icon(Icons.folder_zip_outlined, color: Color(0xFFF59E0B), size: 22),
          ),
          // Menú Más Opciones (Limpiar, Equipo, Ayuda, Historial, Exportaciones parciales, XMI, Bloqueo)
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: Color(0xFF94A3B8)),
            color: const Color(0xFF1E293B),
            onSelected: (val) {
              if (val == 'save') {
                provider.saveCurrentProject();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(backgroundColor: const Color(0xFF10B981), content: Text('💾 "${diagram.name}" guardado.')),
                );
              }
              if (val == 'export_xmi') _exportXmi(diagram);
              if (val == 'import_xmi') _importXmi(provider);
              if (val == 'clear') _confirmClearCanvas(provider);
              if (val == 'team') _showTeamSheet(diagram.id, diagram.name);
              if (val == 'tutorial') _showTutorialDialog();
              if (val == 'backend_history') _showBackendHistorySheet(diagram);
              if (val == 'download_sql') _downloadSchemaSql(diagram);
              if (val == 'download_postman') _downloadPostman(diagram);
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                value: 'team',
                child: Row(
                  children: [
                    Icon(Icons.people_outline, color: Color(0xFF38BDF8), size: 18),
                    SizedBox(width: 10),
                    Text('Colaboradores & Permisos', style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'backend_history',
                child: Row(
                  children: [
                    Icon(Icons.history_edu_outlined, color: Color(0xFFF59E0B), size: 18),
                    SizedBox(width: 10),
                    Text('Historial Backends (Creador)', style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuDivider(height: 8),
              const PopupMenuItem(
                value: 'export_xmi',
                child: Row(
                  children: [
                    Icon(Icons.output_outlined, color: Color(0xFF38BDF8), size: 18),
                    SizedBox(width: 10),
                    Text('Exportar XMI (Enterprise Architect)', style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'import_xmi',
                child: Row(
                  children: [
                    Icon(Icons.input_outlined, color: Color(0xFF2DD4BF), size: 18),
                    SizedBox(width: 10),
                    Text('Importar XMI (Enterprise Architect)', style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuDivider(height: 8),
              const PopupMenuItem(
                value: 'download_sql',
                child: Row(
                  children: [
                    Icon(Icons.storage_outlined, color: Color(0xFF0EA5E9), size: 18),
                    SizedBox(width: 10),
                    Text('Descargar solo schema.sql', style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'download_postman',
                child: Row(
                  children: [
                    Icon(Icons.send_and_archive_outlined, color: Color(0xFFFB923C), size: 18),
                    SizedBox(width: 10),
                    Text('Descargar solo Postman JSON', style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuDivider(height: 8),
              const PopupMenuItem(
                value: 'tutorial',
                child: Row(
                  children: [
                    Icon(Icons.help_outline, color: Color(0xFF2DD4BF), size: 18),
                    SizedBox(width: 10),
                    Text('Tutorial & Comandos (?)', style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'clear',
                child: Row(
                  children: [
                    Icon(Icons.delete_sweep_outlined, color: Color(0xFFEF4444), size: 18),
                    SizedBox(width: 10),
                    Text('Limpiar Lienzo', style: TextStyle(color: Color(0xFFEF4444), fontSize: 13)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          if (provider.isReadOnly)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: const Color(0xFF1E293B),
              child: Row(
                children: [
                  const Icon(Icons.visibility, color: Color(0xFFF59E0B), size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '👁️ MODO SUPERVISIÓN (LECTOR) • Autor: ${provider.activeProject?.ownerName ?? "Usuario"}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () {
                      provider.setReadOnly(false);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Modo edición activado.')),
                      );
                    },
                    icon: const Icon(Icons.lock_open, size: 14, color: Color(0xFF38BDF8)),
                    label: const Text('Habilitar Edición', style: TextStyle(fontSize: 11, color: Color(0xFF38BDF8))),
                  ),
                ],
              ),
            ),
          Expanded(
            child: diagram.classes.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.touch_app_outlined, size: 54, color: Color(0xFF475569)),
                        const SizedBox(height: 12),
                        const Text(
                    'Lienzo Vacío',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 6),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 40),
                    child: Text(
                      'Usa el micrófono inferior para dictar: "Crear sistema para hotelería" o pulsa "+ Clase"',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ElevatedButton.icon(
                        onPressed: _openVoiceDock,
                        icon: const Icon(Icons.mic, size: 18, color: Colors.white),
                        label: const Text('Comando por Voz', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF7C3AED),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      OutlinedButton.icon(
                        onPressed: () => _showAddClassDialog(provider),
                        icon: const Icon(Icons.add, size: 18, color: Color(0xFF2DD4BF)),
                        label: const Text('Nueva Clase', style: TextStyle(color: Color(0xFF2DD4BF), fontWeight: FontWeight.bold)),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFF2DD4BF)),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            )
          : InteractiveViewer(
              constrained: false,
              boundaryMargin: const EdgeInsets.all(2500),
              minScale: 0.2,
              maxScale: 2.5,
              child: SizedBox(
                width: 5000,
                height: 5000,
                child: Stack(
                  children: [
                    // Fondo con cuadrícula sutil
                    Positioned.fill(
                      child: CustomPaint(
                        painter: GridBackgroundPainter(),
                      ),
                    ),

                    // Relaciones y conectores con estilo UML enriquecido
                    Positioned.fill(
                      child: CustomPaint(
                        painter: RelationPainter(
                          classes: diagram.classes,
                          relations: diagram.relations,
                        ),
                      ),
                    ),

                    // Cajas de Clases UML Arrastrables e Interactivas
                    ...diagram.classes.map((cls) {
                      final lockInfo = CollabLockService().getLock(cls.id);
                      final currentUid = AuthService().currentUser?.id ?? '';
                      final isLockedByOther = lockInfo != null && lockInfo.userId != currentUid;
                      final lockColor = isLockedByOther
                          ? Color(int.tryParse(lockInfo.userColor.replaceFirst('#', '0xFF')) ?? 0xFFF59E0B)
                          : null;

                      return UmlClassBox(
                        umlClass: cls,
                        isSelected: _selectedClassId == cls.id,
                        lockedByUserName: isLockedByOther ? lockInfo.userName : null,
                        lockedByUserColor: lockColor,
                        onTap: () {
                          setState(() {
                            _selectedClassId = cls.id;
                          });
                          _openClassInspector(cls, provider);
                        },
                        onDragEnd: (newPos) {
                          provider.updateClassPosition(cls.id, newPos);
                          provider.saveAfterDrag();
                        },
                      );
                    }).toList(),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openVoiceDock,
        backgroundColor: const Color(0xFF7C3AED),
        icon: const Icon(Icons.mic, color: Colors.white),
        label: const Text(
          'Comando de Voz',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
      ),
    );
  }
}

class GridBackgroundPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF1E293B).withOpacity(0.35)
      ..strokeWidth = 0.6;

    const step = 35.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
