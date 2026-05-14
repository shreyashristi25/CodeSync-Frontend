import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, takeUntil } from 'rxjs';

import { AuthService } from '../auth';
import { AppFile, AppProject, AppStateService, AppUser, CommitEntry } from '../services/app-state.service';
import { FileNode } from '../services/file.service';
import { FileTreeComponent } from './file-tree/file-tree';
import { LiveEditorComponent } from './live-editor/live-editor';
import { ToastService } from '../services/toast.service';
import { NotificationBellComponent } from '../components/notification-bell/notification-bell';
import { ExecutionService } from '../services/execution.service';
import { FileService, CodeFile } from '../services/file-api.service';
import { CollabService, CollabSessionResponse, Participant, ChatMessage } from '../services/collab.service';
import { CommentService, Comment } from '../services/comment.service';
import { VcsService, Branch, Repository, PullRequest, CreateSnapshotRequest } from '../services/vcs.service';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, FileTreeComponent, LiveEditorComponent, NotificationBellComponent],
  templateUrl: './workspace.html',
  styleUrl: './workspace.css'
})
export class WorkspaceComponent implements OnInit, OnDestroy {
  @ViewChild(LiveEditorComponent) liveEditor?: LiveEditorComponent;
  @ViewChild('sidebarPanel') sidebarPanel?: ElementRef<HTMLElement>;
  @ViewChild('commentsPanel') commentsPanel?: ElementRef<HTMLElement>;

  projectId = 0;
  project: AppProject | null = null;
  tree: FileNode[] = [];
  files: AppFile[] = [];
  selectedFile: AppFile | null = null;
  openTabs: AppFile[] = [];
  dirtyPaths = new Set<string>();
  terminalLines: string[] = ['CodeSync terminal ready.'];
  activeTab: 'comments' | 'search' = 'comments';
  bottomTab: 'terminal' | 'output' | 'problems' | 'stderr' = 'terminal';
  terminalHeight = 170;
  isRunning = false;
  runStartedAt = 0;
  runTimer: ReturnType<typeof setInterval> | null = null;
  runMs = 0;
  runMemory = 0;
  runOutput = '';
  runStderr = '';
  /** ID of the currently active backend job, used for remote cancellation. */
  currentJobId: string | null = null;
  /** User-provided stdin to supply to the process. */
  stdinInput = '';
  showStdinInput = false;

  comments: Comment[] = [];
  commentFilter: 'all' | 'open' | 'resolved' = 'all';
  showCommentsPanel = true;
  newCommentText = '';
  selectedCommentRange: { startLine: number; endLine: number } | null = null;
  pendingCommentOpen = false;
  reviewMode = false;
  selectedCommentLine: number | null = null;
  editingCommentId: number | null = null;
  editCommentText = '';
  replyingCommentId: number | null = null;
  replyCommentText = '';

  showProjectSearchPanel = false;
  searchQuery = '';
  replaceText = '';
  searchResults: Array<{ path: string; line: number; preview: string; startColumn: number; endColumn: number }> = [];
  groupedSearchResults: Array<{ path: string; items: Array<{ line: number; preview: string; startColumn: number; endColumn: number }> }> = [];
  private searchInput$ = new Subject<string>();

  showFindBar = false;
  findQuery = '';
  findCount = 0;
  findActiveIndex = 0;

  showCommitPanel = false;
  showDiffViewer = false;
  commitEntries: CommitEntry[] = [];
  selectedCommit: CommitEntry | null = null;
  diffMode: 'split' | 'unified' = 'split';

  // VCS properties
  branches: Branch[] = [];
  repositories: Repository[] = [];
  pullRequests: PullRequest[] = [];
  currentBranch: Branch | null = null;
  currentRepo: Repository | null = null;
  showVcsPanel = false;
  showCommitModal = false;
  showBranchModal = false;
  showPrModal = false;
  newCommitMessage = '';
  newBranchName = '';
  newPrTitle = '';
  newPrDescription = '';
  selectedSourceBranch: Branch | null = null;
  selectedTargetBranch: Branch | null = null;

  showFileModal = false;
  newFileName = '';
  createFolder = false;
  selectedFolderId: number | null = null;
  showDeleteModal = false;
  pendingDeletePath = '';
  showShareModal = false;
  shareEmail = '';
  shareRole: 'Viewer' | 'Editor' = 'Viewer';

  readOnly = false;
  showReadOnlyPrompt = false;

  isCollabMode = false;
  showCollabPanel = false;
  sidebarCollapsed: boolean = false;
  rightPanelCollapsed: boolean = false;

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleRightPanel(): void {
    this.rightPanelCollapsed = !this.rightPanelCollapsed;
  }

  trackById(index: number, item: any): any {
    return item.id || index;
  }
  terminalCollapsed: boolean = false;

  toggleTerminal(): void {
    this.terminalCollapsed = !this.terminalCollapsed;
  }

  trackByIndex(index: number, item: any): any {
    return index;
  }
  collabSession: CollabSessionResponse | null = null;
  collabParticipants: Participant[] = [];
  liveCursors: Map<string, { line: number; column: number; color: string; name: string }> = new Map();
  isCollabOwner = false;
  chatMessages: ChatMessage[] = [];
  chatInput = '';
  showChatPanel = false;

  loadingTree = false;
  loadingFile = false;
  status = 'Connected';
  error: string | null = null;

  private destroy$ = new Subject<void>();
  private suppressEditorEmit = false;
  private pendingAutoRunFile = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public authService: AuthService,
    private appState: AppStateService,
    private toastService: ToastService,
    private executionService: ExecutionService,
    private fileService: FileService,
    private collabService: CollabService,
    private commentService: CommentService,
    private vcsService: VcsService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/']);
      return;
    }
    this.readOnly = user.role === 'GUEST';
    this.showReadOnlyPrompt = this.readOnly;

    setTimeout(() => this.initResizers(), 100);
    this.loadUsers();

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.projectId = Number(params.get('projectId'));
      if (!this.projectId) {
        this.error = 'Invalid project id';
        return;
      }
      if (this.readOnly) {
        const isPublic = this.appState.getPublicProjects().some((p) => p.id === this.projectId);
        if (!isPublic) {
          this.toastService.error('Guest mode can open only public projects.');
          this.router.navigate(['/guest-dashboard']);
          return;
        }
      }
      this.loadTree();
    });

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.pendingAutoRunFile = params.get('runFile') || '';
      this.isCollabMode = params.get('mode') === 'collab';
    });

    this.searchInput$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe((q) => {
      this.performSearch(q);
    });
  }

  loadUsers(): void {
    this.authService.getUsers().subscribe({
      next: (users) => {
        const appUsers: AppUser[] = users.map(u => ({
          id: u.id,
          name: u.fullName,
          email: u.email,
          role: (u.role || 'developer').toLowerCase() as any,
          password: '',
          status: (u.status || 'active').toLowerCase() as any,
          joined: '',
          avatar: u.fullName?.charAt(0)?.toUpperCase() || 'U',
          bio: ''
        }));
        this.appState.setUsers(appUsers);
      },
      error: (err) => console.error('Failed to load users', err)
    });
  }

  ngOnDestroy(): void {
    if (this.runTimer) {
      clearInterval(this.runTimer);
    }
    this.collabService.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  initResizers(): void {
    const sidebarHandle = document.getElementById('sidebarResize');
    const commentsHandle = document.getElementById('commentsResize');
    const terminalHandle = document.getElementById('terminalResize');
    const sidebar = document.getElementById('sidebarPanel');
    const comments = document.getElementById('commentsPanel');
    const terminal = document.getElementById('terminalPanel');

    if (sidebarHandle && sidebar) {
      let startX = 0;
      let startWidth = 280;

      const onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        startX = e.clientX;
        startWidth = sidebar.offsetWidth;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        sidebarHandle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
      };

      const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startX;
        const newWidth = Math.max(180, Math.min(500, startWidth + dx));
        sidebar.style.width = newWidth + 'px';
        sidebar.style.flex = 'none';
      };

      const onMouseUp = () => {
        sidebarHandle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      sidebarHandle.addEventListener('mousedown', onMouseDown);
    }

    if (commentsHandle && comments) {
      let startX = 0;
      let startWidth = 260;

      const onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        startX = e.clientX;
        startWidth = comments.offsetWidth;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        commentsHandle.classList.add('dragging');
        document.body.style.cursor = 'se-resize';
      };

      const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startX;
        const newWidth = Math.max(180, Math.min(400, startWidth + dx));
        comments.style.width = newWidth + 'px';
        comments.style.flex = 'none';
      };

      const onMouseUp = () => {
        commentsHandle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      commentsHandle.addEventListener('mousedown', onMouseDown);
    }

    if (terminalHandle && terminal) {
      let startY = 0;
      let startHeight = 170;

      const onMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        startY = e.clientY;
        startHeight = terminal.offsetHeight;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        terminalHandle.classList.add('dragging');
        document.body.style.cursor = 'row-resize';
      };

      const onMouseMove = (e: MouseEvent) => {
        const dy = startY - e.clientY;
        const newHeight = Math.max(100, Math.min(500, startHeight + dy));
        terminal.style.height = newHeight + 'px';
      };

      const onMouseUp = () => {
        terminalHandle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      terminalHandle.addEventListener('mousedown', onMouseDown);
    }
  }

  selectTab(tab: 'comments' | 'search'): void {
    this.activeTab = tab;
  }

