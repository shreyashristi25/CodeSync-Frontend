import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { AuthService } from '../../auth';
import { AppStateService } from '../../services/app-state.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css'
})
export class AdminAnalyticsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('registrationsCanvas', { static: true }) registrationsCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('executionsByLanguageCanvas', { static: true }) executionsByLanguageCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('projectsByLanguageCanvas', { static: true }) projectsByLanguageCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('dailyActivityCanvas', { static: true }) dailyActivityCanvas!: ElementRef<HTMLCanvasElement>;

  activityFeed: string[] = [];
  stats = {
    totalUsers: 0,
    activeThisWeek: 0,
    totalProjects: 0,
    totalExecutions: 0,
    avgExecutionTime: 0
  };
  private registrationsChart!: Chart;
  private executionsChart!: Chart;
  private projectsChart!: Chart;
  private dailyActivityChart!: Chart;

  constructor(
    private authService: AuthService,
    private appState: AppStateService,
    private router: Router,
    private http: HttpClient
  ) {}

  async ngAfterViewInit(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      this.router.navigate(['/admin/login']);
      return;
    }

    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    
    // Default fallback stats (start empty to avoid mock data flicker)
    this.stats = {
      totalUsers: 0,
      activeThisWeek: 0,
      totalProjects: 0,
      totalExecutions: 0,
      avgExecutionTime: 0
    };

    const registrations = new Array<number>(12).fill(0);
    const execByLanguage = new Map<string, number>();
    const projectsByLanguage = new Map<string, number>();
    const dailyActivity = new Array<number>(30).fill(0);

    this.activityFeed = ['Loading activity feed...'];

    // Setup Charts
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#c7d2e0'
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148,163,184,0.12)' }
        },
        y: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148,163,184,0.12)' }
        }
      }
    } as const;

    this.registrationsChart = new Chart(this.registrationsCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{ label: 'Registrations', data: registrations, borderColor: '#38c8ff', backgroundColor: 'rgba(56,200,255,.18)', fill: true, tension: 0.28 }]
      },
      options: chartOptions
    });

    this.executionsChart = new Chart(this.executionsByLanguageCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: Array.from(execByLanguage.keys()),
        datasets: [{ label: 'Executions', data: Array.from(execByLanguage.values()), backgroundColor: ['#38c8ff', '#6de09b', '#f59e0b', '#a78bfa', '#ef4444'] }]
      },
      options: chartOptions
    });

    this.projectsChart = new Chart(this.projectsByLanguageCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: Array.from(projectsByLanguage.keys()),
        datasets: [{ data: Array.from(projectsByLanguage.values()), backgroundColor: ['#38c8ff', '#6de09b', '#f59e0b', '#a78bfa', '#ef4444', '#14b8a6'] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#c7d2e0' } } }
      }
    });

    this.dailyActivityChart = new Chart(this.dailyActivityCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: Array.from({ length: 30 }, (_, i) => `D-${29 - i}`),
        datasets: [{ label: 'Daily Activity', data: dailyActivity, borderColor: '#6de09b', backgroundColor: 'rgba(109,224,155,.16)', fill: true, tension: 0.25 }]
      },
      options: chartOptions
    });

    // Fetch Real Data asynchronously to override defaults
    this.loadRealData(now, weekAgo);
  }

  private async loadRealData(now: number, weekAgo: number): Promise<void> {
    try {
      // 1. Fetch real analytics summary
      const analytics: any = await firstValueFrom(this.http.get('http://localhost:8081/api/auth/admin/analytics', {
        headers: { 'X-Admin-Email': this.authService.getCurrentUser()?.email || '' }
      }));

      this.stats = {
        totalUsers: analytics.totalUsers || 0,
        activeThisWeek: 0, // Requires advanced querying, disabled for now to avoid mock data
        totalProjects: analytics.totalProjects || 0,
        totalExecutions: analytics.totalExecutions || 0,
        avgExecutionTime: analytics.avgExecutionTime || 0
      };

      // Update graphs with the language breakdown if available
      if (analytics.languageBreakdown && Object.keys(analytics.languageBreakdown).length > 0) {
        this.projectsChart.data.labels = Object.keys(analytics.languageBreakdown);
        this.projectsChart.data.datasets[0].data = Object.values(analytics.languageBreakdown) as number[];
        this.projectsChart.update();
      }
      
      // Update execution language breakdown graph if available
      if (analytics.execLanguageBreakdown && Object.keys(analytics.execLanguageBreakdown).length > 0) {
        this.executionsChart.data.labels = Object.keys(analytics.execLanguageBreakdown);
        this.executionsChart.data.datasets[0].data = Object.values(analytics.execLanguageBreakdown) as number[];
        this.executionsChart.update();
      }

      // 2. Fetch real activity feed from audit service
      try {
        const logsPage: any = await firstValueFrom(this.http.get('http://localhost:8092/api/audit/logs?size=20'));
        if (logsPage && logsPage.content && logsPage.content.length > 0) {
          this.activityFeed = logsPage.content.map((log: any) => {
            const time = new Date(log.timestamp).toLocaleString();
            const userName = log.userEmail || log.userId || 'System';
            return `${time} · ${userName} ${log.action.replace(/_/g, ' ').toLowerCase()}`;
          });
        } else {
          this.activityFeed = ['No recent activity found.'];
        }
      } catch (err) {
        console.warn('Could not load audit logs:', err);
        this.activityFeed = ['Audit log service unavailable.'];
      }
    } catch (error) {
      console.error('Failed to load real analytics:', error);
      this.activityFeed = ['Failed to load analytics data.'];
    }
  }

  ngOnDestroy(): void {
    if (this.registrationsChart) this.registrationsChart.destroy();
    if (this.executionsChart) this.executionsChart.destroy();
    if (this.projectsChart) this.projectsChart.destroy();
    if (this.dailyActivityChart) this.dailyActivityChart.destroy();
  }
}
