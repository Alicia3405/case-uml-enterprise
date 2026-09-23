import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/auth_models.dart';
import '../models/uml_models.dart';
import '../providers/project_provider.dart';
import '../services/auth_service.dart';

class TeamCollaboratorsSheet extends StatefulWidget {
  final String projectId;
  final String projectName;

  const TeamCollaboratorsSheet({
    Key? key,
    required this.projectId,
    required this.projectName,
  }) : super(key: key);

  @override
  State<TeamCollaboratorsSheet> createState() => _TeamCollaboratorsSheetState();
}

class _TeamCollaboratorsSheetState extends State<TeamCollaboratorsSheet> {
  ProjectSummary _getProject(ProjectProvider provider) {
    return provider.projects.firstWhere(
      (p) => p.id == widget.projectId,
      orElse: () => provider.projects.firstWhere(
        (p) => p.name == widget.projectName,
        orElse: () => provider.activeProject ?? ProjectSummary(
          id: widget.projectId,
          name: widget.projectName,
          description: '',
        ),
      ),
    );
  }

  // Diálogo simple con autocompletado y búsqueda en tiempo real de usuarios registrados
  void _showAddMemberDialog(BuildContext context, ProjectProvider provider, ProjectSummary project) {
    final searchCtrl = TextEditingController();
    String selectedRole = 'EDITOR';
    AppUser? selectedUser;
    final existingUserIds = project.members.map((m) => m.userId).toSet();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final query = searchCtrl.text.trim().toLowerCase();
          final availableUsers = AuthService.defaultUsers
              .where((u) => !existingUserIds.contains(u.id))
              .where((u) => query.isEmpty ||
                  u.nombreCompleto.toLowerCase().contains(query) ||
                  u.username.toLowerCase().contains(query))
              .toList();

          return AlertDialog(
            backgroundColor: const Color(0xFF1E293B),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Row(
              children: [
                Icon(Icons.person_search, color: Color(0xFF38BDF8), size: 22),
                SizedBox(width: 8),
                Text('Invitar Colaborador', style: TextStyle(color: Colors.white, fontSize: 16)),
              ],
            ),
            content: SizedBox(
              width: 340,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Busca entre los usuarios registrados en el sistema:',
                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                  ),
                  const SizedBox(height: 10),

                  // Campo de Búsqueda Activa
                  TextField(
                    controller: searchCtrl,
                    autofocus: true,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    onChanged: (val) {
                      setDialogState(() {
                        // Si escribe, deseleccionar para volver a filtrar
                        if (selectedUser != null && !selectedUser!.nombreCompleto.toLowerCase().contains(val.toLowerCase())) {
                          selectedUser = null;
                        }
                      });
                    },
                    decoration: InputDecoration(
                      hintText: 'Escribe nombre o usuario...',
                      hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF0F172A),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFF334155)),
                      ),
                      prefixIcon: const Icon(Icons.search, color: Color(0xFF38BDF8), size: 18),
                      suffixIcon: searchCtrl.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 16, color: Color(0xFF94A3B8)),
                              onPressed: () {
                                searchCtrl.clear();
                                setDialogState(() => selectedUser = null);
                              },
                            )
                          : null,
                    ),
                  ),

                  const SizedBox(height: 10),

                  // Lista de Resultados / Coincidencias en Tiempo Real
                  if (selectedUser != null) ...[
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF7C3AED).withOpacity(0.2),
                        border: Border.all(color: const Color(0xFFA855F7)),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 14,
                            backgroundColor: Color(int.parse(selectedUser!.color.replaceAll('#', '0xFF'))),
                            child: Text(
                              selectedUser!.nombreCompleto[0],
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(selectedUser!.nombreCompleto, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                                Text('@${selectedUser!.username}', style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 10)),
                              ],
                            ),
                          ),
                          const Icon(Icons.check_circle, color: Color(0xFF10B981), size: 20),
                        ],
                      ),
                    ),
                  ] else ...[
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 140),
                      child: availableUsers.isEmpty
                          ? Container(
                              padding: const EdgeInsets.all(12),
                              alignment: Alignment.center,
                              child: const Text(
                                'No se encontraron usuarios disponibles o ya forman parte del proyecto.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Color(0xFFEF4444), fontSize: 11),
                              ),
                            )
                          : ListView.builder(
                              shrinkWrap: true,
                              itemCount: availableUsers.length,
                              itemBuilder: (ctx, i) {
                                final user = availableUsers[i];
                                return ListTile(
                                  dense: true,
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 6, vertical: 0),
                                  leading: CircleAvatar(
                                    radius: 14,
                                    backgroundColor: Color(int.parse(user.color.replaceAll('#', '0xFF'))),
                                    child: Text(
                                      user.nombreCompleto.isNotEmpty ? user.nombreCompleto[0] : 'U',
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                                    ),
                                  ),
                                  title: Text(user.nombreCompleto, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                                  subtitle: Text('@${user.username} &bull; ${user.rol}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10)),
                                  trailing: const Icon(Icons.arrow_forward_ios, size: 12, color: Color(0xFF38BDF8)),
                                  onTap: () {
                                    setDialogState(() {
                                      selectedUser = user;
                                      searchCtrl.text = user.nombreCompleto;
                                    });
                                  },
                                );
                              },
                            ),
                    ),
                  ],

                  const SizedBox(height: 12),

                  // Selector de Rol
                  Row(
                    children: [
                      const Text('Rol asignado:', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                      const SizedBox(width: 10),
                      DropdownButton<String>(
                        value: selectedRole,
                        dropdownColor: const Color(0xFF0F172A),
                        style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.bold, fontSize: 12),
                        items: const [
                          DropdownMenuItem(value: 'EDITOR', child: Text('✏️ Editor (Modificar)')),
                          DropdownMenuItem(value: 'VIEWER', child: Text('👁️ Lector (Solo lectura)')),
                        ],
                        onChanged: (val) {
                          if (val != null) setDialogState(() => selectedRole = val);
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'El usuario recibirá la invitación y podrá Aceptar o Rechazar unirse.',
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 10, fontStyle: FontStyle.italic),
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
                onPressed: selectedUser == null
                    ? null
                    : () {
                        final newMember = ProjectMember(
                          userId: selectedUser!.id,
                          username: selectedUser!.username,
                          nombreCompleto: selectedUser!.nombreCompleto,
                          role: selectedRole,
                          status: 'PENDIENTE',
                          color: selectedUser!.color,
                          canDownloadBackend: selectedRole == 'EDITOR',
                        );
                        provider.addCollaborator(project.id, newMember);
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            backgroundColor: const Color(0xFF10B981),
                            content: Text('Invitación enviada a "${selectedUser!.nombreCompleto}" (@${selectedUser!.username}).'),
                          ),
                        );
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7C3AED),
                  disabledBackgroundColor: const Color(0xFF334155),
                ),
                child: const Text('Enviar Invitación', style: TextStyle(color: Colors.white)),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProjectProvider>();
    final project = _getProject(provider);
    final members = project.members;

    return Container(
      height: MediaQuery.of(context).size.height * 0.80,
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Agarre
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: const Color(0xFF334155), borderRadius: BorderRadius.circular(2)),
            ),
          ),

          // Título
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.people_alt_outlined, color: Color(0xFF38BDF8), size: 22),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Equipo y Colaboradores',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      Text(
                        '${project.name} • ${members.length} colaboradores',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),

          // Botón Invitar Rápido (1 solo dato)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
            child: ElevatedButton.icon(
              onPressed: () => _showAddMemberDialog(context, provider, project),
              icon: const Icon(Icons.person_add_alt_1, size: 18),
              label: const Text('Invitar Colaborador (Nombre o Usuario)', style: TextStyle(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1E293B),
                foregroundColor: const Color(0xFF38BDF8),
                side: const BorderSide(color: Color(0xFF334155)),
                minimumSize: const Size.fromHeight(42),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),

          const SizedBox(height: 8),

          // Lista de Miembros Colaborando Exclusivamente
          Expanded(
            child: members.isEmpty
                ? const Center(
                    child: Text(
                      'No hay colaboradores en este proyecto.',
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    itemCount: members.length,
                    itemBuilder: (ctx, idx) {
                      final member = members[idx];
                      final isOwner = member.role == 'OWNER' || member.userId == project.ownerId;
                      final isPending = member.status == 'PENDIENTE';

                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isOwner
                          ? const Color(0xFFF59E0B).withOpacity(0.5)
                          : (isPending ? const Color(0xFF38BDF8).withOpacity(0.4) : const Color(0xFF334155)),
                    ),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: Color(int.parse(member.color.replaceAll('#', '0xFF'))),
                            child: Text(
                              member.nombreCompleto.isNotEmpty ? member.nombreCompleto[0].toUpperCase() : 'U',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        member.nombreCompleto,
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    // Badge de Estado de Invitación
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: isPending ? const Color(0xFFF59E0B).withOpacity(0.2) : const Color(0xFF10B981).withOpacity(0.2),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        isPending ? 'Pendiente' : 'Activo',
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                          color: isPending ? const Color(0xFFFCD34D) : const Color(0xFF34D399),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                Text(
                                  '@${member.username}',
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Divider(color: Color(0xFF334155), height: 1),
                      const SizedBox(height: 6),

                      // Fila de Cambio de Rol Dinámico y Permiso de Descarga
                      Row(
                        children: [
                          const Text('Rol:', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                          const SizedBox(width: 8),
                          if (isOwner)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF59E0B).withOpacity(0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                '👑 Dueño del Proyecto',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFFCD34D)),
                              ),
                            )
                          else
                            // Dropdown para cambiar rol en 1 clic entre Editor y Lector
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0F172A),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFF334155)),
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: member.role,
                                  dropdownColor: const Color(0xFF0F172A),
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF38BDF8), fontWeight: FontWeight.bold),
                                  items: const [
                                    DropdownMenuItem(value: 'EDITOR', child: Text('✏️ Editor (Modifica)')),
                                    DropdownMenuItem(value: 'VIEWER', child: Text('👁️ Lector (Lectura)')),
                                  ],
                                  onChanged: (newRole) {
                                    if (newRole != null) {
                                      provider.updateCollaboratorRole(project.id, member.userId, newRole);
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text('Rol de @${member.username} cambiado a $newRole.'),
                                          duration: const Duration(seconds: 1),
                                        ),
                                      );
                                    }
                                  },
                                ),
                              ),
                            ),

                          const Spacer(),

                          // Si la invitación está pendiente
                          if (isPending)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF59E0B).withOpacity(0.12),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.3)),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.hourglass_top, size: 12, color: Color(0xFFFCD34D)),
                                  SizedBox(width: 4),
                                  Text('Pendiente', style: TextStyle(fontSize: 10, color: Color(0xFFFCD34D), fontWeight: FontWeight.bold)),
                                ],
                              ),
                            )
                          else ...[
                            // Permiso Descargar Backend ZIP
                            const Icon(Icons.cloud_download_outlined, size: 15, color: Color(0xFF94A3B8)),
                            const SizedBox(width: 4),
                            const Text('ZIP:', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                            Switch(
                              value: member.canDownloadBackend,
                              activeColor: const Color(0xFF2DD4BF),
                              onChanged: isOwner
                                  ? null
                                  : (val) {
                                      provider.updateCollaboratorZip(project.id, member.userId, val);
                                    },
                            ),
                          ],

                          if (!isOwner) ...[
                            const SizedBox(width: 4),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFFEF4444)),
                              tooltip: isPending ? 'Cancelar invitación' : 'Quitar colaborador',
                              onPressed: () {
                                provider.removeCollaborator(project.id, member.userId);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    backgroundColor: const Color(0xFFEF4444),
                                    content: Text('Colaborador @${member.username} removido del proyecto.'),
                                  ),
                                );
                              },
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
