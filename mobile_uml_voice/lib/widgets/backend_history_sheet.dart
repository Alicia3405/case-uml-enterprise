import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/uml_models.dart';
import '../services/auth_service.dart';
import '../services/spring_boot_zip_service.dart';

class BackendHistorySheet extends StatefulWidget {
  final UmlDiagram currentDiagram;

  const BackendHistorySheet({Key? key, required this.currentDiagram}) : super(key: key);

  @override
  State<BackendHistorySheet> createState() => _BackendHistorySheetState();
}

class _BackendHistorySheetState extends State<BackendHistorySheet> {
  List<BackendHistoryItem> _history = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  void _loadHistory() async {
    final currentUserId = AuthService().currentUser?.id ?? '';
    final list = await SpringBootZipService.getHistory(currentUserId);
    if (mounted) {
      setState(() {
        _history = list;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = AuthService().currentUser;
    final isGuestOrNotLoggedIn = currentUser == null;
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm:ss');

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
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

          // Cabecera
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.history, color: Color(0xFFF59E0B), size: 22),
                const SizedBox(width: 8),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Historial de Backends Generados',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      Text(
                        'Control exclusivo del creador &bull; Solo visible por ti',
                        style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
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

          const Divider(color: Color(0xFF1E293B), height: 1),

          // Contenido
          Expanded(
            child: isGuestOrNotLoggedIn
                ? const Center(
                    child: Text(
                      'Debes iniciar sesión como creador para ver este historial.',
                      style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                    ),
                  )
                : _isLoading
                    ? const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)))
                    : _history.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.folder_open, size: 48, color: Color(0xFF475569)),
                                const SizedBox(height: 12),
                                const Text(
                                  'Aún no has generado ningún Backend',
                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                                ),
                                const SizedBox(height: 6),
                                const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 40),
                                  child: Text(
                                    'Usa el botón "Descargar ZIP" en el lienzo para generar tu primer proyecto Spring Boot 3.',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                  ),
                                ),
                                const SizedBox(height: 16),
                                ElevatedButton.icon(
                                  onPressed: () {
                                    Navigator.pop(context);
                                    SpringBootZipService.generateAndDownloadZip(
                                      widget.currentDiagram,
                                      ownerId: currentUser.id,
                                    );
                                  },
                                  icon: const Icon(Icons.download, size: 18),
                                  label: const Text('Generar y Descargar Ahora'),
                                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                            itemCount: _history.length,
                            itemBuilder: (ctx, idx) {
                              final item = _history[idx];
                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF1E293B),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFF334155)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.all(8),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF59E0B).withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: const Icon(Icons.folder_zip, color: Color(0xFFF59E0B), size: 20),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                item.projectName,
                                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                                              ),
                                              Text(
                                                dateFormat.format(item.generatedAt),
                                                style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF10B981).withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            '${item.classesCount} clases',
                                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF34D399)),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    Text(
                                      'Entidades: ${item.classNames.join(", ")}',
                                      style: const TextStyle(fontSize: 11, color: Color(0xFFCBD5E1)),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 12),
                                    const Divider(color: Color(0xFF334155), height: 1),
                                    const SizedBox(height: 8),
                                    // Botones de Descarga rápida
                                    Row(
                                      children: [
                                        TextButton.icon(
                                          onPressed: () {
                                            SpringBootZipService.generateAndDownloadZip(
                                              widget.currentDiagram,
                                              ownerId: currentUser.id,
                                            );
                                          },
                                          icon: const Icon(Icons.download, size: 16, color: Color(0xFF38BDF8)),
                                          label: const Text('Descargar .ZIP', style: TextStyle(fontSize: 11, color: Color(0xFF38BDF8))),
                                        ),
                                        TextButton.icon(
                                          onPressed: () {
                                            SpringBootZipService.downloadSchemaSql(widget.currentDiagram);
                                          },
                                          icon: const Icon(Icons.code, size: 16, color: Color(0xFF2DD4BF)),
                                          label: const Text('schema.sql', style: TextStyle(fontSize: 11, color: Color(0xFF2DD4BF))),
                                        ),
                                        TextButton.icon(
                                          onPressed: () {
                                            SpringBootZipService.downloadPostmanCollection(widget.currentDiagram);
                                          },
                                          icon: const Icon(Icons.send, size: 16, color: Color(0xFFF59E0B)),
                                          label: const Text('Postman', style: TextStyle(fontSize: 11, color: Color(0xFFF59E0B))),
                                        ),
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
