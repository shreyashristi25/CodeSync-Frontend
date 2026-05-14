import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors, HTTP_INTERCEPTORS } from '@angular/common/http';
import { routes } from './app.routes';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { LucideAngularModule, Activity, FolderGit2, Terminal, User, LogOut, Search, Globe, FileCode2, TerminalSquare, Component as ComponentIcon, Loader2, SearchX, Star, GitFork, ArrowRight, Plus, Users, MoreHorizontal, Edit, Share2, Trash2, AlertTriangle, PlusCircle, Eye, Shield, Moon, Sun, Bell, Send, Zap, LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(),
    { 
      provide: LUCIDE_ICONS, 
      useFactory: () => new LucideIconProvider({ 
        Activity, FolderGit2, Terminal, User, LogOut, Search, Globe, FileCode2, TerminalSquare, 
        Component: ComponentIcon, Loader2, SearchX, Star, GitFork, ArrowRight, Plus, Users, MoreHorizontal, 
        Edit, Share2, Trash2, AlertTriangle, PlusCircle, Eye, Shield, Moon, Sun, Bell, Send, Zap
      }) 
    },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ]
};