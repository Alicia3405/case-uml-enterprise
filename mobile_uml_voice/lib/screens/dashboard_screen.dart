import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';
import '../models/auth_models.dart';
import '../models/uml_models.dart';
import '../providers/project_provider.dart';
import '../services/auth_service.dart';
import '../widgets/tutorial_dialog.dart';
import '../widgets/user_profile_dialog.dart';

class DashboardScreen extends StatefulWidget {
  final VoidCallback? onOpenCanvas;
  final VoidCallback? onOpenVoiceAssistant;
  final int initialSubTab;
  final VoidCallback? onStartTour;

  const DashboardScreen({
    Key? key,
    this.onOpenCanvas,
    this.onOpenVoiceAssistant,
    this.initialSubTab = 0,
    this.onStartTour,
  }) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with TickerProviderStateMixin {
  late TabController _tabController;
  final _searchCtrl = TextEditingController();
  final _userSearchCtrl = TextEditingController();
  String _searchQuery = '';
  String _userSearchQuery = '';

  @override
  void initState() {
    super.initState();
    final auth = AuthService();
    final isAdmin = auth.currentUser?.rol == 'ADMINISTRADOR';
    _tabController = TabController(
      length: isAdmin ? 4 : 2,
      vsync: this,
      initialIndex: widget.initialSubTab.clamp(0, isAdmin ? 3 : 1),
    );
  }

  @override
  void didUpdateWidget(DashboardScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialSubTab != oldWidget.initialSubTab) {
      _tabController.animateTo(widget.initialSubTab.clamp(0, _tabController.length - 1));
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchCtrl.dispose();
    _userSearchCtrl.dispose();
    super.dispose();
  }

  void _showNewProjectDialog(ProjectProvider provider) {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Nuevo Proyecto UML', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              autofocus: true,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                hintText: 'Nombre del proyecto (ej. Sistema Facturación)',
                hintStyle: TextStyle(color: Color(0xFF64748B)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: descCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                hintText: 'Descripción breve (opcional)',
                hintStyle: TextStyle(color: Color(0xFF64748B)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton(
            onPressed: () {
              provider.createProject(nameCtrl.text, descCtrl.text);
              Navigator.pop(ctx);
              widget.onOpenCanvas?.call();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
            child: const Text('Crear Proyecto', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showCreateUserDialog(AuthService auth) {
    final nameCtrl = TextEditingController();
    final userCtrl = TextEditingController();
    String selectedRole = 'USUARIO';
    String selectedColor = '#38BDF8';

    final colors = [
      '#38BDF8', // Cyan
      '#EC4899', // Pink
      '#10B981', // Emerald
      '#F59E0B', // Amber
      '#8B5CF6', // Purple
      '#6366F1', // Indigo
    ];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.person_add_alt_1, color: Color(0xFF38BDF8), size: 22),
              SizedBox(width: 8),
              Text('Crear Nuevo Usuario', style: TextStyle(color: Colors.white, fontSize: 16)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Nombre Completo:', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                const SizedBox(height: 4),
                TextField(
                  controller: nameCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'ej. Ing. Fernando Soto',
                    hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 12),
                const Text('Nombre de Usuario:', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                const SizedBox(height: 4),
                TextField(
                  controller: userCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'ej. fernando.soto',
                    hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.badge_outlined, color: Color(0xFF38BDF8), size: 16),
                      SizedBox(width: 8),
                      Text(
                        'Rol: USUARIO (Trabajador / Modelador UML)',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                const Text('Color Distintivo:', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: colors.map((c) {
                    final isSel = selectedColor == c;
                    return InkWell(
                      onTap: () => setDlgState(() => selectedColor = c),
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: Color(int.parse(c.replaceAll('#', '0xFF'))),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isSel ? Colors.white : Colors.transparent,
                            width: isSel ? 2.5 : 0,
                          ),
                        ),
                        child: isSel ? const Icon(Icons.check, size: 16, color: Colors.white) : null,
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancelar', style: TextStyle(color: Color(0xFF94A3B8))),
            ),
            ElevatedButton(
              onPressed: () async {
                if (nameCtrl.text.trim().isEmpty || userCtrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Por favor ingresa nombre y usuario.')),
                  );
                  return;
                }
                final newUser = AppUser(
                  id: 'usr_${const Uuid().v4().substring(0, 6)}',
                  nombreCompleto: nameCtrl.text.trim(),
                  username: userCtrl.text.trim().toLowerCase(),
                  rol: selectedRole,
                  color: selectedColor,
                );
                await auth.createUser(newUser);
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    backgroundColor: const Color(0xFF10B981),
                    content: Text('✅ Usuario "${newUser.nombreCompleto}" creado correctamente.'),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
              child: const Text('Guardar Usuario', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  void _showJsonImportExport(ProjectProvider provider) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              '🔄 Interoperabilidad Web / Móvil (JSON)',
              style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            const Text(
              'Exporta el modelo actual para abrirlo en la Web o importa un JSON copiado de Angular.',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
            ),
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: () {
                final jsonStr = provider.activeDiagram.toFormattedJson();
                Clipboard.setData(ClipboardData(text: jsonStr));
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('✅ Diagrama JSON copiado al portapapeles. ¡Listo para pegar en la Web!')),
                );
              },
              icon: const Icon(Icons.copy, size: 18),
              label: const Text('Copiar JSON del Proyecto al Portapapeles'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0D9488)),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () async {
                final data = await Clipboard.getData('text/plain');
                if (data?.text != null && data!.text!.contains('"classes"')) {
                  try {
                    provider.executeAiArchitecturePrompt(data.text!);
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('✅ Diagrama JSON importado con éxito.')),
                    );
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('⚠️ Formato JSON no válido.')),
                    );
                  }
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('⚠️ No se detectó un JSON de diagrama UML en el portapapeles.')),
                  );
                }
              },
              icon: const Icon(Icons.paste, size: 18, color: Color(0xFF38BDF8)),
              label: const Text('Pegar e Importar JSON desde el Portapapeles', style: TextStyle(color: Color(0xFF38BDF8))),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: Color(0xFF38BDF8))),
            ),
          ],
        ),
      ),
    );
  }

  void _showNotificationsSheet(
    BuildContext context,
    ProjectProvider provider,
    List<ProjectSummary> pendingList,
    String currentUserId,
    String currentUsername,
  ) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            final activePending = provider.projects.where((p) {
              if (p.ownerId == currentUserId) return false;
              return p.members.any((m) =>
                (m.userId == currentUserId ||
                 (currentUsername.isNotEmpty && m.username.toLowerCase() == currentUsername.toLowerCase())) &&
                m.status == 'PENDIENTE'
              );
            }).toList();

            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.notifications_active, color: Color(0xFFF59E0B), size: 22),
                      const SizedBox(width: 10),
                      const Text(
                        'Notificaciones de Invitación',
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const Spacer(),
                      IconButton(
                        onPressed: () => Navigator.pop(ctx),
                        icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 20),
                      ),
                    ],
                  ),
                  const Divider(color: Color(0xFF334155)),
                  const SizedBox(height: 8),
                  if (activePending.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: Column(
                        children: [
                          Icon(Icons.mark_email_read_outlined, size: 48, color: Color(0xFF475569)),
                          SizedBox(height: 12),
                          Text(
                            'No tienes invitaciones pendientes',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                          ),
                        ],
                      ),
                    )
                  else
                    ...activePending.map((p) {
                      final member = p.members.firstWhere(
                        (m) => m.userId == currentUserId || (currentUsername.isNotEmpty && m.username.toLowerCase() == currentUsername.toLowerCase()),
                        orElse: () => ProjectMember(userId: currentUserId, username: currentUsername, nombreCompleto: ''),
                      );
                      final roleLabel = member.role == 'EDITOR' ? 'Editor (Modificar)' : 'Lector (Visualizar)';
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF38BDF8).withOpacity(0.5)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.folder_shared, color: Color(0xFF38BDF8), size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    p.name,
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF59E0B).withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text('Pendiente', style: TextStyle(color: Color(0xFFFBBF24), fontSize: 10, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${p.ownerName} te ha invitado a colaborar con el rol de $roleLabel.',
                              style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
                            ),
                            if (p.description.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(p.description, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                            ],
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                OutlinedButton(
                                  onPressed: () async {
                                    await provider.rejectInvitation(p.id, currentUserId);
                                    setSheetState(() {});
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Rechazaste la invitación a "${p.name}".')),
                                    );
                                  },
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: const Color(0xFFEF4444),
                                    side: const BorderSide(color: Color(0xFFEF4444)),
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                  ),
                                  child: const Text('Rechazar', style: TextStyle(fontSize: 12)),
                                ),
                                const SizedBox(width: 10),
                                ElevatedButton.icon(
                                  onPressed: () async {
                                    await provider.acceptInvitation(p.id, currentUserId);
                                    setSheetState(() {});
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        backgroundColor: const Color(0xFF10B981),
                                        content: Text('✅ Invitación aceptada. "${p.name}" agregado a Colaborativos.'),
                                      ),
                                    );
                                  },
                                  icon: const Icon(Icons.check, size: 16),
                                  label: const Text('Aceptar', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF10B981),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProjectProvider>();
    final auth = context.watch<AuthService>();
    final user = auth.currentUser;
    final currentUserId = user?.id ?? 'usr_pedro_01';
    final isAdmin = user?.rol == 'ADMINISTRADOR';
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    // Manejar dinámicamente la longitud del TabController si cambia de Admin a Usuario normal
    final targetLength = isAdmin ? 4 : 2;
    if (_tabController.length != targetLength) {
      _tabController.dispose();
      _tabController = TabController(
        length: targetLength,
        vsync: this,
        initialIndex: 0,
      );
    }

    // Proyectos estrictamente del usuario activo
    final myProjects = provider.projects
        .where((p) => p.ownerId == currentUserId && 
                      (p.name.toLowerCase().contains(_searchQuery.toLowerCase()) || 
                       p.description.toLowerCase().contains(_searchQuery.toLowerCase())))
        .toList();

    // Invitaciones pendientes para el usuario activo
    final pendingInvitations = provider.projects.where((p) {
      if (p.ownerId == currentUserId) return false;
      return p.members.any((m) =>
        (m.userId == currentUserId ||
         (user != null && (m.username.toLowerCase() == user.username.toLowerCase() || m.nombreCompleto.toLowerCase() == user.nombreCompleto.toLowerCase()))) &&
        m.status == 'PENDIENTE'
      );
    }).toList();

    // Proyectos colaborativos asignados (donde no es el dueño directo y la invitación está aceptada)
    final collabProjects = provider.projects
        .where((p) {
          if (p.ownerId == currentUserId) return false;
          final matchesQuery = p.name.toLowerCase().contains(_searchQuery.toLowerCase()) || 
                               p.description.toLowerCase().contains(_searchQuery.toLowerCase());
          if (!matchesQuery) return false;
          final isMemberAccepted = p.members.any((m) =>
            (m.userId == currentUserId ||
             (user != null && (m.username.toLowerCase() == user.username.toLowerCase() || m.nombreCompleto.toLowerCase() == user.nombreCompleto.toLowerCase()))) &&
            m.status == 'ACEPTADA'
          );
          final isDemoHotelForPedro = (p.id == 'proj_hotel_demo' && currentUserId == 'usr_pedro_01');
          return isMemberAccepted || isDemoHotelForPedro;
        })
        .toList();

    // Proyectos para Supervisión Administrativa (Todos los proyectos del sistema)
    final supervisionProjects = provider.projects
        .where((p) => p.name.toLowerCase().contains(_searchQuery.toLowerCase()) || 
                      p.ownerName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
                      p.description.toLowerCase().contains(_searchQuery.toLowerCase()))
        .toList();

    // Directorio de Usuarios filtrado
    final filteredUsers = auth.allUsers
        .where((u) => u.nombreCompleto.toLowerCase().contains(_userSearchQuery.toLowerCase()) ||
                      u.username.toLowerCase().contains(_userSearchQuery.toLowerCase()) ||
                      u.rol.toLowerCase().contains(_userSearchQuery.toLowerCase()))
        .toList();

    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B0F19),
        elevation: 0,
        title: Row(
          children: [
            const Text(
              '📊 CASE Studio UML',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            if (isAdmin) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF8B5CF6).withOpacity(0.25),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFF8B5CF6), width: 1),
                ),
                child: const Text('ADMIN', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFFC4B5FD))),
              ),
            ],
          ],
        ),
        actions: [
          IconButton(
            onPressed: widget.onStartTour ?? () {
              showDialog(
                context: context,
                builder: (ctx) => const TutorialDialog(),
              );
            },
            tooltip: 'Tutorial Interactivo (?)',
            icon: const Icon(Icons.help_outline, color: Color(0xFF2DD4BF)),
          ),
          IconButton(
            onPressed: () => _showNotificationsSheet(
              context,
              provider,
              pendingInvitations,
              currentUserId,
              user?.username ?? '',
            ),
            tooltip: 'Notificaciones (${pendingInvitations.length})',
            icon: Badge(
              isLabelVisible: pendingInvitations.isNotEmpty,
              label: Text('${pendingInvitations.length}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              backgroundColor: const Color(0xFFEF4444),
              child: const Icon(Icons.notifications_outlined, color: Color(0xFFF59E0B)),
            ),
          ),
          IconButton(
            onPressed: () => _showJsonImportExport(provider),
            tooltip: 'Sincronizar JSON con Web',
            icon: const Icon(Icons.sync_alt, color: Color(0xFF38BDF8)),
          ),
          if (!isAdmin)
            IconButton(
              onPressed: () => _showNewProjectDialog(provider),
              tooltip: 'Nuevo Proyecto',
              icon: const Icon(Icons.add_circle, color: Color(0xFFA855F7)),
            ),
          // Perfil de Usuario Activo
          if (user != null)
            PopupMenuButton<String>(
              icon: CircleAvatar(
                radius: 13,
                backgroundColor: Color(int.parse(user.color.replaceAll('#', '0xFF'))),
                child: Text(
                  user.nombreCompleto.isNotEmpty ? user.nombreCompleto[0] : 'U',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
              color: const Color(0xFF1E293B),
              tooltip: 'Mi Cuenta (${user.username})',
              onSelected: (val) async {
                if (val == 'profile') {
                  showDialog(
                    context: context,
                    builder: (ctx) => const UserProfileDialog(),
                  );
                } else if (val == 'logout') {
                  auth.logout();
                }
              },
              itemBuilder: (ctx) => [
                PopupMenuItem(
                  enabled: false,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user.nombreCompleto, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                      Text('${user.rol} • @${user.username}', style: const TextStyle(fontSize: 11, color: Color(0xFF38BDF8))),
                    ],
                  ),
                ),
                const PopupMenuItem(
                  value: 'profile',
                  child: Row(
                    children: [
                      Icon(Icons.manage_accounts, size: 16, color: Color(0xFF2DD4BF)),
                      SizedBox(width: 8),
                      Text('Mi Perfil / Contraseña', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
                const PopupMenuDivider(),
                const PopupMenuItem(
                  value: 'logout',
                  child: Row(
                    children: [
                      Icon(Icons.logout, size: 16, color: Color(0xFFEF4444)),
                      SizedBox(width: 8),
                      Text('Cerrar Sesión', style: TextStyle(color: Color(0xFFEF4444))),
                    ],
                  ),
                ),
              ],
            ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFFA855F7),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF64748B),
          isScrollable: isAdmin,
          tabs: [
            Tab(text: 'Mis Proyectos (${myProjects.length})'),
            Tab(text: 'Colaborativos (${collabProjects.length})'),
            if (isAdmin) ...[
              Tab(text: 'Supervisión (${supervisionProjects.length})'),
              Tab(text: 'Usuarios (${auth.allUsers.length})'),
            ],
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // 1. MIS PROYECTOS
          _buildMyProjectsTab(myProjects, provider, dateFormat),

          // 2. COLABORATIVOS
          _buildCollabTab(collabProjects, provider, dateFormat, pendingInvitations, currentUserId, user?.username ?? ''),

          // 3. SUPERVISIÓN GLOBAL (SOLO ADMIN)
          if (isAdmin)
            _buildSupervisionTab(supervisionProjects, provider, dateFormat),

          // 4. GESTIÓN DE USUARIOS (SOLO ADMIN)
          if (isAdmin)
            _buildUsersTab(filteredUsers, auth, provider),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: widget.onOpenVoiceAssistant,
        backgroundColor: const Color(0xFF7C3AED),
        tooltip: 'Modo Asistente de Voz',
        child: const Icon(Icons.mic, color: Colors.white),
      ),
    );
  }

  // --- VISTA 1: MIS PROYECTOS ---
  Widget _buildMyProjectsTab(List<ProjectSummary> list, ProjectProvider provider, DateFormat dateFormat) {
    return Column(
      children: [
        _buildSearchBar('Buscar en mis proyectos...'),
        Expanded(
          child: list.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.folder_open, size: 56, color: Color(0xFF334155)),
                        const SizedBox(height: 12),
                        const Text(
                          'No tienes proyectos personales',
                          style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Crea un nuevo proyecto en blanco o pulsa el micrófono para dictar el diseño a la IA.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: () => _showNewProjectDialog(provider),
                          icon: const Icon(Icons.add, size: 18),
                          label: const Text('Crear Primer Proyecto'),
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  itemCount: list.length,
                  itemBuilder: (context, index) => _buildProjectCardItem(list[index], provider, dateFormat, isReadOnlyMode: false),
                ),
        ),
      ],
    );
  }

  // --- VISTA 2: COLABORATIVOS ---
  Widget _buildCollabTab(
    List<ProjectSummary> list,
    ProjectProvider provider,
    DateFormat dateFormat,
    List<ProjectSummary> pendingList,
    String currentUserId,
    String currentUsername,
  ) {
    return Column(
      children: [
        _buildSearchBar('Buscar en colaborativos...'),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            children: [
              if (pendingList.isNotEmpty)
                ...pendingList.map((proj) {
                  final member = proj.members.firstWhere(
                    (m) => m.userId == currentUserId || (currentUsername.isNotEmpty && m.username.toLowerCase() == currentUsername.toLowerCase()),
                    orElse: () => ProjectMember(userId: currentUserId, username: currentUsername, nombreCompleto: ''),
                  );
                  final roleLabel = member.role == 'EDITOR' ? 'Editor (Modificar)' : 'Lector (Visualizar)';

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF38BDF8), width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF38BDF8).withOpacity(0.15),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.mail_outline, color: Color(0xFF38BDF8), size: 18),
                            const SizedBox(width: 8),
                            const Expanded(
                              child: Text(
                                '📬 Invitación de Colaboración Recibida',
                                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF59E0B).withOpacity(0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text('PENDIENTE', style: TextStyle(color: Color(0xFFFBBF24), fontSize: 9, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${proj.ownerName} te ha invitado a colaborar en el proyecto "${proj.name}" con rol de $roleLabel.',
                          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            ElevatedButton.icon(
                              onPressed: () async {
                                await provider.acceptInvitation(proj.id, currentUserId);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    backgroundColor: const Color(0xFF10B981),
                                    content: Text('✅ ¡Invitación aceptada! "${proj.name}" se agregó a tus colaborativos.'),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.check, size: 16, color: Colors.white),
                              label: const Text('Aceptar Invitación', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF10B981),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              ),
                            ),
                            const SizedBox(width: 8),
                            TextButton(
                              onPressed: () async {
                                await provider.rejectInvitation(proj.id, currentUserId);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Invitación a "${proj.name}" rechazada.')),
                                );
                              },
                              child: const Text('Rechazar', style: TextStyle(color: Color(0xFFEF4444), fontSize: 12)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                }),

              if (list.isEmpty && pendingList.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: Center(
                    child: Text(
                      _searchQuery.isNotEmpty ? 'No se encontraron proyectos colaborativos' : 'No tienes proyectos colaborativos asignados',
                      style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                    ),
                  ),
                )
              else
                ...list.map((proj) => _buildProjectCardItem(proj, provider, dateFormat, isReadOnlyMode: false, showOwnerChip: true)),
            ],
          ),
        ),
      ],
    );
  }

  // --- VISTA 3: SUPERVISIÓN GLOBAL (ADMIN) ---
  Widget _buildSupervisionTab(List<ProjectSummary> list, ProjectProvider provider, DateFormat dateFormat) {
    return Column(
      children: [
        // Banner Informativo
        Container(
          width: double.infinity,
          margin: const EdgeInsets.fromLTRB(12, 10, 12, 4),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.5)),
          ),
          child: const Row(
            children: [
              Icon(Icons.policy_outlined, color: Color(0xFFF59E0B), size: 22),
              SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Supervisión Global de Proyectos (Solo Lectura)',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                    Text(
                      'Como Administrador puedes auditar cualquier diagrama de los ingenieros sin alterar sus clases.',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        _buildSearchBar('Buscar por proyecto o desarrollador...'),

        Expanded(
          child: list.isEmpty
              ? const Center(
                  child: Text('No hay proyectos registrados en el sistema.', style: TextStyle(color: Color(0xFF64748B))),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  itemCount: list.length,
                  itemBuilder: (context, index) => _buildProjectCardItem(
                    list[index],
                    provider,
                    dateFormat,
                    isReadOnlyMode: true,
                    showOwnerChip: true,
                  ),
                ),
        ),
      ],
    );
  }

  // --- VISTA 4: DIRECTORIO DE USUARIOS (ADMIN) ---
  Widget _buildUsersTab(List<AppUser> users, AuthService auth, ProjectProvider provider) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _userSearchCtrl,
                  onChanged: (val) => setState(() => _userSearchQuery = val),
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Filtrar usuarios por nombre o rol...',
                    hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                    prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B), size: 18),
                    filled: true,
                    fillColor: const Color(0xFF1E293B),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: () => _showCreateUserDialog(auth),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Crear Usuario'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7C3AED),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: users.isEmpty
              ? const Center(child: Text('No se encontraron usuarios.', style: TextStyle(color: Color(0xFF64748B))))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: users.length,
                  itemBuilder: (context, index) {
                    final u = users[index];
                    final userProjects = provider.projects.where((p) => p.ownerId == u.id).length;
                    final isCurrent = auth.currentUser?.id == u.id;

                    return Card(
                      color: const Color(0xFF1E293B),
                      margin: const EdgeInsets.only(bottom: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: isCurrent ? const Color(0xFF38BDF8) : const Color(0xFF334155),
                          width: isCurrent ? 1.5 : 1.0,
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor: Color(int.parse(u.color.replaceAll('#', '0xFF'))),
                              child: Text(
                                u.nombreCompleto.isNotEmpty ? u.nombreCompleto[0] : 'U',
                                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 14),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Flexible(
                                        child: Text(
                                          u.nombreCompleto,
                                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      if (isCurrent) ...[
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF38BDF8).withOpacity(0.2),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: const Text('Tú', style: TextStyle(fontSize: 9, color: Color(0xFF38BDF8), fontWeight: FontWeight.bold)),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text('@${u.username} • $userProjects proyecto(s) creado(s)', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: u.rol == 'ADMINISTRADOR'
                                    ? const Color(0xFF8B5CF6).withOpacity(0.2)
                                    : const Color(0xFF10B981).withOpacity(0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                u.rol,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: u.rol == 'ADMINISTRADOR' ? const Color(0xFFC4B5FD) : const Color(0xFF34D399),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.login, size: 18, color: Color(0xFF38BDF8)),
                              tooltip: 'Iniciar sesión como ${u.username}',
                              onPressed: () async {
                                await auth.loginAs(u);
                                await provider.switchUserProjects(u.id);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    backgroundColor: const Color(0xFF10B981),
                                    content: Text('Sesión cambiada a ${u.nombreCompleto}'),
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildSearchBar(String hint) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: TextField(
        controller: _searchCtrl,
        onChanged: (val) => setState(() => _searchQuery = val),
        style: const TextStyle(color: Colors.white, fontSize: 13),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
          prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B), size: 18),
          filled: true,
          fillColor: const Color(0xFF1E293B),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(vertical: 0),
        ),
      ),
    );
  }

  Widget _buildProjectCardItem(
    ProjectSummary proj,
    ProjectProvider provider,
    DateFormat dateFormat, {
    bool isReadOnlyMode = false,
    bool showOwnerChip = false,
  }) {
    final isActive = provider.activeProject?.id == proj.id;

    return Card(
      color: const Color(0xFF1E293B),
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: isActive ? const Color(0xFFA855F7) : const Color(0xFF334155),
          width: isActive ? 1.8 : 1.0,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () async {
          await provider.openProject(proj.id, readOnly: isReadOnlyMode);
          widget.onOpenCanvas?.call();
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: isReadOnlyMode
                          ? const Color(0xFFF59E0B).withOpacity(0.2)
                          : const Color(0xFF7C3AED).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      isReadOnlyMode ? Icons.visibility : Icons.schema_outlined,
                      color: isReadOnlyMode ? const Color(0xFFF59E0B) : const Color(0xFFA855F7),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          proj.name,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          proj.description.isEmpty ? 'Modelo conceptual UML' : proj.description,
                          style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  if (isActive)
                    const Chip(
                      label: Text('Activo', style: TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.bold)),
                      backgroundColor: Color(0xFF7C3AED),
                      padding: EdgeInsets.zero,
                    ),
                ],
              ),
              const SizedBox(height: 10),
              if (showOwnerChip)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      const Icon(Icons.person_pin, size: 14, color: Color(0xFF38BDF8)),
                      const SizedBox(width: 4),
                      Text(
                        'Autor: ${proj.ownerName}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF38BDF8), fontWeight: FontWeight.w600),
                      ),
                      if (isReadOnlyMode) ...[
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF59E0B).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text('Modo Lector', style: TextStyle(fontSize: 9, color: Color(0xFFF59E0B), fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ],
                  ),
                ),
              Row(
                children: [
                  _badge(Icons.table_chart_outlined, '${proj.classCount} clases', const Color(0xFF2DD4BF)),
                  const SizedBox(width: 8),
                  _badge(Icons.linear_scale, '${proj.relationCount} relaciones', const Color(0xFF38BDF8)),
                  const Spacer(),
                  Text(
                    dateFormat.format(proj.lastModified),
                    style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _badge(IconData icon, String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
