import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';

class ApiSyncHelper {
  static String getBackendBaseUrl() {
    return 'http://localhost:8080';
  }

  static Future<String?> httpGet(String path) async {
    try {
      final base = getBackendBaseUrl();
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 4);
      final request = await client.getUrl(Uri.parse('$base$path'));
      final response = await request.close();
      if (response.statusCode == 200) {
        final respBody = await response.transform(utf8.decoder).join();
        return respBody;
      }
    } catch (e) {
      debugPrint('Error GET $path: $e');
    }
    return null;
  }

  static Future<String?> httpPost(String path, Map<String, dynamic> body) async {
    try {
      final base = getBackendBaseUrl();
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 4);
      final request = await client.postUrl(Uri.parse('$base$path'));
      request.headers.set('content-type', 'application/json');
      request.write(jsonEncode(body));
      final response = await request.close();
      if (response.statusCode == 200) {
        final respBody = await response.transform(utf8.decoder).join();
        return respBody;
      }
    } catch (e) {
      debugPrint('Error POST $path: $e');
    }
    return null;
  }

  static Future<String?> httpPostList(String path, List<dynamic> body) async {
    try {
      final base = getBackendBaseUrl();
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 4);
      final request = await client.postUrl(Uri.parse('$base$path'));
      request.headers.set('content-type', 'application/json');
      request.write(jsonEncode(body));
      final response = await request.close();
      if (response.statusCode == 200) {
        final respBody = await response.transform(utf8.decoder).join();
        return respBody;
      }
    } catch (e) {
      debugPrint('Error POST list $path: $e');
    }
    return null;
  }
}
