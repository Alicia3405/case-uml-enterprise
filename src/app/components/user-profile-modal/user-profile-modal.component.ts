import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthSessionService } from '../../services/auth-session.service';

@Component({
  selector: 'app-user-profile-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile-modal.component.html',
  styleUrls: []
})
export class UserProfileModalComponent {
  public authService = inject(AuthSessionService);

  close = output<void>();

  // Estado para la foto de perfil propia
  pendingPhoto = signal<string | null>(null);

  // Estados para cambio de contraseña
  currentPassword = signal<string>('');
  newPassword = signal<string>('');
  confirmPassword = signal<string>('');

  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Manejador al seleccionar una foto desde la computadora o dispositivo
  onPhotoSelected(event: Event) {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (!file.type.startsWith('image/')) {
        this.errorMessage.set('El archivo seleccionado debe ser una imagen (JPG, PNG, WebP).');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        this.pendingPhoto.set(base64);
        this.successMessage.set('Vista previa lista. Haz clic en "Guardar Foto" para fijarla en tu perfil.');
      };
      reader.readAsDataURL(file);
    }
  }

  // Guardar la foto de perfil en la cuenta del usuario activo
  guardarFoto() {
    const photo = this.pendingPhoto();
    if (!photo) return;
    const res = this.authService.updateAvatar(photo);
    if (res.success) {
      this.pendingPhoto.set(null);
      this.successMessage.set('✅ Foto de perfil guardada con éxito.');
    } else {
      this.errorMessage.set(res.message);
    }
  }

  // Quitar la foto de perfil y volver al avatar corporativo con iniciales
  eliminarFoto() {
    this.authService.updateAvatar('');
    this.pendingPhoto.set(null);
    this.successMessage.set('Foto de perfil eliminada. Se mostrarán tus iniciales corporativas.');
  }

  // Guardar cambio de contraseña directo
  guardarCambioPassword() {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const curr = this.currentPassword().trim();
    const nueva = this.newPassword().trim();
    const conf = this.confirmPassword().trim();

    if (!curr) {
      this.errorMessage.set('Por favor ingresa tu contraseña actual.');
      return;
    }

    if (!nueva || !conf) {
      this.errorMessage.set('La nueva contraseña y su confirmación son obligatorias.');
      return;
    }

    if (nueva !== conf) {
      this.errorMessage.set('La nueva contraseña y la confirmación no coinciden.');
      return;
    }

    const res = this.authService.changePassword(curr, nueva);
    if (!res.success) {
      this.errorMessage.set(res.message);
    } else {
      this.successMessage.set('✅ ' + res.message);
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
    }
  }
}
