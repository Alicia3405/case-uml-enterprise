import 'package:flutter/foundation.dart';

/// Fallback / Stub para plataformas no-web
void downloadBlobFile(String filename, List<int> bytes) {
  debugPrint('Descarga local de $filename (${bytes.length} bytes)');
}
