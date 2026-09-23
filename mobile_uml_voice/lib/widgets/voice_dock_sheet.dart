import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/project_provider.dart';
import '../services/stt_service.dart';
import '../services/tts_service.dart';

/// Modal Dock exclusivo para Comandos de Voz UML en el Lienzo (1 toque)
class VoiceDockSheet extends StatefulWidget {
  const VoiceDockSheet({Key? key}) : super(key: key);

  @override
  State<VoiceDockSheet> createState() => _VoiceDockSheetState();
}

class _VoiceDockSheetState extends State<VoiceDockSheet> with SingleTickerProviderStateMixin {
  final _textCtrl = TextEditingController();
  final _stt = SttService();
  bool _isListening = false;
  late AnimationController _animCtrl;

  final List<String> _cmdPresets = [
    'Crear clase Factura',
    'Agregar atributo telefono tipo String a Cliente',
    'Agregar metodo calcularTotal tipo Double a Factura',
    'Conectar Cliente con Factura',
    'Eliminar metodo procesar de Habitacion',
    'Eliminar clase Factura',
    'Limpiar lienzo',
    'Deshacer',
  ];

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000))..repeat(reverse: true);
    // Iniciar escucha inmediatamente al abrir para fluidez máxima
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startListening();
    });
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _textCtrl.dispose();
    _stt.stop();
    super.dispose();
  }

  void _startListening() async {
    await TtsService().stop();
    setState(() => _isListening = true);
    await _stt.listen(
      onResult: (text) {
        if (mounted) {
          setState(() {
            _textCtrl.text = text;
          });
        }
      },
      onDone: () {
        if (mounted) {
          setState(() => _isListening = false);
        }
      },
    );
  }

  void _toggleListening() async {
    await TtsService().stop();
    if (_isListening) {
      await _stt.stop();
      setState(() => _isListening = false);
    } else {
      _startListening();
    }
  }

  void _execute(ProjectProvider provider) {
    final text = _textCtrl.text.trim();
    if (text.isEmpty) return;

    provider.executeAtomicVoiceCommand(text);
    _textCtrl.clear();
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.read<ProjectProvider>();

    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: Color(0xFF334155), width: 1.5)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Indicador superior
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFF475569),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Título y Estado de Micrófono
            Row(
              children: [
                const Icon(Icons.mic, color: Color(0xFF2DD4BF), size: 20),
                const SizedBox(width: 8),
                const Text(
                  'Comando de Voz UML',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const Spacer(),
                if (_isListening)
                  AnimatedBuilder(
                    animation: _animCtrl,
                    builder: (context, child) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE11D48).withOpacity(0.2 + _animCtrl.value * 0.3),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE11D48)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.fiber_manual_record, color: Color(0xFFE11D48), size: 10),
                          SizedBox(width: 4),
                          Text(
                            'GRABANDO',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFFDA4AF)),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),

            // Campo de entrada y botón de micrófono
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textCtrl,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Ej: Crear clase Factura, Agregar atributo total...',
                      hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF1E293B),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFF334155)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFF2DD4BF)),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                IconButton.filled(
                  onPressed: _toggleListening,
                  style: IconButton.styleFrom(
                    backgroundColor: _isListening ? const Color(0xFFE11D48) : const Color(0xFF0D9488),
                    padding: const EdgeInsets.all(12),
                  ),
                  icon: Icon(_isListening ? Icons.stop : Icons.mic, color: Colors.white),
                  tooltip: _isListening ? 'Detener grabación' : 'Grabar por voz',
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Píldoras de sugerencias rápidas
            const Text(
              '⚡ Comandos frecuentes (1 toque):',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _cmdPresets.map((p) {
                return ActionChip(
                  label: Text(p, style: const TextStyle(fontSize: 10, color: Color(0xFFE2E8F0))),
                  backgroundColor: const Color(0xFF1E293B),
                  side: const BorderSide(color: Color(0xFF334155)),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  onPressed: () {
                    _textCtrl.text = p;
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // Botón Ejecutar
            ElevatedButton.icon(
              onPressed: () => _execute(provider),
              icon: const Icon(Icons.bolt, size: 18, color: Colors.white),
              label: const Text(
                '🚀 Aplicar Comando en el Lienzo',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0D9488),
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
