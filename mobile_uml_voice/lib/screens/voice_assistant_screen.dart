import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/project_provider.dart';
import '../services/stt_service.dart';
import '../services/tts_service.dart';
import '../widgets/voice_orb_widget.dart';

/// Pantalla Exclusiva: Generador Inteligente de Sistemas UML por IA y Voz
class VoiceAssistantScreen extends StatefulWidget {
  final VoidCallback onNavigateToCanvas;

  const VoiceAssistantScreen({
    Key? key,
    required this.onNavigateToCanvas,
  }) : super(key: key);

  @override
  State<VoiceAssistantScreen> createState() => _VoiceAssistantScreenState();
}

class _VoiceAssistantScreenState extends State<VoiceAssistantScreen> {
  final _stt = SttService();
  final _tts = TtsService();
  final _textCtrl = TextEditingController();
  bool _isListening = false;
  bool _hasProcessedCurrent = false;
  String _currentSpokenText = '';

  final List<String> _examplePrompts = [
    'Crear sistema para veterinaria con clase Doctor con atributos id, nombre, fecha, clase Animal con id, nombre, nombreDueño',
    'Crear sistema para hotelería con hotel, habitación, huésped y reserva',
    'Crear sistema de ventas con cliente, factura, detalle y producto',
    'Crear sistema para biblioteca con libro, autor, lector y préstamo',
  ];

  @override
  void dispose() {
    _textCtrl.dispose();
    _stt.stop();
    super.dispose();
  }

  void _handleOrbTap(ProjectProvider provider) async {
    if (_isListening) {
      await _stt.stop();
      setState(() => _isListening = false);
      if (_currentSpokenText.isNotEmpty && !_hasProcessedCurrent) {
        _hasProcessedCurrent = true;
        _processAiPrompt(provider, _currentSpokenText);
      }
    } else {
      await _tts.stop();

      setState(() {
        _isListening = true;
        _currentSpokenText = '';
        _hasProcessedCurrent = false;
      });

      await _stt.listen(
        onResult: (text) {
          if (mounted) {
            setState(() {
              _currentSpokenText = text;
              _textCtrl.text = text;
            });
          }
        },
        onDone: () {
          if (mounted) {
            setState(() => _isListening = false);
            if (_currentSpokenText.isNotEmpty && !_hasProcessedCurrent) {
              _hasProcessedCurrent = true;
              _processAiPrompt(provider, _currentSpokenText);
            }
          }
        },
      );
    }
  }

  void _processAiPrompt(ProjectProvider provider, String text) async {
    final clean = text.trim();
    if (clean.isEmpty) return;

    await provider.executeAiArchitecturePrompt(clean);
    if (mounted) {
      _textCtrl.clear();
      // Navega automáticamente al Lienzo UML para visualizar el sistema generado
      widget.onNavigateToCanvas();
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProjectProvider>();
    final activeProject = provider.activeProject;

    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B0F19),
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '✨ Generador de Sistemas IA',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            Text(
              activeProject?.name ?? 'Diseño de Arquitectura UML',
              style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          TextButton.icon(
            onPressed: widget.onNavigateToCanvas,
            icon: const Icon(Icons.hub_outlined, color: Color(0xFF38BDF8), size: 18),
            label: const Text('Ver Lienzo', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 12)),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ORBE CENTRAL REACTIVO DE VOZ
              const SizedBox(height: 12),
              Center(
                child: VoiceOrbWidget(
                  isListening: _isListening,
                  onTap: () => _handleOrbTap(provider),
                ),
              ),
              const SizedBox(height: 14),

              // Estado de Escucha y Transcripción
              Center(
                child: Text(
                  _isListening
                      ? '🎙️ Escuchando... Dicta tu sistema y toca el orbe al terminar'
                      : 'Toca el orbe para dictar tu arquitectura a la IA',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _isListening ? const Color(0xFFFDA4AF) : const Color(0xFF94A3B8),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Cuadro de Entrada de Texto
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.edit_note, color: Color(0xFFA855F7), size: 18),
                        SizedBox(width: 6),
                        Text(
                          'O escribe la descripción del sistema:',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _textCtrl,
                      maxLines: 2,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Ej. Crear sistema veterinaria con clase Doctor con id, nombre, clase Animal con id, nombre...',
                        hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 10),
                    ElevatedButton.icon(
                      onPressed: () => _processAiPrompt(provider, _textCtrl.text),
                      icon: const Icon(Icons.auto_awesome, size: 16, color: Colors.white),
                      label: const Text(
                        '✨ Sintetizar Sistema en el Lienzo',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF7C3AED),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Guía rápida de qué decir / Ejemplos
              const Text(
                '💡 Guía de Ejemplos (Toca para probar):',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 8),
              ..._examplePrompts.map((p) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: InkWell(
                    onTap: () {
                      _textCtrl.text = p;
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B).withOpacity(0.6),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF334155)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.touch_app, size: 14, color: Color(0xFF38BDF8)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              p,
                              style: const TextStyle(fontSize: 11, color: Color(0xFFE2E8F0)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
              const SizedBox(height: 16),

              // Historial de respuestas de IA recientes
              if (provider.voiceDialogue.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF1E293B)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            '📜 Registro de Sistemas Generados',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          GestureDetector(
                            onTap: provider.clearDialogue,
                            child: const Text('Limpiar', style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      ...provider.voiceDialogue.take(3).map((item) {
                        return Container(
                          margin: const EdgeInsets.only(bottom: 6),
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFF7C3AED).withOpacity(0.3)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('🗣️ "${item['user']}"', style: const TextStyle(fontSize: 11, color: Color(0xFFE2E8F0))),
                              const SizedBox(height: 2),
                              Text('🤖 ${item['response']}', style: const TextStyle(fontSize: 10, color: Color(0xFF38BDF8))),
                            ],
                          ),
                        );
                      }),
                    ],
                  ),
                ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}
