// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

/// Descarga de archivos Blob en el navegador Web (Chrome, Edge, etc.)
void downloadBlobFile(String filename, List<int> bytes) {
  final blob = html.Blob([bytes], 'application/zip');
  final url = html.Url.createObjectUrlFromBlob(blob);
  final anchor = html.AnchorElement(href: url)
    ..setAttribute('download', filename)
    ..click();
  html.Url.revokeObjectUrl(url);
}
