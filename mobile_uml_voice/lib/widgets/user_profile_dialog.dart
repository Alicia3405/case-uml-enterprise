import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/file_picker_helper.dart';

class UserProfileDialog extends StatefulWidget {
  const UserProfileDialog({Key? key}) : super(key: key);

  @override
  State<UserProfileDialog> createState() => _UserProfileDialogState();
}

class _UserProfileDialogState extends State<UserProfileDialog> {
  final _currentPwdCtrl = TextEditingController();
  final _newPwdCtrl = TextEditingController();
  final _confirmPwdCtrl = TextEditingController();

  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  String? _errorMsg;
  String? _successMsg;

  String? _pendingPhotoBase64;

  @override
  void dispose() {
    _currentPwdCtrl.dispose();
    _newPwdCtrl.dispose();
    _confirmPwdCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto({bool captureCamera = false}) async {
    setState(() {
      _errorMsg = null;
      _successMsg = null;
    });

    final res = await pickImageWeb(captureCamera: captureCamera);
    if (res != null && res.isNotEmpty) {
      setState(() {
        _pendingPhotoBase64 = res;
        _successMsg = 'Foto seleccionada. Pulsa "Guardar Foto" para aplicarla a tu perfil.';
      });
    }
  }

  void _savePhoto(AuthService auth) async {
    if (_pendingPhotoBase64 == null) return;
    await auth.updateAvatar(_pendingPhotoBase64!);
    setState(() {
      _pendingPhotoBase64 = null;
      _successMsg = '✅ Foto de perfil guardada exitosamente.';
    });
  }

  void _removePhoto(AuthService auth) async {
    await auth.updateAvatar('');
    setState(() {
      _pendingPhotoBase64 = null;
      _successMsg = 'Foto de perfil eliminada. Se mostrarán tus iniciales corporativas.';
    });
  }

  void _handleChangePassword(AuthService auth) async {
    setState(() {
      _errorMsg = null;
      _successMsg = null;
    });

    final current = _currentPwdCtrl.text.trim();
    final newPwd = _newPwdCtrl.text.trim();
    final confirm = _confirmPwdCtrl.text.trim();

    if (current.isEmpty) {
      setState(() => _errorMsg = 'Ingresa tu contraseña actual.');
      return;
    }

    if (newPwd.length < 4) {
      setState(() => _errorMsg = 'La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (newPwd != confirm) {
      setState(() => _errorMsg = 'Las contraseñas no coinciden.');
      return;
    }

    final ok = await auth.changePassword(current, newPwd);
    if (!ok) {
      setState(() => _errorMsg = 'La contraseña actual es incorrecta.');
    } else {
      setState(() {
        _successMsg = '✅ ¡Contraseña actualizada exitosamente!';
        _currentPwdCtrl.clear();
        _newPwdCtrl.clear();
        _confirmPwdCtrl.clear();
      });
    }
  }

  Widget _buildAvatarImage(String? photo, Color fallbackColor, String initial) {
    if (photo != null && photo.isNotEmpty) {
      if (photo.startsWith('data:image')) {
        try {
          final commaIdx = photo.indexOf(',');
          final base64Data = commaIdx != -1 ? photo.substring(commaIdx + 1) : photo;
          final bytes = base64Decode(base64Data);
          return ClipOval(
            child: Image.memory(bytes, width: 64, height: 64, fit: BoxFit.cover),
          );
        } catch (_) {}
      } else if (photo.startsWith('http')) {
        return ClipOval(
          child: Image.network(photo, width: 64, height: 64, fit: BoxFit.cover),
        );
      }
    }

    return Container(
      width: 64,
      height: 64,
      decoration: BoxDecoration(
        color: fallbackColor,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        initial.toUpperCase(),
        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.currentUser;

    if (user == null) {
      return const SizedBox.shrink();
    }

    final userColor = Color(int.parse(user.color.replaceAll('#', '0xFF')));

    return Dialog(
      backgroundColor: const Color(0xFF0F172A),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Cabecera
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: userColor.withOpacity(0.2),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.account_circle, color: userColor, size: 26),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Mi Perfil de Usuario',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          Text(
                            'Datos de cuenta, foto y seguridad',
                            style: TextStyle(fontSize: 11, color: Colors.grey[400]),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.grey, size: 20),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Mensajes de Alerta
                if (_errorMsg != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.4)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: Color(0xFFF87171), size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMsg!,
                            style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 11),
                          ),
                        ),
                      ],
                    ),
                  ),

                if (_successMsg != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.check_circle_outline, color: Color(0xFF34D399), size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _successMsg!,
                            style: const TextStyle(color: Color(0xFF6EE7B7), fontSize: 11),
                          ),
                        ),
                      ],
                    ),
                  ),

                // 1. Información de la Cuenta (Solo Lectura)
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B).withOpacity(0.6),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'INFORMACIÓN DE LA CUENTA',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8), letterSpacing: 0.8),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF334155),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('Solo Lectura', style: TextStyle(color: Colors.white70, fontSize: 9)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(user.nombreCompleto, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text('@${user.username}', style: TextStyle(fontSize: 12, color: userColor, fontWeight: FontWeight.w600)),
                          const SizedBox(width: 10),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: user.isAdmin ? const Color(0xFF8B5CF6).withOpacity(0.2) : const Color(0xFF0EA5E9).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              user.rol,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: user.isAdmin ? const Color(0xFFC4B5FD) : const Color(0xFF7DD3FC),
                              ),
                            ),
                          ),
                          const Spacer(),
                          Text(user.departamento, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // 2. Foto de Perfil del Usuario
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B).withOpacity(0.4),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Foto de Perfil:',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          // Foto del usuario (o preview si seleccionó una nueva)
                          _buildAvatarImage(
                            _pendingPhotoBase64 ?? user.avatarUrl,
                            userColor,
                            user.nombreCompleto.isNotEmpty ? user.nombreCompleto[0] : 'U',
                          ),
                          const SizedBox(width: 14),

                          // Acciones para subir y guardar
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (_pendingPhotoBase64 != null) ...[
                                  Row(
                                    children: [
                                      ElevatedButton.icon(
                                        onPressed: () => _savePhoto(auth),
                                        icon: const Icon(Icons.save, size: 14),
                                        label: const Text('Guardar Foto', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF0D9488),
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      TextButton(
                                        onPressed: () => setState(() => _pendingPhotoBase64 = null),
                                        child: const Text('Cancelar', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  const Text(
                                    'Pulsa "Guardar Foto" para aplicarla.',
                                    style: TextStyle(fontSize: 10, color: Color(0xFF2DD4BF)),
                                  ),
                                ] else ...[
                                  Row(
                                    children: [
                                      OutlinedButton.icon(
                                        onPressed: () => _pickPhoto(captureCamera: false),
                                        icon: const Icon(Icons.upload, size: 14, color: Color(0xFF2DD4BF)),
                                        label: const Text('Subir Foto', style: TextStyle(fontSize: 11, color: Color(0xFF2DD4BF))),
                                        style: OutlinedButton.styleFrom(
                                          side: const BorderSide(color: Color(0xFF2DD4BF)),
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                        ),
                                      ),
                                      if (user.avatarUrl.isNotEmpty) ...[
                                        const SizedBox(width: 8),
                                        TextButton(
                                          onPressed: () => _removePhoto(auth),
                                          child: const Text('Quitar', style: TextStyle(fontSize: 11, color: Color(0xFFF87171))),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  const Text(
                                    'Visible en tu perfil y cuando colabores en línea.',
                                    style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // 3. Sección Cambio de Contraseña Directo
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B).withOpacity(0.5),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.lock_reset, color: Color(0xFFF59E0B), size: 18),
                          SizedBox(width: 6),
                          Text(
                            'Cambiar Contraseña',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Modificación directa (sin verificación de correo).',
                        style: TextStyle(fontSize: 10, color: Colors.grey[400]),
                      ),
                      const SizedBox(height: 12),

                      // Contraseña actual
                      TextField(
                        controller: _currentPwdCtrl,
                        obscureText: _obscureCurrent,
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                        decoration: InputDecoration(
                          labelText: 'Contraseña actual',
                          labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                          hintText: '••••••',
                          hintStyle: const TextStyle(color: Colors.grey, fontSize: 11),
                          filled: true,
                          fillColor: const Color(0xFF0F172A),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                          suffixIcon: IconButton(
                            icon: Icon(_obscureCurrent ? Icons.visibility_off : Icons.visibility, size: 16, color: Colors.grey),
                            onPressed: () => setState(() => _obscureCurrent = !_obscureCurrent),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Nueva contraseña y confirmación
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _newPwdCtrl,
                              obscureText: _obscureNew,
                              style: const TextStyle(color: Colors.white, fontSize: 12),
                              decoration: InputDecoration(
                                labelText: 'Nueva contraseña',
                                labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                                hintText: '••••••',
                                hintStyle: const TextStyle(color: Colors.grey, fontSize: 11),
                                filled: true,
                                fillColor: const Color(0xFF0F172A),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                                suffixIcon: IconButton(
                                  icon: Icon(_obscureNew ? Icons.visibility_off : Icons.visibility, size: 16, color: Colors.grey),
                                  onPressed: () => setState(() => _obscureNew = !_obscureNew),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: _confirmPwdCtrl,
                              obscureText: _obscureConfirm,
                              style: const TextStyle(color: Colors.white, fontSize: 12),
                              decoration: InputDecoration(
                                labelText: 'Confirmar',
                                labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                                hintText: '••••••',
                                hintStyle: const TextStyle(color: Colors.grey, fontSize: 11),
                                filled: true,
                                fillColor: const Color(0xFF0F172A),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                                suffixIcon: IconButton(
                                  icon: Icon(_obscureConfirm ? Icons.visibility_off : Icons.visibility, size: 16, color: Colors.grey),
                                  onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      ElevatedButton(
                        onPressed: () => _handleChangePassword(auth),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0D9488),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text(
                          'Actualizar Contraseña',
                          style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
