import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Comment, CommentService } from '../../services/comment.service';
import { AuthService } from '../../auth';

@Component({
  selector: 'app-inline-comment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="inline-comment-widget">
      <div class="comment-thread">
        <div *ngFor="let comment of comments" class="comment-item" [class.resolved]="comment.resolved">
          <div class="comment-header">
            <span class="author-id">{{ getAuthorName(comment.authorId) }}</span>
            <span class="timestamp">{{ formatDate(comment.createdAt) }}</span>
          </div>
          <div class="comment-content">{{ comment.content }}</div>
          <div class="comment-actions">
            <button *ngIf="canResolve(comment)" (click)="onResolve(comment)" class="action-btn">
              {{ comment.resolved ? 'Unresolve' : 'Resolve' }}
            </button>
            <button *ngIf="canDelete(comment)" (click)="onDelete(comment)" class="action-btn delete">
              Delete
            </button>
          </div>
        </div>
      </div>

      <div class="comment-input" *ngIf="!showReplies && !newCommentExpanded">
        <button (click)="expandNewComment()" class="comment-trigger">+ Add comment</button>
      </div>

      <div class="comment-input" *ngIf="newCommentExpanded">
        <textarea 
          [(ngModel)]="newCommentText" 
          placeholder="Add a comment..."
          class="comment-textarea">
        </textarea>
        <div class="comment-actions">
          <button (click)="submitComment()" class="submit-btn">Comment</button>
          <button (click)="cancelComment()" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .inline-comment-widget {
      background: var(--tui-bg, #090d11);
      border: 1px solid var(--tui-border, #1a1f2e);
      border-radius: 6px;
      padding: 12px;
      margin: 8px 0;
      font-family: 'Monaco', monospace;
      font-size: 12px;
    }

    .comment-thread {
      margin-bottom: 12px;
    }

    .comment-item {
      background: var(--tui-hover, #0f1419);
      border-left: 3px solid var(--tui-accent, #2bc3ff);
      padding: 10px;
      margin-bottom: 8px;
      border-radius: 3px;
    }

    .comment-item.resolved {
      opacity: 0.6;
      border-left-color: var(--tui-muted, #7a8a99);
      text-decoration: line-through;
    }

    .comment-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 11px;
    }

    .author-id {
      color: var(--tui-accent, #2bc3ff);
      font-weight: 600;
    }

    .timestamp {
      color: var(--tui-muted, #7a8a99);
    }

    .comment-content {
      color: var(--tui-text, #cde6ff);
      margin-bottom: 8px;
      word-break: break-word;
    }

    .comment-actions {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      background: var(--tui-accent, #2bc3ff);
      color: var(--tui-bg, #090d11);
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
    }

    .action-btn:hover {
      opacity: 0.8;
    }

    .action-btn.delete {
      background: #ff4444;
    }

    .comment-trigger {
      background: none;
      border: none;
      color: var(--tui-accent, #2bc3ff);
      cursor: pointer;
      font-size: 12px;
      padding: 0;
    }

    .comment-trigger:hover {
      text-decoration: underline;
    }

    .comment-input {
      margin-top: 8px;
    }

    .comment-textarea {
      width: 100%;
      min-height: 60px;
      padding: 8px;
      background: var(--tui-hover, #0f1419);
      border: 1px solid var(--tui-border, #1a1f2e);
      color: var(--tui-text, #cde6ff);
      border-radius: 3px;
      font-family: 'Monaco', monospace;
      font-size: 12px;
      resize: vertical;
    }

    .submit-btn {
      background: var(--tui-accent, #2bc3ff);
      color: var(--tui-bg, #090d11);
      border: none;
      padding: 6px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-weight: 600;
      margin-top: 8px;
      margin-right: 8px;
    }

    .submit-btn:hover {
      opacity: 0.8;
    }

    .cancel-btn {
      background: var(--tui-border, #1a1f2e);
      color: var(--tui-text, #cde6ff);
      border: none;
      padding: 6px 12px;
      border-radius: 3px;
      cursor: pointer;
      margin-top: 8px;
    }

    .cancel-btn:hover {
      opacity: 0.8;
    }
  `]
})
export class InlineCommentComponent implements OnInit {
  @Input() fileId!: number;
  @Input() lineNumber!: number;
  @Output() commentAdded = new EventEmitter<Comment>();

  comments: Comment[] = [];
  newCommentText = '';
  newCommentExpanded = false;
  showReplies = false;
  currentUserId = 0;
  currentUserName = '';

  constructor(
    private commentService: CommentService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUserId = user.userId;
      this.currentUserName = user.fullName || user.email || 'User';
    }
    this.loadComments();
  }

  getAuthorName(authorId: number): string {
    if (authorId === this.currentUserId) {
      return this.currentUserName || 'You';
    }
    return 'User ' + authorId;
  }

  loadComments(): void {
    this.commentService.getCommentsByFileAndLine(this.fileId, this.lineNumber)
      .subscribe({
        next: (comments) => {
          this.comments = comments;
        },
        error: (error) => {
          console.error('Error loading comments:', error);
        }
      });
  }

  expandNewComment(): void {
    this.newCommentExpanded = true;
  }

  cancelComment(): void {
    this.newCommentExpanded = false;
    this.newCommentText = '';
  }

  submitComment(): void {
    if (!this.newCommentText.trim()) return;

    const request = {
      fileId: this.fileId,
      lineNumber: this.lineNumber,
      content: this.newCommentText,
      authorId: this.currentUserId
    };

    this.commentService.createComment(request)
      .subscribe({
        next: (comment) => {
          this.comments.push(comment);
          this.commentAdded.emit(comment);
          this.newCommentText = '';
          this.newCommentExpanded = false;
        },
        error: (error) => {
          console.error('Error creating comment:', error);
        }
      });
  }

  onResolve(comment: Comment): void {
    this.commentService.resolveComment(comment.id)
      .subscribe({
        next: (updated) => {
          const index = this.comments.findIndex(c => c.id === comment.id);
          if (index >= 0) {
            this.comments[index] = updated;
          }
        },
        error: (error) => {
          console.error('Error resolving comment:', error);
        }
      });
  }

  onDelete(comment: Comment): void {
    this.commentService.deleteComment(comment.id, this.currentUserId)
      .subscribe({
        next: () => {
          this.comments = this.comments.filter(c => c.id !== comment.id);
        },
        error: (error) => {
          console.error('Error deleting comment:', error);
        }
      });
  }

  canResolve(comment: Comment): boolean {
    return true;
  }

  canDelete(comment: Comment): boolean {
    return comment.authorId === this.currentUserId;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
