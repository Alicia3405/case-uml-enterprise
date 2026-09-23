import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';

class ApiSyncHelper {
  // IP del Servidor AWS EC2 desplegado
  static const String serverHost = '3.85.188.197';
  static const String serverPort = '8080';

  static String getBackendBaseUrl() {
    return 'http://$serverHost:$serverPort';
  }

  static Future<String?> httpGet(String path) async {
    // 1. Intentar servidor en la nube desplegado en AWS
    final primary = await _tryGet('$getBackendBaseUrl()$path');
    if (primary != null) return primary;

    // 2. Fallback para emuladores Android o red local
    final fallbackAndroid = await _tryGet('http://10.0.2.2:$serverPort$path');
    if (fallbackAndroid != null) return fallbackAndroid;

    // 3. Fallback localhost
    return await _tryGet('http://localhost:$serverPort$path');
  }

  static Future<String?> _tryGet(String url) async {
    try {
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 4);
      final request = await client.getUrl(Uri.parse(url));
      final response = await request.close();
      if (response.statusCode == 200) {
        return await response.transform(utf8.decoder).join();
      }
    } catch (_) {}
    return null;
  }

  static Future<String?> httpPost(String path, Map<String, dynamic> body) async {
    final urls = [
      '$getBackendBaseUrl()$path',
      'http://10.0.2.2:$serverPort$path',
      'http://localhost:$serverPort$path',
    ];

    for (final url in urls) {
      try {
        final client = HttpClient();
        client.connectionTimeout = const Duration(seconds: 4);
        final request = await client.postUrl(Uri.parse(url));
        request.headers.set('content-type', 'application/json');
        request.write(jsonEncode(body));
        final response = await request.close();
        if (response.statusCode == 200) {
          return await response.transform(utf8.decoder).join();
        }
      } catch (_) {}
    }
    return null;
  }

  static Future<String?> httpPostList(String path, List<dynamic> body) async {
    final urls = [
      '$getBackendBaseUrl()$path',
      'http://10.0.2.2:$serverPort$path',
      'http://localhost:$serverPort$path',
    ];

    for (final url in urls) {
      try {
        final client = HttpClient();
        client.connectionTimeout = const Duration(seconds: 4);
        final request = await client.postUrl(Uri.parse(url));
        request.headers.set('content-type', 'application/json');
        request.write(jsonEncode(body));
        final response = await request.close();
        if (response.statusCode == 200) {
          return await response.transform(utf8.decoder).join();
        }
      } catch (_) {}
    }
    return null;
  }
}
