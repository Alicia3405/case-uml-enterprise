import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ClassLockInfo {
  final String classId;
  final String userId;
  final String userName;
  final String userColor;
  final DateTime lockedAt;

  ClassLockInfo({
    required this.classId,
    required this.userId,
    required this.userName,
    required this.userColor,
    required this.lockedAt,
  });

  Map<String, dynamic> toJson() => {
    'classId': classId,
    'userId': userId,
    'userName': userName,
    'userColor': userColor,
    'lockedAt': lockedAt.toIso8601String(),
  };

  factory ClassLockInfo.fromJson(Map<String, dynamic> json) => ClassLockInfo(
    classId: json['classId'] ?? '',
    userId: json['userId'] ?? '',
    userName: json['userName'] ?? 'Colaborador',
    userColor: json['userColor'] ?? '#F59E0B',
    lockedAt: json['lockedAt'] != null ? DateTime.tryParse(json['lockedAt']) ?? DateTime.now() : DateTime.now(),
  );
}

/// Servicio de Exclusión Mutua y Bloqueo Colaborativo en Tiempo Real (Candado)
class CollabLockService extends ChangeNotifier {
  static final CollabLockService _instance = CollabLockService._internal();
  factory CollabLockService() => _instance;
  CollabLockService._internal();

  static const String _lockPrefix = 'case_uml_class_lock_';

  // Caché en memoria de bloqueos activos por clase
  final Map<String, ClassLockInfo> _activeLocks = {};

  Map<String, ClassLockInfo> get activeLocks => Map.unmodifiable(_activeLocks);

  /// Consulta si una clase está bloqueada por otro colaborador
  ClassLockInfo? getLock(String classId) {
    final lock = _activeLocks[classId];
    if (lock != null) {
      // Expirar bloqueos viejos tras 5 minutos por seguridad si alguien se desconectó
      if (DateTime.now().difference(lock.lockedAt).inMinutes > 5) {
        _activeLocks.remove(classId);
        return null;
      }
    }
    return lock;
  }

  /// Bloquea una clase cuando un colaborador comienza a editarla
  Future<bool> acquireLock({
    required String classId,
    required String userId,
    required String userName,
    required String userColor,
  }) async {
    final existing = getLock(classId);
    if (existing != null && existing.userId != userId) {
      // Ya está ocupada por otro usuario
      return false;
    }

    final info = ClassLockInfo(
      classId: classId,
      userId: userId,
      userName: userName,
      userColor: userColor,
      lockedAt: DateTime.now(),
    );

    _activeLocks[classId] = info;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('$_lockPrefix$classId', jsonEncode(info.toJson()));
    } catch (_) {}

    return true;
  }

  /// Libera el candado de la clase cuando termina la edición o se cierra la ventana
  Future<void> releaseLock(String classId, {String? userId}) async {
    final lock = _activeLocks[classId];
    if (lock != null) {
      if (userId == null || lock.userId == userId) {
        _activeLocks.remove(classId);
        notifyListeners();

        try {
          final prefs = await SharedPreferences.getInstance();
          await prefs.remove('$_lockPrefix$classId');
        } catch (_) {}
      }
    }
  }

  /// Carga los bloqueos persistentes desde almacenamiento local
  Future<void> syncLocksFromStorage([List<String>? classIds]) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      bool changed = false;
      final keysToInspect = classIds != null
          ? classIds.map((cid) => '$_lockPrefix$cid')
          : prefs.getKeys().where((k) => k.startsWith(_lockPrefix));

      for (final key in keysToInspect) {
        final raw = prefs.getString(key);
        if (raw != null && raw.isNotEmpty) {
          try {
            final parsed = ClassLockInfo.fromJson(jsonDecode(raw));
            if (DateTime.now().difference(parsed.lockedAt).inMinutes <= 5) {
              _activeLocks[parsed.classId] = parsed;
              changed = true;
            } else {
              await prefs.remove(key);
            }
          } catch (_) {}
        }
      }
      if (changed) notifyListeners();
    } catch (_) {}
  }
}
