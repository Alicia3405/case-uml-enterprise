import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/project_provider.dart';
import '../services/stt_service.dart';
import '../services/tts_service.dart';

class VoiceDockSheet extends StatefulWidget {
  const VoiceDockSheet({Key? key}) : super(key: key);

  @override
  State<VoiceDockSheet> createState() => _VoiceDockSheetState();
}

class _VoiceDockSheetState extends State<VoiceDockSheet> {
  final _textCtrl = TextEditingController();
  final _stt = SttService();
  bool _isAiMode = true; // true = Canal 1 (Arquitectura IA), false = Canal 2 (Comando atómico)
  bool _isListening = false;

  final List<String> _aiPresets = [
    'Crear sistema para clínica veterinaria con cliente, mascota y veterinario',
    'Crear sistema para hotelería con hotel, habitación, huésped y reserva',
    'Crear sistema para ventas con cliente, factura y producto',
  ];

  final List<String> _cmdPresets = [
    'Crear clase Factura',
    'Agregar atributo telefono tipo String en la tabla Cliente',
    'Agregar método calcularTotal tipo Double a Factura',
    'Conectar Hotel con Habitacion',
    'Eliminar método procesar de Habitacion',
    'Limpiar lienzo',
    'Deshacer',
  ];

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  void _toggleListening() async {
    // Interrumpir inmediatamente cualquier respuesta hablada previa
    await TtsService().stop();

    if (_isListening) {
      await _stt.stop();
      setState(() => _isListening = false);
    } else {
      setState(() => _isListening = true);
      await _stt.listen(
        onResult: (text) {
          setState(() {
            _textCtrl.text = text;
          });
        },
        onDone: () {
          setState(() => _isListening = false);
        },
      );
    }
  }

  void _execute(ProjectProvider provider) {
    final text = _textCtrl.text.trim();
    if (text.isEmpty) return;

    if (_isAiMode) {
      provider.executeAiArchitecturePrompt(text);
    } else {
      provider.executeAtomicVoiceCommand(text);
    }

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
        top: 20,
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
            const SizedBox(height: 16),

            // Selector de Canales de Voz
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _isAiMode = true),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      decoration: BoxDecoration(
                        color: _isAiMode ? const Color(0xFF7C3AED) : const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _isAiMode ? const Color(0xFFA78BFA) : Colors.transparent,
                        ),
                      ),
                      child: const Center(
                        child: Text(
                          '✨ Canal 1: Arquitectura IA',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _isAiMode = false),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      decoration: BoxDecoration(
                        color: !_isAiMode ? const Color(0xFF0D9488) : const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: !_isAiMode ? const Color(0xFF2DD4BF) : Colors.transparent,
                        ),
                      ),
                      child: const Center(
                        child: Text(
                          '🎙️ Canal 2: Comando UML',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Campo de entrada y botón de dictado
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textCtrl,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: _isAiMode
                          ? 'Describe el sistema (ej. Veterinaria con Mascotas)...'
                          : 'Ej: Crear clase Paciente, o Conectar Hotel con Habitacion...',
                      hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFF1E293B),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFF334155)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(
                          color: _isAiMode ? const Color(0xFFA855F7) : const Color(0xFF14B8A6),
                        ),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                IconButton.filled(
                  onPressed: _toggleListening,
                  style: IconButton.styleFrom(
                    backgroundColor: _isListening ? const Color(0xFFE11D48) : const Color(0xFF334155),
                    padding: const EdgeInsets.all(12),
                  ),
                  icon: Icon(_isListening ? Icons.mic : Icons.mic_none, color: Colors.white),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Píldoras de sugerencias rápidas
            Text(
              _isAiMode ? '⚡ Sistemas rápidos (1 toque):' : '⚡ Comandos frecuentes (1 toque):',
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: (_isAiMode ? _aiPresets : _cmdPresets).map((p) {
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
            const SizedBox(height: 18),

            // Botón Ejecutar
            ElevatedButton(
              onPressed: () => _execute(provider),
              style: ElevatedButton.styleFrom(
                backgroundColor: _isAiMode ? const Color(0xFF7C3AED) : const Color(0xFF0D9488),
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(
                _isAiMode ? '✨ Sintetizar Arquitectura Completa' : '🚀 Ejecutar Comando en el Lienzo',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
