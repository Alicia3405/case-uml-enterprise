// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'dart:convert';
import 'package:flutter/foundation.dart';

class ApiSyncHelper {
  static String getBackendBaseUrl() {
    try {
      final host = html.window.location.hostname;
      if (host != null && host.isNotEmpty) {
        final protocol = html.window.location.protocol == 'https:' ? 'https:' : 'http:';
        return '$protocol://$host:8080';
      }
    } catch (_) {}
    return 'http://localhost:8080';
  }

  static Future<String?> httpGet(String path) async {
    try {
      final base = getBackendBaseUrl();
      final url = '$base$path';
      final req = await html.HttpRequest.request(url, method: 'GET');
      if (req.status == 200) {
        return req.responseText;
      }
    } catch (e) {
      debugPrint('Error GET $path: $e');
    }
    return null;
  }

  static Future<String?> httpPost(String path, Map<String, dynamic> body) async {
    try {
      final base = getBackendBaseUrl();
      final url = '$base$path';
      final req = await html.HttpRequest.request(
        url,
        method: 'POST',
        sendData: jsonEncode(body),
        requestHeaders: {'Content-Type': 'application/json'},
      );
      if (req.status == 200) {
        return req.responseText;
      }
    } catch (e) {
      debugPrint('Error POST $path: $e');
    }
    return null;
  }

  static Future<String?> httpPostList(String path, List<dynamic> body) async {
    try {
      final base = getBackendBaseUrl();
      final url = '$base$path';
      final req = await html.HttpRequest.request(
        url,
        method: 'POST',
        sendData: jsonEncode(body),
        requestHeaders: {'Content-Type': 'application/json'},
      );
      if (req.status == 200) {
        return req.responseText;
      }
    } catch (e) {
      debugPrint('Error POST list $path: $e');
    }
    return null;
  }
}
