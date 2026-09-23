// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'dart:convert';
import 'package:flutter/foundation.dart';

class ApiSyncHelper {
  static const String deployedAwsIp = '3.85.188.197';

  static String getBackendBaseUrl() {
    try {
      final loc = html.window.location;
      final host = loc.hostname;
      if (host != null && host.isNotEmpty && host != 'localhost' && host != '127.0.0.1') {
        final isHttps = loc.protocol.contains('https');
        final scheme = isHttps ? 'https' : 'http';
        return '$scheme://$host:8080';
      }
    } catch (_) {}
    return 'http://$deployedAwsIp:8080';
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
      // Fallback a IP pública si localhost falla
      try {
        final fallbackUrl = 'http://$deployedAwsIp:8080$path';
        final req2 = await html.HttpRequest.request(fallbackUrl, method: 'GET');
        if (req2.status == 200) {
          return req2.responseText;
        }
      } catch (_) {}
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
      try {
        final fallbackUrl = 'http://$deployedAwsIp:8080$path';
        final req2 = await html.HttpRequest.request(
          fallbackUrl,
          method: 'POST',
          sendData: jsonEncode(body),
          requestHeaders: {'Content-Type': 'application/json'},
        );
        if (req2.status == 200) {
          return req2.responseText;
        }
      } catch (_) {}
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
      try {
        final fallbackUrl = 'http://$deployedAwsIp:8080$path';
        final req2 = await html.HttpRequest.request(
          fallbackUrl,
          method: 'POST',
          sendData: jsonEncode(body),
          requestHeaders: {'Content-Type': 'application/json'},
        );
        if (req2.status == 200) {
          return req2.responseText;
        }
      } catch (_) {}
    }
    return null;
  }
}
