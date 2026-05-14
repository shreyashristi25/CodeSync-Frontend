import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppRole = 'guest' | 'developer' | 'admin';
export type UserStatus = 'active' | 'suspended';
export type ProjectVisibility = 'PUBLIC' | 'PRIVATE';
export type ExecutionStatus = 'Success' | 'Failed' | 'Terminated';
export type CollaboratorRole = 'Viewer' | 'Editor';

export interface AppUser {
  id: number;
  name: string;
  email: string;
  role: AppRole;
  password: string;
  status: UserStatus;
  joined: string;
  bio?: string;
  avatar?: string;
}

export interface AppCollaborator {
  userId: number;
  role: CollaboratorRole;
}

export interface AppProject {
  id: number;
  name: string;
  description: string;
  ownerId: number;
  language: 'JavaScript' | 'TypeScript' | 'Python' | 'Go' | 'Rust' | 'Java' | 'C++';
  visibility: ProjectVisibility;
  updatedAt: string;
  createdAt: string;
  collaborators: AppCollaborator[];
  files?: Record<string, unknown>;
  stars?: number;
  forks?: number;
  starredBy?: number[];
  forkedFromId?: number;
}

export interface AppFile {
  id: number;
  projectId: number;
  path: string;
  name: string;
  language: string;
  content: string;
  isDirectory: boolean;
  parentId: number | null;
  updatedAt: string;
}



export interface CommitEntry {
  id: number;
  projectId: number;
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  fileChangeCount: number;
  additions: number;
  deletions: number;
  filePath: string;
  oldContent: string;
  newContent: string;
}

export interface ExecutionHistoryEntry {
  id: number;
  date: string;
  projectId: number;
  projectName: string;
  file: string;
  language: string;
  durationMs: number;
  memoryMb: number;
  status: ExecutionStatus;
  output: string;
}

