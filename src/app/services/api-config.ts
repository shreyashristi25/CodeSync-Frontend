import { environment } from '../../environments/environment';

export const apiUrl = (path: string): string => `${environment.apiBaseUrl}${path}`;

export const authServerUrl = (path: string): string => `${environment.authServerUrl}${path}`;

export const notificationWsUrl = (): string => environment.notificationWsUrl;
