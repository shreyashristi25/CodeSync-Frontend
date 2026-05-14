const fs = require('fs');

const file = 'c:/Users/Shreya Shristi/Documents/CodeSync/client/src/app/workspace/workspace.ts';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const top = lines.slice(0, 1629);

// Find setupCollabListeners
const bottomIndex = lines.findIndex(l => l.includes('private setupCollabListeners(): void {'));
if (bottomIndex === -1) {
  console.error("Could not find setupCollabListeners!");
  process.exit(1);
}

const bottom = lines.slice(bottomIndex);

const missingStr = `
  private updateOpenTabContent(path: string, content: string): void {
    this.openTabs = this.openTabs.map((tab) => (tab.path === path ? { ...tab, content } : tab));
  }

  private runByFileName(fileName: string, triggerRun: boolean): void {
    const target = this.files.find((f) => !f.isDirectory && f.name === fileName);
    if (!target) {
      this.toastService.warning(\`File \${fileName} not found in this project.\`);
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
    this.collabService.connect(fileId).then(() => {
      this.collabService.startSession(fileId, String(user.userId), user.fullName || user.email).subscribe({
        next: (session) => {
          this.collabSession = session;
          this.collabParticipants = session.participants;
          this.isCollabOwner = true;
          this.setupCollabListeners();
          this.collabService.saveSession(fileId, String(user.userId), user.fullName || user.email, this.projectId);
          this.toastService.success('Collaboration session started!');
        },
        error: (err: any) => {
          if (err.status === 400) {
            this.collabService.joinSession(fileId, String(user.userId), user.fullName || user.email).subscribe({
              next: (session) => {
                this.collabSession = session;
                this.collabParticipants = session.participants;
                this.isCollabOwner = false;
                this.setupCollabListeners();
                this.collabService.saveSession(fileId, String(user.userId), user.fullName || user.email, this.projectId);
                this.toastService.info('Joined existing collaboration session.');
              },
              error: (joinErr: any) => {
                console.error('Failed to join existing collab session:', joinErr);
                this.toastService.error('Failed to start or join collaboration.');
                this.collabService.disconnect();
              }
            });
          } else {
            console.error('Failed to start collab:', err);
            this.toastService.error('Failed to start collaboration.');
            this.collabService.disconnect();
          }
        }
      });
    }).catch((err: any) => {
      console.error('WebSocket connection failed:', err);
      this.toastService.error('Could not connect to collaboration server.');
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
    this.collabService.connect(fileId).then(() => {
      this.collabService.joinSession(fileId, String(user.userId), user.fullName || user.email).subscribe({
        next: (session) => {
          this.collabSession = session;
          this.collabParticipants = session.participants;
          this.isCollabOwner = false;
          this.setupCollabListeners();
          this.collabService.saveSession(fileId, String(user.userId), user.fullName || user.email, this.projectId);
          this.toastService.success('Joined collaboration session!');
        },
        error: (err: any) => {
          console.error('Failed to join collab:', err);
          const msg = err.error?.message || err.error?.error || 'No active session found for this file.';
          this.toastService.error(\`Could not join: \${msg}\`);
          this.collabService.disconnect();
        }
      });
    }).catch((err: any) => {
      console.error('WebSocket connection failed:', err);
      this.toastService.error('Could not connect to collaboration server.');
    });
  }

  leaveCollabSession(): void {
    if (!this.selectedFile) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const fileId = this.selectedFile.id;
    this.collabService.leaveSession(fileId, String(user.userId)).subscribe({
      next: () => {
        this.collabSession = null;
        this.collabParticipants = [];
        this.liveCursors.clear();
        this.liveCursors = new Map();
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
    this.collabService.endSession(fileId, String(user.userId), this.projectId).subscribe({
      next: () => {
        this.collabSession = null;
        this.collabParticipants = [];
        this.liveCursors.clear();
        this.liveCursors = new Map();
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
    this.collabService.kickParticipant(fileId, userId, String(user.userId)).subscribe({
      next: () => {
        this.toastService.info('Participant kicked.');
      },
      error: (err: any) => {
        console.error('Failed to kick:', err);
        this.toastService.error('Failed to kick participant.');
      }
    });
  }
`;

const missingLines = missingStr.split('\\n');
// avoid duplicate empty lines at boundary
missingLines.shift(); 
missingLines.pop();

const finalLines = [...top, ...missingLines, ...bottom];
fs.writeFileSync(file, finalLines.join('\\n'), 'utf8');
console.log('Restored file correctly!');
