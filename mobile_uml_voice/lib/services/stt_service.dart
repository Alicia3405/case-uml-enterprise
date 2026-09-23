import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

/// Servicio de Reconocimiento de Voz (STT)
class SttService {
  static final SttService _instance = SttService._internal();
  factory SttService() => _instance;
  SttService._internal();

  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _isAvailable = false;
  bool _isListening = false;

  bool get isListening => _isListening || _speech.isListening;
  bool get isAvailable => _isAvailable;

  Future<bool> init() async {
    if (_isAvailable) return true;
    try {
      _isAvailable = await _speech.initialize(
        onError: (val) {
          debugPrint('STT onError: ${val.errorMsg}');
          _isListening = false;
        },
        onStatus: (val) {
          debugPrint('STT onStatus: $val');
          if (val == 'done' || val == 'notListening') {
            _isListening = false;
          } else if (val == 'listening') {
            _isListening = true;
          }
        },
      );
      return _isAvailable;
    } catch (e) {
      debugPrint('STT init error: $e');
      _isAvailable = false;
      return false;
    }
  }

  Future<void> listen({
    required Function(String text) onResult,
    required VoidCallback onDone,
  }) async {
    final available = await init();
    if (!available) {
      debugPrint('El micrófono no está disponible en este dispositivo/navegador.');
      return;
    }

    // Prevenir InvalidStateError en Flutter Web si la sesión previa no ha terminado
    if (_isListening || _speech.isListening) {
      try {
        await _speech.stop();
        await Future.delayed(const Duration(milliseconds: 150));
      } catch (_) {}
    }

    _isListening = true;
    try {
      await _speech.listen(
        onResult: (result) {
          onResult(result.recognizedWords);
          if (result.finalResult) {
            _isListening = false;
            onDone();
          }
        },
        localeId: 'es_ES',
        cancelOnError: true,
        partialResults: true,
        pauseFor: const Duration(milliseconds: 3500),
        listenFor: const Duration(seconds: 60),
      );
    } catch (e) {
      debugPrint('Error al escuchar: $e');
      _isListening = false;
      onDone();
    }
  }

  Future<void> stop() async {
    try {
      if (_isListening || _speech.isListening) {
        await _speech.stop();
      }
    } catch (e) {
      debugPrint('Error al detener STT: $e');
    } finally {
      _isListening = false;
    }
  }
}
