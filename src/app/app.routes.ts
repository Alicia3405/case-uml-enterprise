import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { roleGuard } from './auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/uml-workspace/uml-workspace.component').then(m => m.UmlWorkspaceComponent)
      },
      {
        path: 'uml-workspace',
        loadComponent: () => import('./pages/uml-workspace/uml-workspace.component').then(m => m.UmlWorkspaceComponent)
      },
      {
        path: 'informes',
        loadComponent: () => import('./pages/informes/informes.component').then(m => m.InformesComponent)
      },
      {
        path: 'usuarios',
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR'] },
        loadComponent: () => import('./pages/admin-usuarios/admin-usuarios.component').then(m => m.AdminUsuariosComponent)
      },
      {
        path: 'departamentos',
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR'] },
        loadComponent: () => import('./pages/admin-departamentos/admin-departamentos.component').then(m => m.AdminDepartamentosComponent)
      },
      {
        path: 'asistente',
        loadComponent: () => import('./pages/ai-assistant/ai-assistant.component').then(m => m.AiAssistantComponent)
      }
    ]
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