loadTree(): void {
  this.loadingTree = true;
  this.error = null;
  this.project = this.appState.projects$.value.find((p) => p.id === this.projectId) || null;
  
  this.fileService.getFiles(this.projectId, this.currentBranch?.id).subscribe({
    next: (backendFiles) => {
      const existingFiles = this.appState.getFilesByProject(this.projectId);
      
      const mergedFiles: AppFile[] = [
        ...existingFiles.filter(f => f.id >= 9000),
        ...backendFiles.map(f => ({
          id: f.id,
          projectId: f.projectId,
          path: f.path,
          name: f.name,
          language: this.inferLanguage(f.name),
          content: f.content,
          isDirectory: f.isDirectory,
          parentId: f.parentId,
          updatedAt: f.updatedAt
        }))
      ];
      
      const otherFiles = this.appState.files$.value.filter(f => f.projectId !== this.projectId);
      this.appState.files$.next([...otherFiles, ...mergedFiles]);
      
      this.files = this.appState.getFilesByProject(this.projectId);
      this.tree = this.toTree(this.files);
      this.loadingTree = false;
      
      // Only auto-open if no file is currently selected (prevents race conditions)
      if (!this.selectedFile) {
        const firstFile = this.files.find((f) => !f.isDirectory) || null;
        if (firstFile) {
          this.openFile(firstFile.id);
        }
      }
      
      this.refreshSideData();
      
      if (this.pendingAutoRunFile) {
        this.runByFileName(this.pendingAutoRunFile, true);
        this.pendingAutoRunFile = '';
      }
      
      this.autoRejoinSession();
    },
    error: (err) => {
      console.error('Failed to load files from backend:', err);
      this.files = this.appState.getFilesByProject(this.projectId);
      this.tree = this.toTree(this.files);
      this.loadingTree = false;
      
      if (!this.selectedFile) {
        const firstFile = this.files.find((f) => !f.isDirectory) || null;
        if (firstFile) {
          this.openFile(firstFile.id);
        }
      }
      
      this.refreshSideData();
      if (this.pendingAutoRunFile) {
        this.runByFileName(this.pendingAutoRunFile, true);
        this.pendingAutoRunFile = '';
      }
    }
  });
}

  onFileSelected(node: FileNode): void {
    if (node.isDirectory) {
      this.selectedFolderId = node.id;
      return;
    }
    this.selectedFolderId = null;
    this.openFile(node.id);
  }

  onFolderSelected(node: FileNode): void {
    this.selectedFolderId = node.id;
  }

  onFileRenamed(event: {node: FileNode, newName: string}): void {
    const file = this.files.find(f => f.id === event.node.id);
    if (!file) return;

    const parentPath = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '';
    const newPath = parentPath ? `${parentPath}/${event.newName}` : event.newName;
    const applyRename = (idOverride?: number) => {
      this.appState.updateFileName(this.projectId, file.path, newPath, event.newName);
      if (idOverride) {
        const nextFiles = this.appState.files$.value.map((f) =>
          f.projectId === this.projectId && f.path === newPath ? { ...f, id: idOverride } : f
        );
        this.appState.files$.next(nextFiles);
      }
      this.files = this.appState.getFilesByProject(this.projectId);
      this.tree = this.toTree(this.files);
      this.openTabs = this.openTabs.map((tab) =>
        tab.id === file.id ? { ...tab, id: idOverride ?? tab.id, path: newPath, name: event.newName } : tab
      );
      if (this.selectedFile?.id === file.id) {
        this.selectedFile = { ...this.selectedFile, id: idOverride ?? this.selectedFile.id, path: newPath, name: event.newName };
      }
    };

    if (file.id < 9000) {
      const user = this.authService.getCurrentUser();
      this.fileService.updateFile(file.id, { name: event.newName, path: newPath, content: file.content, lastModifiedBy: user?.userId ?? 0 }).subscribe({
        next: () => {
          applyRename();
          this.toastService.success(`Renamed to ${event.newName}`);
        },
        error: (err) => {
          if (err.status === 404) {
            const createdBy = user?.userId ?? 0;
            this.fileService.createFile({
              projectId: this.projectId,
              path: newPath,
              name: event.newName,
              isDirectory: file.isDirectory,
              content: file.content,
              parentId: file.parentId ?? undefined,
              language: file.language ?? this.inferLanguage(newPath),
              createdBy
            }).subscribe({
              next: (created) => {
                applyRename(created.id);
                this.toastService.success(`Renamed to ${event.newName}`);
              },
              error: (createErr) => {
                console.error('Failed to rename file:', createErr);
                this.toastService.error('Failed to rename file');
              }
            });
            return;
          }
          console.error('Failed to rename file:', err);
          this.toastService.error('Failed to rename file');
        }
      });
    } else {
      applyRename();
      this.toastService.success(`Renamed to ${event.newName}`);
    }
  }

  onRunCode(): void {
    if (this.readOnly) {
      this.toastService.info('Guest mode is read-only. Sign in to run code.');
      return;
    }
    if (!this.selectedFile) {
      this.appendTerminal('No file selected.');
      return;
    }

    const executionLanguage = this.mapLanguageForDisplay(this.selectedFile.language, this.selectedFile.name);
    if (!executionLanguage) {
      this.appendTerminal(`Cannot run file type: ${this.selectedFile.name}. Supported: .js, .py, .java, .html`);
      return;
    }

    if (executionLanguage === 'HTML') {
      this.runOutput = 'Opening HTML file in browser...';
      this.appendTerminal(this.runOutput);
      this.openInBrowser(this.selectedFile.content, this.selectedFile.name);
      return;
    }

    const selectedFileName = this.selectedFile.name;
    const selectedFileLanguage = this.selectedFile.language;
    this.stopRun(false);
    const language = executionLanguage.toLowerCase();
    this.appendTerminal(`$ run ${this.selectedFile.name}${this.stdinInput ? ' (stdin provided)' : ''}`);
    this.isRunning = true;
    this.runStartedAt = Date.now();
    this.runOutput = 'Execution started...';
    this.runStderr = '';
    this.currentJobId = null;
    this.runTimer = setInterval(() => {
      this.runMs = Date.now() - this.runStartedAt;
      this.runMemory = 40 + Math.floor((this.runMs / 1000) * 4) + Math.floor(Math.random() * 5);
    }, 120);

    this.executionService.submitJob({
      code: this.selectedFile.content,
      language: executionLanguage,
      stdin: this.stdinInput || undefined,
      projectId: this.projectId,
      fileName: this.selectedFile.name
    }).subscribe({
      next: (response) => {
        this.currentJobId = response.jobId;
        if (response.status === 'QUEUED' || response.status === 'PENDING' || response.status === 'RUNNING') {
          this.pollJobStatus(response.jobId, selectedFileName, selectedFileLanguage, language);
          return;
        }
        this.handleExecutionResult(response, selectedFileName, selectedFileLanguage, language);
      },
      error: (err) => {
        this.stopRun(false);
        this.runOutput = `Execution failed: ${err.message || 'Unknown error'}`;
        this.appendTerminal(this.runOutput);
        this.bottomTab = 'output';
        this.toastService.error('Execution failed.');
      }
    });
  }

  private pollJobStatus(jobId: string, selectedFileName: string, selectedFileLanguage: string, language: string): void {
    const pollInterval = setInterval(() => {
      this.executionService.getJob(jobId).subscribe({
        next: (response) => {
          if (response.status === 'QUEUED' || response.status === 'PENDING' || response.status === 'RUNNING') {
            return;
          }
          clearInterval(pollInterval);
          this.handleExecutionResult(response, selectedFileName, selectedFileLanguage, language);
        },
        error: (err) => {
          clearInterval(pollInterval);
          this.stopRun(false);
          this.runOutput = `Execution failed: ${err.message || 'Unknown error'}`;
          this.appendTerminal(this.runOutput);
          this.bottomTab = 'output';
          this.toastService.error('Execution failed.');
        }
      });
    }, 500);
  }

  /** Cancel the currently running remote job and stop the local timer. */
  cancelExecution(): void {
    if (!this.isRunning) return;
    const jobId = this.currentJobId;
    if (jobId) {
      this.executionService.cancelJob(jobId).subscribe({
        next: () => {
          this.toastService.info('Execution cancelled.');
        },
        error: (err) => {
          // Job may have already finished by the time we cancel — that's fine
          console.warn('Cancel request failed (job may already be done):', err);
        }
      });
    }
    this.stopRun(true);
    this.currentJobId = null;
  }

  private handleExecutionResult(response: any, selectedFileName: string, selectedFileLanguage: string, language: string): void {
    this.stopRun(false);
    this.currentJobId = null;

    if (response.status === 'CANCELLED') {
      this.runOutput = `Execution cancelled for ${selectedFileName}`;
      this.runStderr = '';
      this.appendTerminal('[CANCELLED] ' + selectedFileName);
      this.bottomTab = 'output';
      return;
    }

    if (response.status === 'COMPLETED') {
      const output = response.output || '(no output)';
      this.runStderr = response.stderr || '';
      this.runOutput = `Execution completed for ${selectedFileName}
Language: ${language}
Duration: ${this.runMs}ms
Peak Memory: ${this.runMemory}MB

Output:
${output}`;
      if (this.project) {
        this.appState.addExecution({
          projectId: this.project.id,
          projectName: this.project.name,
          file: selectedFileName,
          language: selectedFileLanguage,
          durationMs: this.runMs,
          memoryMb: this.runMemory,
          status: 'Success',
          output: this.runOutput
        });
      }
      this.toastService.success('Execution completed.');
    } else {
      const error = response.error || 'Unknown error';
      this.runStderr = response.stderr || '';
      this.runOutput = `Execution failed for ${selectedFileName}
Language: ${language}
Duration: ${this.runMs}ms

Error:
${error}`;
      if (this.project) {
        this.appState.addExecution({
          projectId: this.project.id,
          projectName: this.project.name,
          file: selectedFileName,
          language: selectedFileLanguage,
          durationMs: this.runMs,
          memoryMb: this.runMemory,
          status: 'Failed',
          output: this.runOutput
        });
      }
      this.toastService.error('Execution failed.');
    }

    this.appendTerminal(this.runOutput);
    this.bottomTab = 'output';
    if (this.runStderr) {
      this.appendTerminal('[stderr]: ' + this.runStderr);
    }
  }

  stopRun(markTerminated = true): void {
    if (this.runTimer) {
      clearInterval(this.runTimer);
      this.runTimer = null;
    }
    if (markTerminated && this.isRunning && this.project && this.selectedFile) {
      this.appendTerminal('Execution terminated by user.');
      this.appState.addExecution({
        projectId: this.project.id,
        projectName: this.project.name,
        file: this.selectedFile.name,
        language: this.selectedFile.language,
        durationMs: this.runMs,
        memoryMb: this.runMemory,
        status: 'Terminated',
        output: '^C Terminated'
      });
    }
    this.isRunning = false;
  }

  toggleStdinInput(): void {
    this.showStdinInput = !this.showStdinInput;
  }

  onEditorContentChanged(content: string): void {
    if (!this.selectedFile || this.suppressEditorEmit || this.readOnly) {
      return;
    }
    this.selectedFile = { ...this.selectedFile, content };
    this.updateOpenTabContent(this.selectedFile.path, content);
    this.dirtyPaths.add(this.selectedFile.path);
    
    if (this.collabSession) {
      this.sendCollabEdit(content);
    }
  }

  onEditorCursorMoved(position: { lineNumber: number; column: number }): void {
    if (!this.selectedFile) return;
    if (this.reviewMode) {
      this.selectedCommentLine = position.lineNumber;
    }
    if (this.collabSession) {
      this.sendCollabCursor(position.lineNumber, position.column);
    }
  }

  onEditorLanguageChanged(language: string): void {
    if (!this.selectedFile || this.readOnly) return;
    this.selectedFile = { ...this.selectedFile, language };
    const file = this.files.find(f => f.id === this.selectedFile!.id);
    if (file) {
      file.language = language;
    }
  }

  private openFile(fileId: number): void {
  this.loadingFile = true;
  const file = this.files.find((f) => f.id === fileId && !f.isDirectory) || null;
  if (!file) {
    this.loadingFile = false;
    this.error = 'Failed to open file';
    return;
  }
  
  // Force a new object reference to trigger ngOnChanges in editor
  this.selectedFile = {
    ...file,
    content: file.content || '' // Ensure content is a new string reference
  };
  
  if (!this.openTabs.some((t) => t.path === file.path)) {
    this.openTabs.push({ ...file });
  }
  
  this.loadingFile = false;
  this.refreshSideData();
}

  private appendTerminal(line: string): void {
    this.terminalLines = [...this.terminalLines, line].slice(-200);
  }

  private mapLanguageForDisplay(language: string | null | undefined, name: string): 'PYTHON' | 'NODE' | 'JAVA' | 'HTML' | null {
    const normalized = (language || '').toLowerCase();
    if (normalized.includes('python') || name.endsWith('.py')) {
      return 'PYTHON';
    }
    if (normalized.includes('javascript') || normalized.includes('node') || name.endsWith('.js')) {
      return 'NODE';
    }
    if (normalized.includes('java') || name.endsWith('.java')) {
      return 'JAVA';
    }
    if (name.endsWith('.html') || name.endsWith('.htm')) {
      return 'HTML';
    }
    return null;
  }

  private openInBrowser(htmlContent: string, filename: string): void {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    this.runOutput = `Opened ${filename} in new browser tab`;
    this.appendTerminal(this.runOutput);
    this.bottomTab = 'output';
    this.toastService.success('HTML opened in browser');
  }

  toggleReviewMode(): void {
    this.reviewMode = !this.reviewMode;
    this.selectedCommentLine = null;
  }

  onLineClick(lineNumber: number): void {
    if (this.reviewMode) {
      this.selectedCommentLine = this.selectedCommentLine === lineNumber ? null : lineNumber;
    }
  }

  switchTab(tab: AppFile): void {
    this.selectedFile = { ...tab };
    this.refreshSideData();
  }

  closeTab(tabPath: string): void {
    this.openTabs = this.openTabs.filter((tab) => tab.path !== tabPath);
    if (this.selectedFile?.path === tabPath) {
      this.selectedFile = this.openTabs.length ? { ...this.openTabs[this.openTabs.length - 1] } : null;
      this.refreshSideData();
    }
  }

  saveCurrentFile(): void {
    if (this.readOnly) {
      this.toastService.info('Guest mode is read-only. Sign in to edit.');
      return;
    }
    if (!this.selectedFile) return;
    
    this.appState.updateFileContent(this.projectId, this.selectedFile.path, this.selectedFile.content);
    const user = this.authService.getCurrentUser();
    const createdBy = user?.userId ?? 0;
    const persistNewFile = (fileToSave: AppFile) => {
      this.fileService.createFile({
        projectId: this.projectId,
        path: fileToSave.path,
        name: fileToSave.name,
        isDirectory: false,
        content: fileToSave.content,
        parentId: fileToSave.parentId ?? undefined,
        language: fileToSave.language ?? this.inferLanguage(fileToSave.name),
        createdBy,
        branchId: this.currentBranch?.id
      }).subscribe({
        next: (created) => {
          const nextFiles = this.appState.files$.value.map((f) =>
            f.projectId === this.projectId && f.path === fileToSave.path
              ? { ...f, id: created.id, updatedAt: created.updatedAt || f.updatedAt }
              : f
          );
          this.appState.files$.next(nextFiles);
          this.openTabs = this.openTabs.map((tab) =>
            tab.path === fileToSave.path ? { ...tab, id: created.id } : tab
          );
          if (this.selectedFile?.path === fileToSave.path) {
            this.selectedFile = { ...this.selectedFile, id: created.id };
          }
          this.toastService.success(`${this.selectedFile!.name} saved to database.`);
        },
        error: (createErr) => {
          console.error('Failed to create file:', createErr);
          this.toastService.warning(`${this.selectedFile!.name} saved locally.`);
        }
      });
    };
    
    if (this.selectedFile.id < 9000) {
      this.fileService.updateFile(this.selectedFile.id, { path: this.selectedFile.path, content: this.selectedFile.content, lastModifiedBy: user?.userId ?? 0 }).subscribe({
        next: () => {
          this.toastService.success(`${this.selectedFile!.name} saved.`);
        },
        error: (err) => {
          if (err.status === 404) {
            const fileToSave = this.selectedFile;
            if (!fileToSave) return;
            persistNewFile(fileToSave);
          } else {
            console.error('Failed to save file:', err);
            const msg = err.error?.error || err.message || 'Unknown error';
            this.toastService.warning(`${this.selectedFile!.name} saved locally. (${msg})`);
          }
        }
      });
    } else {
      persistNewFile(this.selectedFile);
    }
    
    this.files = this.appState.getFilesByProject(this.projectId);
    this.tree = this.toTree(this.files);
    this.dirtyPaths.delete(this.selectedFile.path);
  }

  onSearchInput(): void {
    // Search is now triggered by button click only
  }

  performSearchOnClick(): void {
    this.performSearch(this.searchQuery);
  }

  replaceAll(): void {
    if (this.readOnly) {
      this.toastService.info('Guest mode is read-only. Sign in to edit.');
      return;
    }
    if (!this.searchQuery.trim()) return;
    const needle = this.searchQuery;
    this.files.filter((f) => !f.isDirectory).forEach((file) => {
      if (file.content.includes(needle)) {
        const next = file.content.split(needle).join(this.replaceText);
        this.appState.updateFileContent(this.projectId, file.path, next);
      }
    });
    this.files = this.appState.getFilesByProject(this.projectId);
    this.tree = this.toTree(this.files);
    if (this.selectedFile) {
      const refreshed = this.files.find((f) => f.path === this.selectedFile!.path);
      if (refreshed) {
        this.suppressEditorEmit = true;
        this.selectedFile = { ...refreshed };
        this.suppressEditorEmit = false;
      }
    }
    this.performSearch(this.searchQuery);
    this.toastService.success('Replace all complete.');
  }

  replaceSingle(path: string, lineNum: number): void {
    if (this.readOnly) {
      this.toastService.info('Guest mode is read-only. Sign in to edit.');
      return;
    }
    if (!this.searchQuery.trim() || !this.replaceText) return;
    
    const file = this.files.find((f) => f.path === path);
    if (!file) return;
    
    const lines = file.content.split('\\n');
    const lineIndex = lineNum - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    
    const line = lines[lineIndex];
    const matchIndex = line.indexOf(this.searchQuery);
    if (matchIndex === -1) return;
    
    const newLine = line.substring(0, matchIndex) + this.replaceText + line.substring(matchIndex + this.searchQuery.length);
    lines[lineIndex] = newLine;
    
    this.appState.updateFileContent(this.projectId, file.path, lines.join('\n'));
    this.files = this.appState.getFilesByProject(this.projectId);
    this.tree = this.toTree(this.files);
    if (this.selectedFile?.path === path) {
      const refreshed = this.files.find((f) => f.path === path);
      if (refreshed) {
        this.suppressEditorEmit = true;
        this.selectedFile = { ...refreshed };
        this.suppressEditorEmit = false;
      }
    }
    this.performSearch(this.searchQuery);
    this.toastService.success('Replaced at line ' + lineNum);
  }

  openSearchResult(result: { path: string; line: number; startColumn?: number; endColumn?: number }): void {
    const target = this.files.find((f) => f.path === result.path);
    if (target) {
      this.openFile(target.id);
      setTimeout(() => {
        this.liveEditor?.revealLine(result.line);
        this.liveEditor?.flashLineRange(result.line, result.line, 2000);
      }, 0);
    }
  }


  getFilteredComments(): Comment[] {
    let list = this.comments;
    if (this.commentFilter === 'open') {
      list = list.filter((c) => !c.resolved);
    }
    if (this.commentFilter === 'resolved') {
      list = list.filter((c) => c.resolved);
    }
    return list;
  }

  addComment(): void {
    if (this.readOnly) {
      this.toastService.info('Guest mode is read-only. Sign in to comment.');
      return;
    }
    if (!this.selectedFile || !this.selectedCommentRange || !this.newCommentText.trim()) {
      return;
    }
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.commentService.createComment({
      fileId: this.selectedFile.id,
      lineNumber: this.selectedCommentRange.startLine,
      authorId: user.userId,
      content: this.newCommentText.trim()
    }).subscribe({
      next: (comment) => {
        this.comments.push(comment);
        this.newCommentText = '';
        this.pendingCommentOpen = false;
        this.selectedCommentRange = null;
        this.toastService.success('Comment added.');
      },
      error: () => this.toastService.error('Failed to add comment.')
    });
  }

  openCommentComposerFromSelection(): void {
    if (this.readOnly) {
      this.toastService.info('Guest mode is read-only. Sign in to comment.');
      return;
    }
    const info = this.liveEditor?.getSelectionInfo();
    if (!info || !info.hasSelection) {
      this.toastService.info('Select code first to add an inline comment.');
      return;
    }
    this.showCommentsPanel = true;
    this.activeTab = 'comments';
    this.pendingCommentOpen = true;
    this.selectedCommentRange = {
      startLine: Math.min(info.startLine, info.endLine),
      endLine: Math.max(info.startLine, info.endLine)
    };
  }

  cancelPendingComment(): void {
    this.pendingCommentOpen = false;
    this.selectedCommentRange = null;
    this.newCommentText = '';
  }

  getCommentAuthorName(comment: Comment): string {
    const user = this.appState.getUsers().find((u) => u.id === comment.authorId);
    if (user) return user.name;
    
    // Check if it's the current user
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.userId === comment.authorId) {
      return currentUser.fullName;
    }
    
    return 'Unknown';
  }

  jumpToComment(comment: Comment): void {
    this.liveEditor?.revealLine(comment.lineNumber);
    this.liveEditor?.flashLineRange(comment.lineNumber, comment.lineNumber, 2000);
  }

  toggleCommentsPanel(): void {
    this.showCommentsPanel = !this.showCommentsPanel;
    if (this.showCommentsPanel) {
      this.activeTab = 'comments';
    }
  }

  toggleProjectSearch(): void {
    this.showProjectSearchPanel = !this.showProjectSearchPanel;
    if (this.showProjectSearchPanel) {
      this.activeTab = 'search';
      this.onSearchInput();
    }
  }

  toggleCommitPanel(): void {
    this.showCommitPanel = !this.showCommitPanel;
  }

  openCommit(commit: any): void {
    this.selectedCommit = commit;
    this.showDiffViewer = true;
    this.vcsService.getSnapshot(commit.hash).subscribe({
      next: (detail) => {
        commit.newContent = detail.fullContent;
        if (detail.parentHash) {
          this.vcsService.getSnapshot(detail.parentHash).subscribe({
            next: (parentDetail) => {
              commit.oldContent = parentDetail.fullContent;
            }
          });
        } else {
          commit.oldContent = '';
        }
      }
    });
  }

  closeDiffViewer(): void {
    this.showDiffViewer = false;
  }

  restoreCommit(): void {
    if (!this.selectedCommit || !this.selectedFile) return;

    const request = {
      fileId: this.selectedFile.id,
      snapshotHash: this.selectedCommit.hash,
      authorId: this.authService.getCurrentUser()?.userId || 1,
      branchId: this.currentBranch?.id
    };

    this.vcsService.restore(request).subscribe({
      next: (detail) => {
        this.toastService.success('Commit restored successfully');
        if (this.selectedFile) {
          this.selectedFile.content = detail.fullContent;
          this.appState.updateFileContent(this.projectId, this.selectedFile.path, detail.fullContent);
          if (this.collabSession && this.status === 'Connected') {
            const currentUserId = this.authService.getCurrentUser()?.userId;
            if (currentUserId) {
              this.collabService.sendEdit(this.selectedFile.id, String(currentUserId), detail.fullContent);
            }
          }
        }
        this.closeDiffViewer();
        this.refreshSideData();
      },
      error: () => this.toastService.error('Failed to restore commit')
    });
  }

  getDiffRows(side: 'old' | 'new'): Array<{ line: number; text: string; kind: 'added' | 'deleted' | 'unchanged' }> {
    if (!this.selectedCommit) {
      return [];
    }
    const oldLines = this.selectedCommit.oldContent.split('\\n');
    const newLines = this.selectedCommit.newContent.split('\\n');
    const max = Math.max(oldLines.length, newLines.length);
    const rows: Array<{ line: number; text: string; kind: 'added' | 'deleted' | 'unchanged' }> = [];

    for (let i = 0; i < max; i += 1) {
      const oldLine = oldLines[i] ?? '';
      const newLine = newLines[i] ?? '';
      if (side === 'old') {
        rows.push({
          line: i + 1,
          text: oldLine,
          kind: oldLine === newLine ? 'unchanged' : 'deleted'
        });
      } else {
        rows.push({
          line: i + 1,
          text: newLine,
          kind: oldLine === newLine ? 'unchanged' : 'added'
        });
      }
    }
    return rows;
  }

  getUnifiedRows(): Array<{ leftLine: string; rightLine: string; text: string; kind: 'added' | 'deleted' | 'unchanged' }> {
    if (!this.selectedCommit) {
      return [];
    }
    const oldLines = this.selectedCommit.oldContent.split('\\n');
    const newLines = this.selectedCommit.newContent.split('\\n');
    const max = Math.max(oldLines.length, newLines.length);
    const rows: Array<{ leftLine: string; rightLine: string; text: string; kind: 'added' | 'deleted' | 'unchanged' }> = [];

    for (let i = 0; i < max; i += 1) {
      const oldLine = oldLines[i] ?? '';
      const newLine = newLines[i] ?? '';
      if (oldLine === newLine) {
        rows.push({ leftLine: String(i + 1), rightLine: String(i + 1), text: oldLine, kind: 'unchanged' });
      } else {
        if (oldLine) {
          rows.push({ leftLine: String(i + 1), rightLine: '', text: oldLine, kind: 'deleted' });
        }
        if (newLine) {
          rows.push({ leftLine: '', rightLine: String(i + 1), text: newLine, kind: 'added' });
        }
      }
    }
    return rows;
  }

  closeProjectSearch(): void {
    this.showProjectSearchPanel = false;
  }

  onFindInput(): void {
    const result = this.liveEditor?.setFindQuery(this.findQuery) || { count: 0, activeIndex: -1 };
    this.findCount = result.count;
    this.findActiveIndex = result.activeIndex >= 0 ? result.activeIndex + 1 : 0;
  }

  findNext(): void {
    const result = this.liveEditor?.moveFind('next') || { count: 0, activeIndex: -1 };
    this.findCount = result.count;
    this.findActiveIndex = result.activeIndex >= 0 ? result.activeIndex + 1 : 0;
  }

  findPrev(): void {
    const result = this.liveEditor?.moveFind('prev') || { count: 0, activeIndex: -1 };
    this.findCount = result.count;
    this.findActiveIndex = result.activeIndex >= 0 ? result.activeIndex + 1 : 0;
  }

  closeFindBar(): void {
    this.showFindBar = false;
    this.findQuery = '';
    this.findCount = 0;
    this.findActiveIndex = 0;
    this.liveEditor?.clearFind();
  }

  resolveComment(id: number): void {
    if (this.readOnly) {
      this.toastService.info('Guest mode is read-only. Sign in to comment.');
      return;
    }
    this.commentService.resolveComment(id).subscribe({
      next: () => {
        const c = this.comments.find(c => c.id === id);
        if (c) c.resolved = true;
      },
      error: () => this.toastService.error('Failed to resolve comment.')
    });
  }

  deleteComment(id: number): void {
    if (this.readOnly) {
      this.toastService.info('Guest mode is read-only. Sign in to comment.');
      return;
    }
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.commentService.deleteComment(id, user.userId).subscribe({
      next: () => {
        this.comments = this.comments.filter(c => c.id !== id);
      },
      error: () => this.toastService.error('Failed to delete comment.')
    });
  }

  startEditComment(comment: Comment): void {
    if (this.readOnly) return;
    this.editingCommentId = comment.id;
    this.editCommentText = comment.content;
  }

  saveEditComment(id: number): void {
    if (this.readOnly || !this.editCommentText.trim()) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    
    this.commentService.updateComment(id, { content: this.editCommentText.trim(), authorId: user.userId }).subscribe({
      next: (updated) => {
        const c = this.comments.find(c => c.id === id);
        if (c) c.content = updated.content;
        this.cancelEditComment();
        this.toastService.success('Comment updated.');
      },
      error: () => this.toastService.error('Failed to update comment.')
    });
  }

  cancelEditComment(): void {
    this.editingCommentId = null;
    this.editCommentText = '';
  }

  startReply(commentId: number): void {
    if (this.readOnly) return;
    this.replyingCommentId = commentId;
    this.replyCommentText = '';
  }

  submitReply(parentCommentId: number): void {
    if (this.readOnly || !this.replyCommentText.trim()) return;
    const user = this.authService.getCurrentUser();
    if (!user || !this.selectedFile) return;

    this.commentService.createComment({
      fileId: this.selectedFile.id,
      lineNumber: 1,
      content: this.replyCommentText.trim(),
      authorId: user.userId,
      parentCommentId: parentCommentId
    }).subscribe({
      next: (reply) => {
        const parent = this.comments.find(c => c.id === parentCommentId);
        if (parent) {
          if (!parent.replies) parent.replies = [];
          parent.replies.push(reply);
        }
        this.cancelReply();
        this.toastService.success('Reply added.');
      },
      error: (err) => {
        console.error('Failed to add reply:', err);
        this.toastService.error('Failed to add reply');
      }
    });
  }

  cancelReply(): void {
    this.replyingCommentId = null;
    this.replyCommentText = '';
  }

  useCommit(commit: CommitEntry): void {
    this.selectedCommit = commit;
  }

  openCreateModal(isFolder: boolean): void {
    if (this.readOnly) {
      this.toastService.info('Guest mode is read-only. Sign in to edit.');
      return;
    }
    this.createFolder = isFolder;
    this.newFileName = '';
    this.showFileModal = true;
  }

  showNewFileModal(isFolder: boolean): void {
    if (this.readOnly) {
      this.toastService.info('Guest mode is read-only. Sign in to edit.');
      return;
    }
    this.selectedFolderId = null;
    this.createFolder = isFolder;
    this.newFileName = '';
    this.showFileModal = true;
  }

  createInSelectedFolder(isFolder: boolean): void {
    if (this.readOnly) {
      this.toastService.info('Guest mode is read-only. Sign in to edit.');
      return;
    }
    if (!this.selectedFolderId) {
      this.toastService.info('Select a folder first, then create.');
      return;
    }
    this.createFolder = isFolder;
    this.newFileName = '';
    this.showFileModal = true;
  }

  getSelectedFolderName(): string {
    if (!this.selectedFolderId) return '';
    const folder = this.appState.getFileById(this.projectId, this.selectedFolderId);
    return folder?.name || '';
  }

  createNode(): void {
    if (!this.newFileName.trim()) {
      return;
    }
    const createdBy = this.authService.getCurrentUser()?.userId ?? 0;
    if (!createdBy) {
      this.toastService.error('Sign in to create files.');
      return;
    }

    const parentId = this.selectedFolderId;
    const parentPath = parentId
      ? this.appState.getFileById(this.projectId, parentId)?.path || ''
      : '';
    const fullPath = parentPath ? `${parentPath}/${this.newFileName.trim()}` : this.newFileName.trim();
    const language = this.createFolder ? 'folder' : this.inferLanguage(fullPath);
    
    this.appState.createFile(this.projectId, parentPath, this.newFileName.trim(), this.createFolder, parentId);
    
    const newFile = this.appState.getFilesByProject(this.projectId).find(f => f.name === this.newFileName.trim() && f.path === fullPath);
    
    // Persist to backend
    if (newFile && newFile.id >= 9000) {
      this.fileService.createFile({
        projectId: this.projectId,
        path: fullPath,
        name: this.newFileName.trim(),
        isDirectory: this.createFolder,
        content: '',
        parentId: parentId ?? undefined,
        language,
        createdBy,
        branchId: this.currentBranch?.id
      }).subscribe({
        next: (created) => {
          const idx = this.appState.files$.value.findIndex(f => f.id === newFile.id);
          if (idx >= 0) {
            const files = [...this.appState.files$.value];
            files[idx] = { ...files[idx], id: created.id, parentId: created.parentId ?? parentId };
            this.appState.files$.next(files);
          }
          // Refresh tree with the real backend ID
          this.files = this.appState.getFilesByProject(this.projectId);
          this.tree = this.toTree(this.files);
          this.toastService.success(this.createFolder ? 'Folder created.' : 'File created.');
        },
        error: (err) => {
          console.error('Failed to create file in backend:', err);
          this.toastService.success(this.createFolder ? 'Folder created.' : 'File created.');
        }
      });
    } else {
      this.toastService.success(this.createFolder ? 'Folder created.' : 'File created.');
    }
    
    this.showFileModal = false;
    // Keep selectedFolderId so user can create more files in the same folder
    this.files = this.appState.getFilesByProject(this.projectId);
    this.tree = this.toTree(this.files);
  }

