import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/project_provider.dart';
import '../services/stt_service.dart';
import '../widgets/voice_orb_widget.dart';

import '../services/tts_service.dart';

class VoiceAssistantScreen extends StatefulWidget {
  final VoidCallback onNavigateToCanvas;
  final int initialVoiceChannel;

  const VoiceAssistantScreen({
    Key? key,
    required this.onNavigateToCanvas,
    this.initialVoiceChannel = 0,
  }) : super(key: key);

  @override
  State<VoiceAssistantScreen> createState() => _VoiceAssistantScreenState();
}

class _VoiceAssistantScreenState extends State<VoiceAssistantScreen> {
  final _stt = SttService();
  final _tts = TtsService();
  bool _isListening = false;
  bool _hasProcessedCurrent = false;
  String _currentSpokenText = '';
  late int _voiceChannel; // 0 = Canal 1 (Arquitectura IA), 1 = Canal 2 (Comandos UML)

  @override
  void initState() {
    super.initState();
    _voiceChannel = widget.initialVoiceChannel;
  }

  @override
  void didUpdateWidget(VoiceAssistantScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialVoiceChannel != oldWidget.initialVoiceChannel) {
      _voiceChannel = widget.initialVoiceChannel;
    }
  }

  void _handleOrbTap(ProjectProvider provider) async {
    if (_isListening) {
      await _stt.stop();
      setState(() => _isListening = false);
      if (_currentSpokenText.isNotEmpty && !_hasProcessedCurrent) {
        _hasProcessedCurrent = true;
        _processCommand(provider, _currentSpokenText);
      }
    } else {
      // Interrumpir inmediatamente cualquier respuesta hablada previa
      await _tts.stop();

      setState(() {
        _isListening = true;
        _currentSpokenText = '';
        _hasProcessedCurrent = false;
      });

      await _stt.listen(
        onResult: (text) {
          setState(() {
            _currentSpokenText = text;
          });
        },
        onDone: () {
          setState(() => _isListening = false);
          if (_currentSpokenText.isNotEmpty && !_hasProcessedCurrent) {
            _hasProcessedCurrent = true;
            _processCommand(provider, _currentSpokenText);
          }
        },
      );
    }
  }

  void _processCommand(ProjectProvider provider, String text) async {
    if (_voiceChannel == 0) {
      await provider.executeAiArchitecturePrompt(text);
      if (mounted) {
        // Navega automáticamente al Lienzo UML para visualizar el sistema generado
        widget.onNavigateToCanvas?.call();
      }
    } else {
      await provider.executeAtomicVoiceCommand(text);
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
              '🎙️ Asistente de Voz Inteligente',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            Text(
              activeProject?.name ?? 'Sin proyecto activo',
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
        child: Column(
          children: [
            const SizedBox(height: 8),

            // Selector de Canales de Voz
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _voiceChannel = 0),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: _voiceChannel == 0 ? const Color(0xFF7C3AED) : Colors.transparent,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Center(
                            child: Text(
                              '✨ Canal 1: Generador IA',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _voiceChannel = 1),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: _voiceChannel == 1 ? const Color(0xFF0D9488) : Colors.transparent,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Center(
                            child: Text(
                              '🗣️ Canal 2: Comandos UML',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const Spacer(),

            // ORBE CENTRAL REACTIVO
            VoiceOrbWidget(
              isListening: _isListening,
              onTap: () => _handleOrbTap(provider),
            ),
            const SizedBox(height: 20),

            // Estado de Escucha y Transcripción
            Text(
              _isListening
                  ? 'Escuchando tu voz... Toca el orbe al terminar'
                  : 'Toca el orbe para hablar',
              style: TextStyle(
                color: _isListening ? const Color(0xFFFDA4AF) : const Color(0xFF94A3B8),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),

            if (_currentSpokenText.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF475569)),
                  ),
                  child: Text(
                    '"$_currentSpokenText"',
                    style: const TextStyle(fontSize: 12, color: Color(0xFFF1F5F9), fontStyle: FontStyle.italic),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),

            const Spacer(),

            // Diálogo de Voz Reciente
            Container(
              height: 210,
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFF0F172A),
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                border: Border(top: BorderSide(color: Color(0xFF1E293B))),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        '📜 Registro de Respuestas de Voz',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      if (provider.voiceDialogue.isNotEmpty)
                        GestureDetector(
                          onTap: provider.clearDialogue,
                          child: const Text('Limpiar', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Expanded(
                    child: provider.voiceDialogue.isEmpty
                        ? Center(
                            child: Text(
                              _voiceChannel == 0
                                  ? 'Di algo como: "Crear sistema para hotelería con habitaciones y huéspedes"'
                                  : 'Di algo como: "Crear clase Cliente", "Agregar atributo teléfono a Cliente"',
                              style: const TextStyle(fontSize: 11, color: Color(0xFF475569)),
                              textAlign: TextAlign.center,
                            ),
                          )
                        : ListView.builder(
                            itemCount: provider.voiceDialogue.length,
                            itemBuilder: (context, index) {
                              final item = provider.voiceDialogue[index];
                              final isAi = item['type'] == 'ai';
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF1E293B),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isAi ? const Color(0xFF7C3AED).withOpacity(0.4) : const Color(0xFF0D9488).withOpacity(0.4),
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          isAi ? '✨ Arquitectura IA' : '🎙️ Comando UML',
                                          style: TextStyle(
                                            fontSize: 9,
                                            fontWeight: FontWeight.bold,
                                            color: isAi ? const Color(0xFFA78BFA) : const Color(0xFF2DD4BF),
                                          ),
                                        ),
                                        const Spacer(),
                                        Text(item['time'] ?? '', style: const TextStyle(fontSize: 9, color: Color(0xFF64748B))),
                                      ],
                                    ),
                                    const SizedBox(height: 3),
                                    Text('🗣️ "${item['user']}"', style: const TextStyle(fontSize: 11, color: Color(0xFFE2E8F0))),
                                    const SizedBox(height: 3),
                                    Text('🤖 ${item['response']}', style: const TextStyle(fontSize: 11, color: Color(0xFF38BDF8), fontWeight: FontWeight.w500)),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
