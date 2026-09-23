import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/auth_models.dart';

/// Servicio de Autenticación para App Móvil
class AuthService extends ChangeNotifier {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  static const String _authKey = 'mobile_active_user';
  static const String _usersKey = 'mobile_custom_users';

  static const List<AppUser> defaultUsers = [
    AppUser(
      id: 'usr_pedro_01',
      username: 'pedro.quispe',
      nombreCompleto: 'Ing. Pedro Quispe',
      rol: 'USUARIO',
      color: '#38BDF8',
      departamento: 'Auditoría y Pruebas',
    ),
    AppUser(
      id: 'usr_maria_02',
      username: 'maria.lopez',
      nombreCompleto: 'Ing. María López',
      rol: 'USUARIO',
      color: '#EC4899',
      departamento: 'Diseño e Ingeniería',
    ),
    AppUser(
      id: 'usr_carlos_03',
      username: 'carlos.gomez',
      nombreCompleto: 'Ing. Carlos Gómez',
      rol: 'USUARIO',
      color: '#10B981',
      departamento: 'Arquitectura de Datos',
    ),
    AppUser(
      id: 'usr_ana_04',
      username: 'ana.morales',
      nombreCompleto: 'Lic. Ana Morales',
      rol: 'USUARIO',
      color: '#F59E0B',
      departamento: 'Gestión de Calidad',
    ),
    AppUser(
      id: 'usr_jorge_05',
      username: 'jorge.ramos',
      nombreCompleto: 'Ing. Jorge Ramos',
      rol: 'USUARIO',
      color: '#6366F1',
      departamento: 'Infraestructura & Cloud',
    ),
    AppUser(
      id: 'usr_admin_00',
      username: 'admin',
      nombreCompleto: 'Administrador del Sistema',
      rol: 'ADMINISTRADOR',
      color: '#8B5CF6',
      departamento: 'Gerencia General & TI',
    ),
  ];

  List<AppUser> _allUsers = [];
  List<AppUser> get allUsers => _allUsers.isNotEmpty ? _allUsers : defaultUsers;

  AppUser? _currentUser;
  AppUser? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    
    // Cargar usuarios dinámicos
    final rawUsers = prefs.getString(_usersKey);
    if (rawUsers != null && rawUsers.isNotEmpty) {
      try {
        final List<dynamic> decoded = jsonDecode(rawUsers);
        _allUsers = decoded.map((u) => AppUser.fromJson(u)).toList();
      } catch (e) {
        _allUsers = List.from(defaultUsers);
      }
    } else {
      _allUsers = List.from(defaultUsers);
    }

    // Cargar usuario activo
    final raw = prefs.getString(_authKey);
    if (raw != null) {
      try {
        _currentUser = AppUser.fromJson(jsonDecode(raw));
        notifyListeners();
      } catch (e) {
        debugPrint('Error decodificando usuario guardado: $e');
      }
    }
  }

  Future<void> createUser(AppUser user) async {
    if (_allUsers.isEmpty) {
      _allUsers = List.from(defaultUsers);
    }
    // Evitar duplicados por username
    _allUsers.removeWhere((u) => u.username.toLowerCase() == user.username.toLowerCase());
    _allUsers.add(user);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_usersKey, jsonEncode(_allUsers.map((u) => u.toJson()).toList()));
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    final clean = username.trim().toLowerCase();
    final list = allUsers;
    final found = list.firstWhere(
      (u) => u.username.toLowerCase() == clean,
      orElse: () => list.first,
    );

    _currentUser = found;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_authKey, jsonEncode(found.toJson()));
    notifyListeners();
    return true;
  }

  Future<void> loginAs(AppUser user) async {
    _currentUser = user;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_authKey, jsonEncode(user.toJson()));
    notifyListeners();
  }

  Future<bool> changePassword(String currentPassword, String newPassword) async {
    if (_currentUser == null) return false;
    final prefs = await SharedPreferences.getInstance();
    final pwdKey = 'mobile_pwd_${_currentUser!.username.toLowerCase()}';
    final savedPwd = prefs.getString(pwdKey) ?? '123456';

    if (currentPassword != savedPwd) {
      return false;
    }

    await prefs.setString(pwdKey, newPassword);
    return true;
  }

  Future<void> updateAvatar(String avatarUrl) async {
    if (_currentUser == null) return;
    _currentUser = _currentUser!.copyWith(avatarUrl: avatarUrl);
    
    // Actualizar en la lista general de usuarios
    final idx = _allUsers.indexWhere((u) => u.id == _currentUser!.id);
    if (idx >= 0) {
      _allUsers[idx] = _currentUser!;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_usersKey, jsonEncode(_allUsers.map((u) => u.toJson()).toList()));
      await prefs.setString(_authKey, jsonEncode(_currentUser!.toJson()));
    }
    notifyListeners();
  }

  Future<void> logout() async {
    _currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_authKey);
    notifyListeners();
  }
}