askDeleteSelected(): void {
    if (!this.selectedFile) return;
    this.pendingDeletePath = this.selectedFile.path;
    this.showDeleteModal = true;
  }

  deleteSelected(): void {
    if (!this.pendingDeletePath) return;
    
    const fileToDelete = this.files.find(f => f.path === this.pendingDeletePath);
    const pendingPath = this.pendingDeletePath;
    this.pendingDeletePath = '';
    
    if (fileToDelete && fileToDelete.id < 9000) {
      this.fileService.deleteFile(fileToDelete.id).subscribe({
        next: () => {
          this.appState.deleteFile(this.projectId, pendingPath);
          this.toastService.warning('Deleted.');
        },
        error: (err) => {
          console.error('Failed to delete file from backend:', err);
          this.appState.deleteFile(this.projectId, pendingPath);
          this.toastService.warning('Deleted.');
        }
      });
    } else {
      this.appState.deleteFile(this.projectId, pendingPath);
      this.toastService.warning('Deleted.');
    }
    
this.showDeleteModal = false;
    this.files = this.appState.getFilesByProject(this.projectId);
    this.tree = this.toTree(this.files);
  }


  openShare(): void {
    if (this.readOnly) {
      this.toastService.info('Guest mode is read-only. Sign in to share.');
      return;
    }
    this.showShareModal = true;
    this.shareEmail = '';
    this.shareRole = 'Viewer';
  }

  shareWorkspace(): void {
    if (!this.project) return;
    const email = this.shareEmail.trim().toLowerCase();
    const user = this.appState.findUserByEmail(email);
    if (!user) {
      this.toastService.error('Collaborator not found.');
      return;
    }
    const existing = this.project.collaborators.find((c) => c.userId === user.id);
    const collaborators = existing
      ? this.project.collaborators.map((c) => (c.userId === user.id ? { ...c, role: this.shareRole } : c))
      : [...this.project.collaborators, { userId: user.id, role: this.shareRole }];
    this.appState.updateProject(this.project.id, { collaborators });
    navigator.clipboard?.writeText(`codesync://workspace/${this.project.id}`).catch(() => {});
    this.showShareModal = false;
    this.project = this.appState.projects$.value.find((p) => p.id === this.projectId) || this.project;
    this.toastService.success('Workspace shared and link copied.');
  }

  dismissReadOnlyPrompt(): void {
    this.showReadOnlyPrompt = false;
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.showDiffViewer) {
        this.closeDiffViewer();
        return;
      }
      if (this.showCommitPanel) {
        this.showCommitPanel = false;
        return;
      }
      if (this.showFindBar) {
        this.closeFindBar();
        return;
      }
      if (this.showProjectSearchPanel) {
        this.closeProjectSearch();
        return;
      }
      if (this.pendingCommentOpen) {
        this.cancelPendingComment();
        return;
      }
      this.showFileModal = false;
      this.showDeleteModal = false;
      this.showShareModal = false;
      this.showReadOnlyPrompt = false;
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.saveCurrentFile();
      return;
    }

    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.showFindBar = true;
      this.onFindInput();
      return;
    }

    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.showProjectSearchPanel = true;
      this.activeTab = 'search';
      return;
    }

    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      this.openCommentComposerFromSelection();
      return;
    }
  }

  private refreshSideData(): void {
    if (!this.selectedFile) {
      this.comments = [];
      this.commitEntries = [];
      this.loadVcsData();
    } else {
      this.commentService.getCommentsByFile(this.selectedFile.id).subscribe({
        next: (comments) => this.comments = comments,
        error: () => this.comments = []
      });
      this.vcsService.listHistory(this.selectedFile.id, this.currentBranch?.id).subscribe({
        next: (summaries) => {
          this.commitEntries = summaries.map(s => ({
            id: 0,
            projectId: this.projectId,
            hash: s.commitHash,
            message: s.commitMessage || 'No message',
            author: this.appState.getUsers().find(u => u.id === s.authorId)?.name || 'Unknown',
            timestamp: s.timestamp,
            fileChangeCount: 1,
            additions: 0,
            deletions: 0,
            filePath: this.selectedFile!.path,
            oldContent: '',
            newContent: '',
            parentHash: s.parentHash
          } as any));
          if (!this.selectedCommit && this.commitEntries.length > 0) {
            this.selectedCommit = this.commitEntries[0];
          }
          this.loadVcsData();
        },
        error: () => {
          this.commitEntries = [];
          this.loadVcsData();
        }
      });
    }
  }

  private loadVcsData(): void {
    this.vcsService.listRepositories(this.projectId).subscribe({
      next: (repos) => {
        this.repositories = repos;
        if (repos.length > 0 && !this.currentRepo) {
          this.currentRepo = repos[0];
          this.loadBranches();
          this.loadPullRequests();
        } else if (repos.length === 0) {
          this.createDefaultRepository();
        }
      },
      error: () => this.createDefaultRepository()
    });
  }

  private createDefaultRepository(): void {
    this.vcsService.createRepository({
      projectId: this.projectId,
      name: 'main',
      isPublic: false
    }).subscribe({
      next: (repo) => {
        this.repositories = [repo];
        this.currentRepo = repo;
        this.loadBranches();
      },
      error: () => this.toastService.error('Failed to create repository')
    });
  }

  loadBranches(): void {
    if (!this.currentRepo) return;
    this.vcsService.listBranches(this.projectId).subscribe({
      next: (branches) => {
        this.branches = branches;
        this.currentBranch = branches.find(b => b.isDefault) || branches[0] || null;
      }
    });
  }

  loadPullRequests(): void {
    if (!this.currentRepo) return;
    this.vcsService.listPullRequests(this.currentRepo.id).subscribe({
      next: (prs) => this.pullRequests = prs
    });
  }

  createCommit(): void {
    if (!this.selectedFile || !this.newCommitMessage.trim()) {
      this.toastService.warning('Please enter a commit message');
      return;
    }
    const request: CreateSnapshotRequest = {
      fileId: this.selectedFile.id,
      fullContent: this.selectedFile.content,
      commitMessage: this.newCommitMessage,
      authorId: this.authService.getCurrentUser()?.userId || 1,
      branchId: this.currentBranch?.id
    };
    this.vcsService.createSnapshot(request).subscribe({
      next: () => {
        this.toastService.success('Commit created');
        this.newCommitMessage = '';
        this.showCommitModal = false;
        this.loadBranches();
        this.refreshSideData();
      },
      error: () => this.toastService.error('Failed to create commit')
    });
  }

  createBranch(): void {
    if (!this.newBranchName.trim()) {
      this.toastService.warning('Please enter a branch name');
      return;
    }
    const payload = { 
      projectId: this.projectId, 
      name: this.newBranchName,
      sourceBranchId: this.currentBranch?.id
    };
    this.vcsService.createBranch(payload).subscribe({
      next: () => {
        this.toastService.success('Branch created');
        this.newBranchName = '';
        this.showBranchModal = false;
        this.loadBranches();
      },
      error: () => this.toastService.error('Failed to create branch')
    });
  }

 onBranchChange(): void {
  if (!this.currentBranch) return;
  
  this.toastService.info(`Checking out branch: ${this.currentBranch.name}...`);
  
  // Clear ALL local state before checkout
  this.selectedFile = null;
  this.openTabs = [];
  this.files = [];
  this.tree = [];
  this.dirtyPaths.clear();
  this.error = null;
  
  // Show loading state
  this.loadingTree = true;
  this.loadingFile = true;
  
  this.vcsService.checkout(this.currentBranch.id).subscribe({
    next: () => {
      this.toastService.success(`Switched to ${this.currentBranch!.name}`);
      this.appState.clearFilesForProject(this.projectId);
      this.loadTree();
    },
    error: () => {
      this.toastService.error('Failed to checkout branch');
      this.loadingTree = false;
      this.loadingFile = false;
      // Reload tree even on error to restore state
      this.loadTree();
    }
  });
}

  createPullRequest(): void {
    if (!this.currentRepo || !this.newPrTitle.trim() || !this.selectedSourceBranch || !this.selectedTargetBranch) {
      this.toastService.warning('Please fill all required fields');
      return;
    }
    this.vcsService.createPullRequest({
      repositoryId: this.currentRepo.id,
      title: this.newPrTitle,
      description: this.newPrDescription,
      sourceBranchId: this.selectedSourceBranch.id,
      targetBranchId: this.selectedTargetBranch.id,
      authorId: this.authService.getCurrentUser()?.userId || 1,
    }).subscribe({
      next: () => {
        this.toastService.success('Pull request created');
        this.newPrTitle = '';
        this.newPrDescription = '';
        this.showPrModal = false;
        this.loadPullRequests();
      },
      error: () => this.toastService.error('Failed to create pull request')
    });
  }

  mergePullRequest(pr: PullRequest): void {
    this.vcsService.mergePullRequest({
      pullRequestId: pr.id,
      authorId: this.authService.getCurrentUser()?.userId || 1,
    }).subscribe({
      next: () => {
        this.toastService.success('Pull request merged');
        this.loadPullRequests();
        this.loadBranches();
      },
      error: () => this.toastService.error('Failed to merge pull request')
    });
  }

  toggleVcsPanel(): void {
    this.showVcsPanel = !this.showVcsPanel;
    if (this.showVcsPanel) {
      this.loadVcsData();
    }
  }

  private performSearch(query: string): void {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      this.searchResults = [];
      this.groupedSearchResults = [];
      return;
    }

    const results: Array<{ path: string; line: number; preview: string; startColumn: number; endColumn: number }> = [];
    this.files.filter((f) => !f.isDirectory).forEach((file) => {
      const lines = file.content.split('\\n');
      lines.forEach((line, index) => {
        const lower = line.toLowerCase();
        const matchAt = lower.indexOf(needle);
        if (matchAt >= 0) {
          results.push({
            path: file.path,
            line: index + 1,
            preview: line,
            startColumn: matchAt + 1,
            endColumn: matchAt + needle.length + 1
          });
        }
      });
    });
    this.searchResults = results;

    const grouped = new Map<string, Array<{ line: number; preview: string; startColumn: number; endColumn: number }>>();
    results.forEach((result) => {
      const list = grouped.get(result.path) || [];
      list.push({ line: result.line, preview: result.preview, startColumn: result.startColumn, endColumn: result.endColumn });
      grouped.set(result.path, list);
    });
    this.groupedSearchResults = Array.from(grouped.entries()).map(([path, items]) => ({ path, items }));
  }

  highlightMatch(line: string, query: string): string {
    if (!query) {
      return this.escapeHtml(line);
    }
    const escaped = this.escapeHtml(line);
    const safeQuery = this.escapeRegExp(this.escapeHtml(query));
    return escaped.replace(new RegExp(safeQuery, 'ig'), (match) => `<span class="match-highlight">${match}</span>`);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  private inferLanguage(filename: string): string {
    if (filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.py')) return 'python';
    if (filename.endsWith('.java')) return 'java';
    if (filename.endsWith('.go')) return 'go';
    if (filename.endsWith('.rs')) return 'rust';
    if (filename.endsWith('.cpp') || filename.endsWith('.cc')) return 'cpp';
    if (filename.endsWith('.html')) return 'html';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.json')) return 'json';
    return 'plaintext';
  }

  private toTree(files: AppFile[]): FileNode[] {
    const root: FileNode[] = [];
    const byPath = new Map<string, FileNode>();
    const byId = new Map<number, FileNode>();

    // First pass: create all nodes
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
    sorted.forEach((file) => {
      const node: FileNode = {
        id: file.id,
        name: file.name,
        path: file.path,
        parentId: file.parentId,
        projectId: file.projectId,
        content: file.content,
        isDirectory: file.isDirectory,
        language: file.language,
        createdBy: 0,
        lastModifiedBy: 0,
        createdAt: file.updatedAt,
        updatedAt: file.updatedAt,
        children: []
      };
      byPath.set(file.path, node);
      byId.set(file.id, node);
    });

    // Second pass: build hierarchy using parentId first, then path-based fallback
    byPath.forEach((node) => {
      let parent: FileNode | undefined;

      // Strategy 1: Use parentId to find parent
      if (node.parentId && node.parentId !== 0) {
        parent = byId.get(node.parentId);
      }

      // Strategy 2: Path-based fallback if parentId didn't resolve
      if (!parent && node.path.includes('/')) {
        const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
        parent = byPath.get(parentPath);
      }

      if (parent && parent.children) {
        parent.children.push(node);
      } else {
        root.push(node);
      }
    });

    // Sort children: folders first (alphabetically), then files (alphabetically)
    const sortNodes = (nodes: FileNode[]): void => {
      nodes.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach((n) => {
        if (n.children && n.children.length > 0) {
          sortNodes(n.children);
        }
      });
    };
    sortNodes(root);

    return root;
  }

  updateOpenTabContent(path: string, content: string): void {
    this.openTabs = this.openTabs.map((tab) => (tab.path === path ? { ...tab, content } : tab));
  }

  private runByFileName(fileName: string, triggerRun: boolean): void {
    const target = this.files.find((f) => !f.isDirectory && f.name === fileName);
    if (!target) {
      this.toastService.warning(`File ${fileName} not found in this project.`);
      return;
    }
    this.openFile(target.id);
    if (triggerRun) {
      setTimeout(() => this.onRunCode(), 120);
    }
  }

  toggleCollabPanel(): void {
    this.showCollabPanel = !this.showCollabPanel;
  }

  startCollabSession(): void {
    if (!this.selectedFile || this.readOnly) {
      this.toastService.info('Open a file to start collaboration.');
      return;
    }
    if ((this.selectedFile?.id ?? 0) >= 9000) {
      this.toastService.error('Save this file to the database first (Ctrl+S), then start collaboration.');
      return;
    }
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const fileId = this.selectedFile.id;
    const userId = String(user.userId);
    const displayName = user.fullName || user.email;

    // Create session via HTTP first, then connect WebSocket
    this.collabService.startSession(fileId, userId, displayName).subscribe({
      next: (session) => {
        this.collabSession = session;
        this.collabParticipants = session.participants;
        this.isCollabOwner = session.hostUserId === userId;
        this.chatMessages = [];
        this.collabService.saveSession(fileId, userId, displayName, this.projectId);
        this.toastService.success('Collaboration session started!');
        // Now connect WebSocket for real-time sync
        this.collabService.connect(fileId).then(() => {
          this.setupCollabListeners();
        }).catch((wsErr: any) => {
          console.error('WebSocket connection failed after session start:', wsErr);
          this.toastService.warning('Session created but real-time sync unavailable.');
        });
      },
      error: (err: any) => {
        if (err.status === 400) {
          this.collabService.joinSession(fileId, userId, displayName).subscribe({
            next: (session) => {
              this.collabSession = session;
              this.collabParticipants = session.participants;
              this.isCollabOwner = session.hostUserId === userId;
              this.chatMessages = [];
              this.collabService.saveSession(fileId, userId, displayName, this.projectId);
              this.toastService.info('Joined existing collaboration session.');
              this.collabService.connect(fileId).then(() => {
                this.setupCollabListeners();
              }).catch((wsErr: any) => {
                console.error('WebSocket connection failed after join:', wsErr);
                this.toastService.warning('Session joined but real-time sync unavailable.');
              });
            },
            error: (joinErr: any) => {
              console.error('Failed to join existing collab session:', joinErr);
              this.toastService.error('Failed to start or join collaboration.');
            }
          });
        } else {
          console.error('Failed to start collab:', err);
          this.toastService.error('Failed to start collaboration.');
        }
      }
    });
  }

  joinCollabSession(): void {
    if (!this.selectedFile || this.readOnly) {
      this.toastService.info('Open a file to join collaboration.');
      return;
    }
    if ((this.selectedFile?.id ?? 0) >= 9000) {
      this.toastService.error('Save this file to the database first (Ctrl+S), then start collaboration.');
      return;
    }
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const fileId = this.selectedFile.id;
    const userId = String(user.userId);
    const displayName = user.fullName || user.email;

    // Join session via HTTP first, then connect WebSocket
    this.collabService.joinSession(fileId, userId, displayName).subscribe({
      next: (session) => {
        this.collabSession = session;
        this.collabParticipants = session.participants;
        this.isCollabOwner = session.hostUserId === userId;
        this.chatMessages = [];
        this.collabService.saveSession(fileId, userId, displayName, this.projectId);
        this.toastService.success('Joined collaboration session!');
        // Now connect WebSocket for real-time sync
        this.collabService.connect(fileId).then(() => {
          this.setupCollabListeners();
        }).catch((wsErr: any) => {
          console.error('WebSocket connection failed after join:', wsErr);
          this.toastService.warning('Session joined but real-time sync unavailable.');
        });
      },
      error: (err: any) => {
        console.error('Failed to join collab:', err);
        const msg = err.error?.message || err.error?.error || 'No active session found for this file.';
        this.toastService.error(`Could not join: ${msg}`);
      }
    });
  }

  leaveCollabSession(): void {
    if (!this.selectedFile) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const fileId = this.selectedFile.id;
    this.collabService.leaveSession(fileId, String(user!.userId)).subscribe({
      next: () => {
        this.collabSession = null;
        this.collabParticipants = [];
        this.liveCursors.clear();
        this.liveCursors = new Map();
        this.chatMessages = [];
        this.collabService.disconnect();
        this.collabService.clearSavedSession();
        this.toastService.info('Left collaboration session.');
      },
      error: (err: any) => {
        console.error('Failed to leave collab:', err);
      }
    });
  }

  endCollabSession(): void {
    if (!this.selectedFile || !this.isCollabOwner) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const fileId = this.selectedFile.id;
    this.collabService.endSession(fileId, String(user!.userId), this.projectId).subscribe({
      next: () => {
        this.collabSession = null;
        this.collabParticipants = [];
        this.liveCursors.clear();
        this.liveCursors = new Map();
        this.chatMessages = [];
        this.collabService.disconnect();
        this.collabService.clearSavedSession();
        this.toastService.info('Collaboration session ended.');
      },
      error: (err: any) => {
        console.error('Failed to end collab:', err);
      }
    });
  }

  kickParticipant(userId: string): void {
    if (!this.selectedFile || !this.isCollabOwner) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const fileId = this.selectedFile.id;
    this.collabService.kickParticipant(fileId, userId, String(user!.userId)).subscribe({
      next: () => {
        this.toastService.info('Participant kicked.');
      },
      error: (err: any) => {
        console.error('Failed to kick:', err);
        this.toastService.error('Failed to kick participant.');
      }
    });
  }

  private setupCollabListeners(): void {
    this.collabService.events$.pipe(takeUntil(this.destroy$)).subscribe((envelope) => {
      switch (envelope.type) {
        case 'JOIN':
          const joinPayload = envelope.payload as { displayName?: string; hostTransfer?: boolean; newHostUserId?: string; newHostDisplayName?: string };
          if (joinPayload.hostTransfer && joinPayload.newHostUserId) {
            // Host transfer event
            if (this.collabSession) {
              (this.collabSession as any).hostUserId = joinPayload.newHostUserId;
            }
            this.isCollabOwner = joinPayload.newHostUserId === String(this.authService.getCurrentUser()?.userId);
            this.toastService.info(`${joinPayload.newHostDisplayName || 'Someone'} is now the session host.`);
          } else if (joinPayload.displayName) {
            if (!this.collabParticipants.find(p => p.userId === envelope.userId)) {
              this.collabParticipants.push({ userId: envelope.userId, displayName: joinPayload.displayName });
            }
            this.toastService.info(`${joinPayload.displayName} joined the session.`);
          }
          break;
        case 'LEAVE':
          const leavePayload = envelope.payload as { displayName?: string };
          const leavingName = leavePayload.displayName || this.collabParticipants.find(p => p.userId === envelope.userId)?.displayName || 'A participant';
          this.collabParticipants = this.collabParticipants.filter(p => p.userId !== envelope.userId);
          this.liveCursors.delete(envelope.userId);
          this.liveCursors = new Map(this.liveCursors);
          this.toastService.info(`${leavingName} left the session.`);
          break;
        case 'KICK':
          const kickPayload = envelope.payload as { kickedUserId: string; kickedDisplayName?: string };
          if (kickPayload.kickedUserId === String(this.authService.getCurrentUser()?.userId)) {
            this.toastService.warning('You have been kicked from the session.');
            this.collabSession = null;
            this.collabParticipants = [];
            this.liveCursors.clear();
            this.liveCursors = new Map();
            this.chatMessages = [];
            this.collabService.disconnect();
            this.collabService.clearSavedSession();
          } else {
            const kickedName = kickPayload.kickedDisplayName || this.collabParticipants.find(p => p.userId === kickPayload.kickedUserId)?.displayName || 'A participant';
            this.collabParticipants = this.collabParticipants.filter(p => p.userId !== kickPayload.kickedUserId);
            this.liveCursors.delete(kickPayload.kickedUserId);
            this.liveCursors = new Map(this.liveCursors);
            this.toastService.info(`${kickedName} was removed from the session.`);
          }
          break;
        case 'SESSION_END':
          this.toastService.info('Collaboration session has ended.');
          this.collabSession = null;
          this.collabParticipants = [];
          this.liveCursors.clear();
          this.liveCursors = new Map();
          this.chatMessages = [];
          this.collabService.disconnect();
          this.collabService.clearSavedSession();
          break;
        case 'CURSOR':
          const cursorPayload = envelope.payload as { lineNumber: number; column: number };
          const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
          const colorIndex = this.collabParticipants.findIndex(p => p.userId === envelope.userId);
          this.liveCursors.set(envelope.userId, {
            line: cursorPayload.lineNumber,
            column: cursorPayload.column,
            color: colors[colorIndex % colors.length],
            name: this.collabParticipants.find(p => p.userId === envelope.userId)?.displayName || 'Unknown'
          });
          this.liveCursors = new Map(this.liveCursors);
          break;
        case 'EDIT':
          if (this.selectedFile && String(this.authService.getCurrentUser()?.userId) !== envelope.userId) {
            const editPayload = envelope.payload as { text: string };
            this.handleRemoteEdit(editPayload.text);
          }
          break;
        case 'CHAT':
          const chatPayload = envelope.payload as { displayName: string; message: string; timestamp: number };
          this.chatMessages.push({
            userId: envelope.userId,
            displayName: chatPayload.displayName,
            message: chatPayload.message,
            timestamp: chatPayload.timestamp
          });
          // Keep last 200 messages
          if (this.chatMessages.length > 200) {
            this.chatMessages = this.chatMessages.slice(-200);
          }
          break;
      }
    });
  }

  private handleRemoteEdit(text: string): void {
    if (!this.selectedFile) return;
    this.suppressEditorEmit = true;
    this.selectedFile.content = text;
    this.appState.updateFileContent(this.projectId, this.selectedFile.path, text);
    this.suppressEditorEmit = false;
  }

  sendCollabEdit(content: string): void {
    if (!this.selectedFile || !this.collabSession) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.collabService.sendEdit(this.selectedFile.id, String(user!.userId), content);
  }

  sendCollabCursor(line: number, column: number): void {
    if (!this.selectedFile || !this.collabSession) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.collabService.sendCursor(this.selectedFile.id, String(user!.userId), line, column);
  }

  getParticipantColor(userId: string): string {
    const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
    const index = this.collabParticipants.findIndex(p => p.userId === userId);
    return colors[index % colors.length];
  }

  isCurrentUser(userId: string): boolean {
    return userId === String(this.authService.getCurrentUser()?.userId);
  }

  getShareLink(): string {
    if (!this.selectedFile) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/workspace/${this.projectId}?mode=collab&fileId=${this.selectedFile.id}`;
  }

  copyShareLink(): void {
    const link = this.getShareLink();
    navigator.clipboard.writeText(link).then(() => {
      this.toastService.success('Link copied to clipboard!');
    }).catch(() => {
      this.toastService.warning('Failed to copy link');
    });
  }

  autoRejoinSession(): void {
    const saved = this.collabService.getSavedSession();
    if (!saved) return;
    
    const file = this.files.find(f => f.id === saved.fileId);
    if (!file || this.collabSession) return;
    
    const user = this.authService.getCurrentUser();
    if (!user) return;
    
    if (String(user!.userId) !== saved.userId) return;
    
    this.selectedFile = file;
    
    this.collabService.connect(saved.fileId).then(() => {
      this.collabService.joinSession(saved.fileId, String(user!.userId), user!.fullName || user!.email).subscribe({
        next: (session) => {
          this.collabSession = session;
          this.collabParticipants = session.participants;
          this.isCollabOwner = session.hostUserId === String(user!.userId);
          this.chatMessages = [];
          this.setupCollabListeners();
          this.toastService.info('Rejoined previous collaboration session.');
        },
        error: () => {
          this.collabService.clearSavedSession();
        }
      });
    }).catch(() => {
      this.collabService.clearSavedSession();
    });
  }

  getSessionId(): string {
    return this.collabSession?.sessionUuid || '';
  }

  copySessionId(): void {
    const id = this.getSessionId();
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => {
      this.toastService.success('Session ID copied to clipboard!');
    }).catch(() => {
      this.toastService.warning('Failed to copy session ID');
    });
  }

  toggleChatPanel(): void {
    this.showChatPanel = !this.showChatPanel;
  }

  sendChatMessage(): void {
    if (!this.chatInput.trim() || !this.collabSession || !this.selectedFile) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.collabService.sendChat(
      this.selectedFile.id,
      String(user.userId),
      user.fullName || user.email,
      this.chatInput.trim()
    );
    this.chatInput = '';
  }

  formatChatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

