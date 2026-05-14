import { Routes } from '@angular/router';

import { HomeComponent } from './home/home';
import { LoginComponent } from './login/login';
import { DashboardComponent } from './dashboard/dashboard';
import { MyProjectsComponent } from './my-projects/my-projects';
import { RoleSelectorComponent } from './role-selector/role-selector';
import { WorkspaceComponent } from './workspace/workspace';
import { AdminDashboardComponent } from './admin/dashboard/admin-dashboard';
import { AdminLoginComponent } from './admin/login/admin-login';
import { AdminProfileComponent } from './admin/profile/admin-profile';
import { RegisterComponent } from './register/register';
import { ExecutionHistoryComponent } from './execution-history/execution-history';
import { ProfileComponent } from './profile/profile';
import { NotificationsComponent } from './notifications/notifications';
import { ManageUsersComponent } from './admin/manage-users/manage-users';
import { AdminAnalyticsComponent } from './admin/analytics/analytics';
import { AdminSessionsComponent } from './admin/sessions/admin-sessions';
import { AdminExecutionsComponent } from './admin/executions/admin-executions';
import { AdminLanguagesComponent } from './admin/languages/admin-languages';
import { AdminNotificationsComponent } from './admin/notifications/admin-notifications';
import { OAuthSuccessComponent } from './oauth-success/oauth-success';
import { PricingComponent } from './pricing/pricing';
import { ForgotPasswordComponent } from './forgot-password/forgot-password';
import { ResetPasswordComponent } from './reset-password/reset-password';
import { AdminGuard, DeveloperGuard, GuestModeGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: RoleSelectorComponent },
  { path: 'guest-dashboard', component: HomeComponent, canActivate: [GuestModeGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'auth/login', component: LoginComponent },
  { path: 'oauth-success', component: OAuthSuccessComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [DeveloperGuard] },
  { path: 'projects', component: MyProjectsComponent, canActivate: [DeveloperGuard] },
  { path: 'workspace/:projectId', component: WorkspaceComponent },
  { path: 'execution-history', component: ExecutionHistoryComponent, canActivate: [DeveloperGuard] },
  { path: 'history', component: ExecutionHistoryComponent, canActivate: [DeveloperGuard] },
  { path: 'notifications', component: NotificationsComponent, canActivate: [DeveloperGuard] },
  { path: 'profile', component: ProfileComponent },
  { path: 'pricing', component: PricingComponent, canActivate: [DeveloperGuard] },
  { path: 'admin/login', component: AdminLoginComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [AdminGuard] },
  { path: 'admin/profile', component: AdminProfileComponent, canActivate: [AdminGuard] },
  { path: 'admin/users', component: ManageUsersComponent, canActivate: [AdminGuard] },
  { path: 'admin/analytics', component: AdminAnalyticsComponent, canActivate: [AdminGuard] },
  { path: 'admin/sessions', component: AdminSessionsComponent, canActivate: [AdminGuard] },
  { path: 'admin/executions', component: AdminExecutionsComponent, canActivate: [AdminGuard] },
  { path: 'admin/languages', component: AdminLanguagesComponent, canActivate: [AdminGuard] },
  { path: 'admin/notifications', component: AdminNotificationsComponent, canActivate: [AdminGuard] },
  { path: 'home', redirectTo: 'guest-dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];