const avatarChoices = ['A', 'S', 'M', 'X', 'R', 'K'];

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private userSeed: AppUser[] = [
    { id: 1, name: 'Alex Chen', email: 'alex@codesync.dev', role: 'admin', password: 'admin123', status: 'active', joined: '2025-01-15', bio: 'Platform operator', avatar: 'A' },
    { id: 2, name: 'Sarah Kim', email: 'sarah@codesync.dev', role: 'developer', password: 'dev123', status: 'active', joined: '2025-02-20', bio: 'Frontend systems', avatar: 'S' },
    { id: 3, name: 'Marcus Rivera', email: 'marcus@codesync.dev', role: 'developer', password: 'dev123', status: 'active', joined: '2025-03-10', bio: 'Realtime backend', avatar: 'M' }
  ];

  private projectSeed: AppProject[] = [
    {
      id: 9001,
      name: 'Realtime Chat Playground',
      description: 'Socket-based team chat sample with channels, typing indicators, and read receipts.',
      ownerId: 2,
      language: 'JavaScript',
      visibility: 'PUBLIC',
      createdAt: '2026-01-15T09:30:00Z',
      updatedAt: '2026-04-20T15:20:00Z',
      collaborators: [{ userId: 3, role: 'Editor' }],
      stars: 142,
      forks: 36,
      starredBy: [1, 2, 3]
    },
    {
      id: 9002,
      name: 'Kanban Sprint Board',
      description: 'Task board demo with drag and drop workflow, filters, and sprint summaries.',
      ownerId: 3,
      language: 'TypeScript',
      visibility: 'PUBLIC',
      createdAt: '2026-02-08T11:45:00Z',
      updatedAt: '2026-04-19T18:02:00Z',
      collaborators: [{ userId: 2, role: 'Viewer' }],
      stars: 89,
      forks: 14,
      starredBy: [1, 3]
    },
    {
      id: 9003,
      name: 'API Metrics Visualizer',
      description: 'Dashboard starter showing live service latency, throughput, and error trends.',
      ownerId: 2,
      language: 'Python',
      visibility: 'PRIVATE',
      createdAt: '2026-03-22T14:10:00Z',
      updatedAt: '2026-04-18T10:44:00Z',
      collaborators: [{ userId: 1, role: 'Viewer' }],
      stars: 12,
      forks: 2,
      starredBy: [2]
    }
  ];

  private readonly fileSeed: AppFile[] = this.buildFileSeed();

  private readonly executionHistorySeed: ExecutionHistoryEntry[] = [
    { id: 1, date: '2026-04-21T09:12:00Z', projectId: 9001, projectName: 'Realtime Chat Playground', file: 'app.js', language: 'JavaScript', durationMs: 1260, memoryMb: 54, status: 'Success', output: 'Server started on :3000\nConnected clients: 4\nMessage bus synced.' },
    { id: 2, date: '2026-04-20T18:44:00Z', projectId: 9002, projectName: 'Kanban Sprint Board', file: 'app.ts', language: 'TypeScript', durationMs: 1420, memoryMb: 62, status: 'Success', output: 'Board initialized\nColumns loaded: 5\nRender complete.' },
    { id: 3, date: '2026-04-20T08:02:00Z', projectId: 9003, projectName: 'API Metrics Visualizer', file: 'main.py', language: 'Python', durationMs: 1010, memoryMb: 48, status: 'Failed', output: 'Traceback: ImportError: missing module pandas' },
    { id: 4, date: '2026-04-18T14:00:00Z', projectId: 9001, projectName: 'Realtime Chat Playground', file: 'utils.js', language: 'JavaScript', durationMs: 980, memoryMb: 41, status: 'Success', output: 'Validation suite passed (18/18).' },
    { id: 5, date: '2026-04-17T17:22:00Z', projectId: 9002, projectName: 'Kanban Sprint Board', file: 'drag.ts', language: 'TypeScript', durationMs: 870, memoryMb: 39, status: 'Terminated', output: '^C Terminated' },
    { id: 6, date: '2026-04-16T13:31:00Z', projectId: 9003, projectName: 'API Metrics Visualizer', file: 'charts.py', language: 'Python', durationMs: 1640, memoryMb: 66, status: 'Success', output: 'Rendered 3 charts\nExported to reports/summary.png' },
    { id: 7, date: '2026-04-15T09:07:00Z', projectId: 9001, projectName: 'Realtime Chat Playground', file: 'app.js', language: 'JavaScript', durationMs: 1200, memoryMb: 52, status: 'Success', output: 'Socket heartbeat healthy\nQueue depth: 0' },
    { id: 8, date: '2026-04-14T11:18:00Z', projectId: 9002, projectName: 'Kanban Sprint Board', file: 'board.ts', language: 'TypeScript', durationMs: 1340, memoryMb: 58, status: 'Failed', output: 'Error: cannot read property id of undefined' },
    { id: 9, date: '2026-04-13T21:59:00Z', projectId: 9003, projectName: 'API Metrics Visualizer', file: 'data.py', language: 'Python', durationMs: 920, memoryMb: 43, status: 'Success', output: 'Loaded 30 samples\nOutliers removed: 2' },
    { id: 10, date: '2026-04-12T10:00:00Z', projectId: 9001, projectName: 'Realtime Chat Playground', file: 'index.html', language: 'JavaScript', durationMs: 760, memoryMb: 37, status: 'Success', output: 'HTML lint complete. No errors.' }
  ];



  private readonly commitSeed: CommitEntry[] = this.buildCommitSeed();

  readonly users$ = new BehaviorSubject<AppUser[]>(this.userSeed);
  readonly projects$ = new BehaviorSubject<AppProject[]>(this.projectSeed);
  readonly files$ = new BehaviorSubject<AppFile[]>(this.fileSeed);

  readonly executionHistory$ = new BehaviorSubject<ExecutionHistoryEntry[]>(this.executionHistorySeed);
  readonly commits$ = new BehaviorSubject<CommitEntry[]>(this.commitSeed);

  private currentUserInternal: AppUser | null = null;

  setCurrentUser(user: AppUser | null): void {
    this.currentUserInternal = user;
  }

  getCurrentUser(): AppUser | null {
    return this.currentUserInternal;
  }

  getUsers(): AppUser[] {
    return this.users$.value;
  }

  findUserByEmail(email: string): AppUser | undefined {
    return this.users$.value.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  validateCredentials(email: string, password: string): AppUser | null {
    const user = this.findUserByEmail(email);
    if (!user || user.password !== password || user.status !== 'active') {
      return null;
    }
    return user;
  }

  setUsers(users: AppUser[]): void {
    this.users$.next(users);
  }

  registerDeveloper(payload: { name: string; email: string; password: string }): { ok: boolean; message: string } {
    if (this.findUserByEmail(payload.email)) {
      return { ok: false, message: 'Email already exists.' };
    }
    const users = [...this.users$.value];
    const id = Math.max(...users.map((u) => u.id), 0) + 1;
    users.push({
      id,
      name: payload.name,
      email: payload.email,
      role: 'developer',
      password: payload.password,
      status: 'active',
      joined: new Date().toISOString().slice(0, 10),
      bio: '',
      avatar: avatarChoices[id % avatarChoices.length]
    });
    this.users$.next(users);
    return { ok: true, message: 'Registration successful. Please sign in.' };
  }

  getProjectsForUser(user: AppUser | null): AppProject[] {
    if (!user) {
      return this.getPublicProjects();
    }
    if (user.role === 'admin') {
      return this.projects$.value;
    }
    if (user.role === 'guest') {
      return this.getPublicProjects();
    }
    return this.projects$.value.filter((p) => p.ownerId === user.id || p.visibility === 'PUBLIC' || p.collaborators.some((c) => c.userId === user.id));
  }

  getPublicProjects(): AppProject[] {
    return this.projects$.value.filter((p) => p.visibility === 'PUBLIC');
  }

  createProject(payload: { name: string; description: string; language: 'JavaScript' | 'TypeScript' | 'Python' | 'Go' | 'Rust' | 'Java' | 'C++'; visibility: ProjectVisibility; ownerId: number }): AppProject {
    const list = [...this.projects$.value];
    const id = Math.max(...list.map((p) => p.id), 9000) + 1;
    const now = new Date().toISOString();
    const project: AppProject = {
      id,
      name: payload.name,
      description: payload.description,
      ownerId: payload.ownerId,
      language: payload.language,
      visibility: payload.visibility,
      createdAt: now,
      updatedAt: now,
      collaborators: []
    };
    this.projects$.next([project, ...list]);
    this.createStarterFiles(project);
    return project;
  }

  updateProject(projectId: number, patch: Partial<AppProject>): void {
    this.projects$.next(this.projects$.value.map((p) => (p.id === projectId ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)));
  }

  deleteProject(projectId: number): void {
    this.projects$.next(this.projects$.value.filter((p) => p.id !== projectId));
    this.files$.next(this.files$.value.filter((f) => f.projectId !== projectId));
    this.executionHistory$.next(this.executionHistory$.value.filter((h) => h.projectId !== projectId));
  }

  starProject(projectId: number, userId: number): void {
    this.projects$.next(this.projects$.value.map((p) => {
      if (p.id !== projectId) return p;
      const starredBy = p.starredBy || [];
      const hasStarred = starredBy.includes(userId);
      const nextStarredBy = hasStarred ? starredBy.filter((id) => id !== userId) : [...starredBy, userId];
      return {
        ...p,
        starredBy: nextStarredBy,
        stars: Math.max(0, (p.stars || 0) + (hasStarred ? -1 : 1))
      };
    }));
  }

  forkProject(projectId: number, newOwnerId: number): AppProject | null {
    const original = this.projects$.value.find((p) => p.id === projectId);
    if (!original) return null;
    
    this.updateProject(projectId, { forks: (original.forks || 0) + 1 });
    
    const list = [...this.projects$.value];
    const newId = Math.max(...list.map((p) => p.id), 9000) + 1;
    const now = new Date().toISOString();
    
    const forked: AppProject = {
      id: newId,
      name: `${original.name} (Fork)`,
      description: original.description,
      ownerId: newOwnerId,
      language: original.language,
      visibility: 'PRIVATE',
      createdAt: now,
      updatedAt: now,
      collaborators: [],
      stars: 0,
      forks: 0,
      starredBy: [],
      forkedFromId: original.id
    };
    
    this.projects$.next([forked, ...this.projects$.value]);
    
    let maxFileId = Math.max(...this.files$.value.map((f) => f.id), 0);
    const parentFiles = this.getFilesByProject(projectId);
    const newFiles = parentFiles.map((f) => ({
      ...f,
      id: ++maxFileId,
      projectId: newId,
      updatedAt: now
    }));
    
    this.files$.next([...this.files$.value, ...newFiles]);
    
    return forked;
  }

  isProjectForkedByUser(projectId: number, userId: number): boolean {
    return this.projects$.value.some(
      (p) => p.ownerId === userId && p.forkedFromId === projectId
    );
  }

  getFilesByProject(projectId: number): AppFile[] {
    return this.files$.value.filter((f) => f.projectId === projectId);
  }

  clearFilesForProject(projectId: number): void {
    const remaining = this.files$.value.filter(f => f.projectId !== projectId);
    this.files$.next(remaining);
  }

  getFileByPath(projectId: number, path: string): AppFile | undefined {
    return this.files$.value.find((f) => f.projectId === projectId && f.path === path);
  }

  getFileById(projectId: number, id: number): AppFile | undefined {
    return this.files$.value.find((f) => f.projectId === projectId && f.id === id);
  }

  updateFileContent(projectId: number, path: string, content: string): void {
    const now = new Date().toISOString();
    this.files$.next(this.files$.value.map((f) => (f.projectId === projectId && f.path === path ? { ...f, content, updatedAt: now } : f)));
    const project = this.projects$.value.find((p) => p.id === projectId);
    if (project) {
      this.updateProject(projectId, { updatedAt: now });
    }
  }

  renameFile(projectId: number, oldPath: string, newName: string): void {
    const file = this.getFileByPath(projectId, oldPath);
    if (!file) {
      return;
    }
    const parent = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : '';
    const newPath = parent ? `${parent}/${newName}` : newName;
    this.files$.next(this.files$.value.map((f) => (f.projectId === projectId && f.path === oldPath ? { ...f, name: newName, path: newPath } : f)));
  }

  updateFileName(projectId: number, oldPath: string, newPath: string, newName: string): void {
    const now = new Date().toISOString();
    this.files$.next(this.files$.value.map((f) => (f.projectId === projectId && f.path === oldPath ? { ...f, name: newName, path: newPath, updatedAt: now } : f)));
  }

  deleteFile(projectId: number, path: string): void {
    this.files$.next(this.files$.value.filter((f) => !(f.projectId === projectId && (f.path === path || f.path.startsWith(`${path}/`)))));
  }

  createFile(projectId: number, parentPath: string, name: string, isDirectory: boolean, parentId: number | null = null): AppFile {
    const files = this.files$.value;
    const id = Math.max(9000, ...files.map((f) => f.id)) + 1;
    const path = parentPath ? `${parentPath}/${name}` : name;
    const language = isDirectory ? 'folder' : this.inferLanguage(path);
    const file: AppFile = {
      id,
      projectId,
      path,
      name,
      isDirectory,
      language,
      content: isDirectory ? '' : '',
      parentId: parentId,
      updatedAt: new Date().toISOString()
    };
    this.files$.next([...files, file]);
    return file;
  }



  getCommits(projectId: number): CommitEntry[] {
    return this.commits$.value.filter((c) => c.projectId === projectId);
  }

  getExecutionHistory(): ExecutionHistoryEntry[] {
    return this.executionHistory$.value;
  }

  addExecution(entry: Omit<ExecutionHistoryEntry, 'id' | 'date'>): ExecutionHistoryEntry {
    const list = this.executionHistory$.value;
    const id = Math.max(...list.map((e) => e.id), 0) + 1;
    const next: ExecutionHistoryEntry = { ...entry, id, date: new Date().toISOString() };
    this.executionHistory$.next([next, ...list]);
    return next;
  }

  updateUser(userId: number, patch: Partial<AppUser>): void {
    this.users$.next(this.users$.value.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
    if (this.currentUserInternal?.id === userId) {
      this.currentUserInternal = { ...this.currentUserInternal, ...patch };
    }
  }

  deleteUser(userId: number): void {
    this.users$.next(this.users$.value.filter((u) => u.id !== userId));
    this.projects$.next(
      this.projects$.value.map((project) => ({
        ...project,
        collaborators: project.collaborators.filter((c) => c.userId !== userId)
      }))
    );
    if (this.currentUserInternal?.id === userId) {
      this.currentUserInternal = null;
    }
  }

  inviteUser(email: string, role: AppRole): AppUser {
    const users = [...this.users$.value];
    const id = Math.max(...users.map((u) => u.id), 0) + 1;
    const name = email.split('@')[0].replace(/[._-]/g, ' ');
    const user: AppUser = {
      id,
      name: name.replace(/\b\w/g, (s) => s.toUpperCase()),
      email,
      role,
      password: 'welcome123',
      status: 'active',
      joined: new Date().toISOString().slice(0, 10),
      bio: '',
      avatar: avatarChoices[id % avatarChoices.length]
    };
    this.users$.next([...users, user]);
    return user;
  }

  getProjectStats(user: AppUser | null): { myProjects: number; totalFiles: number; executions: number; collaborators: number } {
    const projects = this.getProjectsForUser(user);
    const myProjects = user ? projects.filter((p) => p.ownerId === user.id).length : 0;
    const projectIds = new Set(projects.map((p) => p.id));
    const totalFiles = this.files$.value.filter((f) => projectIds.has(f.projectId) && !f.isDirectory).length;
    const executions = this.executionHistory$.value.filter((e) => projectIds.has(e.projectId)).length;
    const collaborators = new Set<number>();
    projects.forEach((p) => p.collaborators.forEach((c) => collaborators.add(c.userId)));
    return { myProjects, totalFiles, executions, collaborators: collaborators.size };
  }

  private inferLanguage(path: string): string {
    if (path.endsWith('.ts')) return 'typescript';
    if (path.endsWith('.js')) return 'javascript';
    if (path.endsWith('.py')) return 'python';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.txt') || path.endsWith('.md')) return 'plaintext';
    return 'plaintext';
  }

  private createStarterFiles(project: AppProject): void {
    if (project.language === 'JavaScript') {
      this.createFile(project.id, '', 'index.html', false);
      this.updateFileContent(project.id, 'index.html', `<main>\n  <h1>${project.name}</h1>\n</main>\n`);
      this.createFile(project.id, '', 'app.js', false);
      this.updateFileContent(project.id, 'app.js', `const app = document.querySelector('main');\nconsole.log('workspace ready');\n`);
      return;
    }
    if (project.language === 'TypeScript') {
      this.createFile(project.id, '', 'app.ts', false);
      this.updateFileContent(project.id, 'app.ts', `export function boot() {\n  return 'ready';\n}\n`);
      return;
    }
    if (project.language === 'Python') {
      this.createFile(project.id, '', 'main.py', false);
      this.updateFileContent(project.id, 'main.py', `def main():\n    print('workspace ready')\n\nif __name__ == '__main__':\n    main()\n`);
      return;
    }
    if (project.language === 'Java') {
      this.createFile(project.id, '', 'Main.java', false);
      this.updateFileContent(project.id, 'Main.java', `public class Main {\n    public static void main(String[] args) {\n        System.out.println("workspace ready");\n    }\n}\n`);
      return;
    }
    if (project.language === 'Go') {
      this.createFile(project.id, '', 'main.go', false);
      this.updateFileContent(project.id, 'main.go', `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("workspace ready")\n}\n`);
      return;
    }
    if (project.language === 'Rust') {
      this.createFile(project.id, '', 'main.rs', false);
      this.updateFileContent(project.id, 'main.rs', `fn main() {\n    println!("workspace ready");\n}\n`);
      return;
    }
    if (project.language === 'C++') {
      this.createFile(project.id, '', 'main.cpp', false);
      this.updateFileContent(project.id, 'main.cpp', `#include <iostream>\n\nint main() {\n    std::cout << "workspace ready" << std::endl;\n    return 0;\n}\n`);
      return;
    }
    // Default to TypeScript
    this.createFile(project.id, '', 'app.ts', false);
    this.updateFileContent(project.id, 'app.ts', `export function boot() {\n  return 'ready';\n}\n`);
  }

  private buildCommitSeed(): CommitEntry[] {
    const commits: CommitEntry[] = [];
    let id = 1;
    for (const project of this.projectSeed) {
      for (let i = 0; i < 6; i += 1) {
        const hash = `${project.id.toString(16)}${(1000 + i).toString(16)}abc${i}`;
        commits.push({
          id: id++,
          projectId: project.id,
          hash,
          message: `${['refactor', 'fix', 'feat', 'chore', 'docs', 'perf'][i]}: ${project.name} update ${i + 1}`,
          author: i % 2 === 0 ? 'Sarah Kim' : 'Marcus Rivera',
          timestamp: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
          fileChangeCount: 2 + i,
          additions: 8 + i * 3,
          deletions: 2 + i,
          filePath: project.language === 'Python' ? 'main.py' : project.language === 'TypeScript' ? 'app.ts' : 'app.js',
          oldContent: `// old snapshot ${i}\nconst value = ${i};`,
          newContent: `// new snapshot ${i}\nconst value = ${i + 1};\nconsole.log(value);`
        });
      }
    }
    return commits;
  }

  private buildFileSeed(): AppFile[] {
    const now = new Date().toISOString();
    const files: AppFile[] = [];
    let id = 100;
    const push = (projectId: number, path: string, content: string, isDirectory = false): void => {
      files.push({
        id: id++,
        projectId,
        path,
        name: path.split('/').pop() || path,
        language: isDirectory ? 'folder' : this.inferLanguage(path),
        content,
        isDirectory,
        parentId: null,
        updatedAt: now
      });
    };

    push(9001, 'index.html', `<html>\n<head>\n  <title>Realtime Chat Playground</title>\n  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n  <main class="chat-shell">\n    <aside id="rooms"></aside>\n    <section>\n      <ul id="messages"></ul>\n      <form id="composer">\n        <input id="text" placeholder="Type message" />\n        <button>Send</button>\n      </form>\n    </section>\n  </main>\n  <script src="utils.js"></script>\n  <script src="app.js"></script>\n</body>\n</html>\n`);
    push(9001, 'styles.css', `.chat-shell {\n  display: grid;\n  grid-template-columns: 220px 1fr;\n  min-height: 100vh;\n}\n#messages {\n  list-style: none;\n  padding: 0;\n  margin: 0;\n}\n#composer {\n  display: flex;\n  gap: 8px;\n  padding: 12px;\n}\n.message {\n  border-bottom: 1px solid #2a2f45;\n  padding: 8px 12px;\n}\n.meta {\n  color: #8b92a8;\n  font-size: 12px;\n}\n`);
    push(9001, 'app.js', `const state = {\n  room: 'general',\n  user: 'sarah',\n  messages: []\n};\n\nconst list = document.getElementById('messages');\nconst form = document.getElementById('composer');\nconst input = document.getElementById('text');\n\nfunction render() {\n  list.innerHTML = '';\n  for (const msg of state.messages) {\n    const item = document.createElement('li');\n    item.className = 'message';\n    item.innerHTML = '<div class="meta">' + msg.user + ' · ' + msg.time + '</div>' +\n      '<div>' + escapeHtml(msg.text) + '</div>';;\n    list.appendChild(item);\n  }\n}\n\nform.addEventListener('submit', (event) => {\n  event.preventDefault();\n  if (!input.value.trim()) return;\n  state.messages.push({ user: state.user, text: input.value, time: new Date().toLocaleTimeString() });\n  input.value = '';\n  render();\n});\n\nrender();\n`);
    push(9001, 'utils.js', `function escapeHtml(value) {\n  return value\n    .replaceAll('&', '&amp;')\n    .replaceAll('<', '&lt;')\n    .replaceAll('>', '&gt;')\n    .replaceAll('"', '&quot;')\n    .replaceAll("'", '&#039;');\n}\n\nfunction formatRoom(room) {\n  return room.toUpperCase().replaceAll('-', ' ');\n}\n`);
    push(9001, 'package.json', `{\n  "name": "realtime-chat-playground",\n  "version": "1.0.0",\n  "scripts": {\n    "start": "node app.js"\n  },\n  "dependencies": {\n    "ws": "^8.17.0"\n  }\n}\n`);

    push(9002, 'index.html', `<main class="board">\n  <header>\n    <h1>Kanban Sprint Board</h1>\n    <button id="add-task">Add Task</button>\n  </header>\n  <section id="columns"></section>\n  <script type="module" src="app.ts"></script>\n</main>\n`);
    push(9002, 'styles.css', `.board {\n  min-height: 100vh;\n  padding: 16px;\n}\n#columns {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: 12px;\n}\n.column {\n  border: 1px solid #1e2130;\n  min-height: 260px;\n}\n.task {\n  border: 1px solid #2a2f45;\n  margin: 8px;\n  padding: 8px;\n}\n`);
    push(9002, 'app.ts', `import { createBoard } from './board';\nimport { enableDrag } from './drag';\n\nconst columns = createBoard(['Backlog', 'Todo', 'Doing', 'Done']);\nconst host = document.getElementById('columns')!;\n\nfor (const column of columns) {\n  host.appendChild(column.element);\n}\n\nenableDrag(host);\n`);
    push(9002, 'board.ts', `export interface BoardColumn {\n  id: string;\n  element: HTMLDivElement;\n}\n\nexport function createBoard(names: string[]): BoardColumn[] {\n  return names.map((name) => {\n    const element = document.createElement('div');\n    element.className = 'column';\n    element.dataset.column = name.toLowerCase();\n    element.innerHTML = '<h2>' + name + '</h2>';\n    return { id: name.toLowerCase(), element };\n  });\n}\n`);
    push(9002, 'drag.ts', `export function enableDrag(host: HTMLElement): void {\n  host.addEventListener('dragstart', (event) => {\n    const target = event.target as HTMLElement;\n    if (!target.classList.contains('task')) return;\n    event.dataTransfer?.setData('text/task-id', target.id);\n  });\n\n  host.addEventListener('dragover', (event) => {\n    event.preventDefault();\n  });\n\n  host.addEventListener('drop', (event) => {\n    event.preventDefault();\n    const id = event.dataTransfer?.getData('text/task-id');\n    if (!id) return;\n    const task = document.getElementById(id);\n    const column = (event.target as HTMLElement).closest('.column');\n    if (task && column) {\n      column.appendChild(task);\n    }\n  });\n}\n`);
    push(9002, 'package.json', `{\n  "name": "kanban-sprint-board",\n  "version": "1.0.0",\n  "scripts": {\n    "start": "vite"\n  },\n  "devDependencies": {\n    "typescript": "^5.4.0"\n  }\n}\n`);

    push(9003, 'main.py', `from data import load_metrics\nfrom charts import render_latency_chart\n\ndef summarize(records: list[dict]) -> dict:\n    total = len(records)\n    failures = len([r for r in records if r['status'] != 'ok'])\n    avg_ms = sum(r['latency_ms'] for r in records) / total\n    return {\n        'samples': total,\n        'failures': failures,\n        'avg_ms': round(avg_ms, 2),\n    }\n\ndef main() -> None:\n    records = load_metrics()\n    report = summarize(records)\n    print(f"samples={report['samples']}")\n    print(f"failures={report['failures']}")\n    print(f"avg_latency={report['avg_ms']}")\n    render_latency_chart(records)\n\nif __name__ == '__main__':\n    main()\n`);
    push(9003, 'charts.py', `from statistics import mean\n\ndef render_latency_chart(records: list[dict]) -> None:\n    points = [item['latency_ms'] for item in records]\n    if not points:\n        print('No data points')\n        return\n\n    baseline = mean(points)\n    print('Latency trend:')\n    for idx, value in enumerate(points, start=1):\n        mark = '#' * max(1, int(value / 10))\n        print(f"{idx:02d} {mark} {value}ms")\n\n    print(f"Baseline: {baseline:.2f}ms")\n`);
    push(9003, 'data.py', `from datetime import datetime, timedelta\n\ndef load_metrics() -> list[dict]:\n    now = datetime.utcnow()\n    statuses = ['ok', 'ok', 'ok', 'warn', 'ok', 'ok', 'ok', 'warn', 'ok', 'ok']\n    values = [82, 75, 91, 120, 88, 79, 84, 130, 90, 87]\n\n    rows = []\n    for index, value in enumerate(values):\n        rows.append({\n            'timestamp': (now - timedelta(minutes=index * 5)).isoformat(),\n            'latency_ms': value,\n            'status': statuses[index],\n        })\n\n    return rows\n`);
    push(9003, 'requirements.txt', `matplotlib==3.8.4\npandas==2.2.2\n`);

    return files;
  }
}
