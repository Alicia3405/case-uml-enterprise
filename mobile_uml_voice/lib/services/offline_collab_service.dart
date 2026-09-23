import 'dart:async';
import 'package:flutter/foundation.dart';

enum CollabMutationType {
  addClass,
  updateClass,
  deleteClass,
  addRelation,
}

class CollabPendingMutation {
  final String id;
  final CollabMutationType type;
  final String entityName;
  final DateTime timestamp;
  final Map<String, dynamic> payload;

  CollabPendingMutation({
    required this.id,
    required this.type,
    required this.entityName,
    required this.timestamp,
    required this.payload,
  });
}

/// Servicio para Colaboración Offline-First y Sincronización Automática al Reconectar
class OfflineCollabService extends ChangeNotifier {
  static final OfflineCollabService _instance = OfflineCollabService._internal();
  factory OfflineCollabService() => _instance;
  OfflineCollabService._internal();

  bool _isOnline = true;
  final List<CollabPendingMutation> _pendingQueue = [];

  bool get isOnline => _isOnline;
  int get pendingCount => _pendingQueue.length;
  List<CollabPendingMutation> get pendingQueue => List.unmodifiable(_pendingQueue);

  /// Cambia el estado de conexión (Simulado o por conectividad real)
  void setOnlineStatus(bool online) {
    if (_isOnline == online) return;
    _isOnline = online;
    notifyListeners();
  }

  /// Alterna entre Online y Offline para pruebas
  void toggleConnection() {
    setOnlineStatus(!_isOnline);
  }

  /// Registra una mutación en la cola offline si no hay red
  void queueMutation({
    required CollabMutationType type,
    required String entityName,
    required Map<String, dynamic> payload,
  }) {
    if (_isOnline) return;

    final mutation = CollabPendingMutation(
      id: 'mut_${DateTime.now().millisecondsSinceEpoch}',
      type: type,
      entityName: entityName,
      timestamp: DateTime.now(),
      payload: payload,
    );
    _pendingQueue.add(mutation);
    notifyListeners();
  }

  /// Sincroniza y vacía los cambios pendientes acumulados al recuperar conexión
  Future<int> syncPendingMutations() async {
    if (_pendingQueue.isEmpty) return 0;

    // Simula envío por WebSockets / REST API con reintentos
    await Future.delayed(const Duration(milliseconds: 800));
    final count = _pendingQueue.length;
    _pendingQueue.clear();
    notifyListeners();
    return count;
  }
}
