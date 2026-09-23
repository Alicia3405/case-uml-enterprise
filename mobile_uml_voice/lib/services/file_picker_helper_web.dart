// ignore: avoid_web_libraries_in_flutter
import 'dart:async';
import 'dart:html' as html;

/// Abre un selector de archivos nativo del navegador para leer texto (ej. .xmi, .xml)
Future<String?> pickTextFileWeb({List<String> extensions = const ['xmi', 'xml']}) {
  final completer = Completer<String?>();
  final accept = extensions.map((e) => '.$e').join(',');

  final input = html.FileUploadInputElement()
    ..accept = accept
    ..multiple = false;

  input.onChange.listen((e) {
    final files = input.files;
    if (files == null || files.isEmpty) {
      completer.complete(null);
      return;
    }

    final reader = html.FileReader();
    reader.onLoadEnd.listen((e) {
      completer.complete(reader.result as String?);
    });
    reader.onError.listen((e) {
      completer.complete(null);
    });
    reader.readAsText(files[0]);
  });

  input.click();
  return completer.future;
}

/// Abre un selector de imagen o cámara nativo del navegador
Future<String?> pickImageWeb({bool captureCamera = false}) {
  final completer = Completer<String?>();

  final input = html.FileUploadInputElement()
    ..accept = 'image/*'
    ..multiple = false;

  if (captureCamera) {
    input.setAttribute('capture', 'environment');
  }

  input.onChange.listen((e) {
    final files = input.files;
    if (files == null || files.isEmpty) {
      completer.complete(null);
      return;
    }

    final reader = html.FileReader();
    reader.onLoadEnd.listen((e) {
      // Retorna data:image/png;base64,...
      completer.complete(reader.result as String?);
    });
    reader.onError.listen((e) {
      completer.complete(null);
    });
    reader.readAsDataUrl(files[0]);
  });

  input.click();
  return completer.future;
}
