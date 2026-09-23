/// Modelo de Usuario para Autenticación Móvil compatible con la Web
class AppUser {
  final String id;
  final String username;
  final String nombreCompleto;
  final String rol; // 'ADMINISTRADOR' | 'USUARIO'
  final String color;
  final String avatarUrl;
  final String departamento;

  const AppUser({
    required this.id,
    required this.username,
    required this.nombreCompleto,
    this.rol = 'USUARIO',
    this.color = '#38BDF8',
    this.avatarUrl = '',
    this.departamento = 'Desarrollo de Software',
  });

  bool get isAdmin => rol == 'ADMINISTRADOR';

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'nombreCompleto': nombreCompleto,
    'rol': rol,
    'color': color,
    'avatarUrl': avatarUrl,
    'departamento': departamento,
  };

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
    id: json['id'] ?? '',
    username: json['username'] ?? '',
    nombreCompleto: json['nombreCompleto'] ?? 'Usuario',
    rol: json['rol'] ?? 'USUARIO',
    color: json['color'] ?? '#38BDF8',
    avatarUrl: json['avatarUrl'] ?? '',
    departamento: json['departamento'] ?? 'Desarrollo de Software',
  );

  AppUser copyWith({
    String? id,
    String? username,
    String? nombreCompleto,
    String? rol,
    String? color,
    String? avatarUrl,
    String? departamento,
  }) => AppUser(
    id: id ?? this.id,
    username: username ?? this.username,
    nombreCompleto: nombreCompleto ?? this.nombreCompleto,
    rol: rol ?? this.rol,
    color: color ?? this.color,
    avatarUrl: avatarUrl ?? this.avatarUrl,
    departamento: departamento ?? this.departamento,
  );
}

/// Colaborador de Proyecto Móvil
class ProjectMember {
  final String userId;
  final String username;
  final String nombreCompleto;
  String role; // 'OWNER' | 'EDITOR' | 'VIEWER'
  String status; // 'ACEPTADA' | 'PENDIENTE' | 'RECHAZADA'
  final String color;
  bool canDownloadBackend;

  ProjectMember({
    required this.userId,
    required this.username,
    required this.nombreCompleto,
    this.role = 'EDITOR',
    this.status = 'ACEPTADA',
    this.color = '#38BDF8',
    this.canDownloadBackend = true,
  });

  Map<String, dynamic> toJson() => {
    'userId': userId,
    'username': username,
    'nombreCompleto': nombreCompleto,
    'role': role,
    'status': status,
    'color': color,
    'canDownloadBackend': canDownloadBackend,
  };

  factory ProjectMember.fromJson(Map<String, dynamic> json) => ProjectMember(
    userId: json['userId'] ?? json['id'] ?? '',
    username: json['username'] ?? '',
    nombreCompleto: json['nombreCompleto'] ?? json['name'] ?? '',
    role: json['role'] ?? json['permission'] ?? 'EDITOR',
    status: json['status'] ?? 'ACEPTADA',
    color: json['color'] ?? '#38BDF8',
    canDownloadBackend: json['canDownloadBackend'] ?? true,
  );
}
