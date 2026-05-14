import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import loader from '@monaco-editor/loader';
import type * as Monaco from 'monaco-editor';

interface LanguageOption {
  name: string;
  value: string;
}

@Component({
  selector: 'app-live-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './live-editor.html',
  styleUrl: './live-editor.css'
})
export class LiveEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() content = '';
  @Input() language = 'plaintext';
  @Input() readOnly = false;
  @Input() remoteCursors: Map<string, { line: number; column: number; color: string; name: string }> = new Map();
  @Output() contentChange = new EventEmitter<string>();
  @Output() cursorMove = new EventEmitter<{ lineNumber: number; column: number }>();
  @Output() languageChange = new EventEmitter<string>();

  @ViewChild('editorHost', { static: true }) editorHost!: ElementRef<HTMLDivElement>;

  private monacoInstance: typeof Monaco | null = null;
  private editor: Monaco.editor.IStandaloneCodeEditor | null = null;
  private suppressEmit = false;
  private findDecorations: string[] = [];
  private flashDecorations: string[] = [];
  private findRanges: Monaco.Range[] = [];
  private activeFindIndex = -1;
  private cursorDecorations: string[] = [];

  languages: LanguageOption[] = [
    { name: 'Java', value: 'java' },
    { name: 'Ruby', value: 'ruby' },
    { name: 'C++', value: 'cpp' },
    { name: 'Python', value: 'python' },
    { name: 'Go', value: 'go' },
    { name: 'JavaScript', value: 'javascript' },
    { name: 'TypeScript', value: 'typescript' },
    { name: 'C', value: 'c' },
    { name: 'Rust', value: 'rust' },
    { name: 'CSS', value: 'css' },
    { name: 'HTML', value: 'html' },
    { name: 'Plain Text', value: 'plaintext' }
  ];

  selectedLanguage = 'plaintext';

  async ngAfterViewInit(): Promise<void> {
    this.selectedLanguage = this.language || 'plaintext';
    this.monacoInstance = await loader.init();
    this.monacoInstance.editor.defineTheme('codesync-terminal', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '5c7791' },
        { token: 'keyword', foreground: '38c8ff' },
        { token: 'string', foreground: '6de09b' },
        { token: 'number', foreground: 'ffb86c' }
      ],
      colors: {
        'editor.background': '#071018',
        'editor.foreground': '#cfe6ff',
        'editor.lineHighlightBackground': '#0d1e2b',
        'editorCursor.foreground': '#2bc3ff',
        'editor.selectionBackground': '#1d3e58',
        'editorGutter.background': '#071018',
        'editorLineNumber.foreground': '#44617d'
      }
    });

    this.editor = this.monacoInstance.editor.create(this.editorHost.nativeElement, {
      value: this.content ?? '',
      language: this.language || 'plaintext',
      theme: 'codesync-terminal',
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily: 'Consolas, Courier New, monospace',
      fontSize: 14,
      smoothScrolling: true,
      scrollBeyondLastLine: false,
      readOnly: this.readOnly
    });

    if (this.editor) {
      this.editor.setValue(this.content ?? '');
    }

    this.editor.onDidChangeModelContent(() => {
      if (this.suppressEmit || !this.editor) {
        return;
      }
      this.contentChange.emit(this.editor.getValue());
    });

    this.editor.onDidChangeCursorPosition((event) => {
      this.cursorMove.emit({
        lineNumber: event.position.lineNumber,
        column: event.position.column
      });
    });

    this.editor.onKeyDown((event) => {
      if (this.readOnly) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.keyCode === this.monacoInstance!.KeyCode.KeyV) {
        if (!navigator.clipboard?.readText) {
          return;
        }

        event.preventDefault();
        navigator.clipboard.readText().then((text) => {
          if (!text || !this.editor) {
            return;
          }

          const selection = this.editor.getSelection();
          if (!selection) {
            return;
          }

          this.editor.executeEdits('clipboard', [{
            range: selection,
            text,
            forceMoveMarkers: true
          }]);
        }).catch(() => {
        });
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content'] && this.editor) {
      const next = this.content ?? '';
      if (next !== this.editor.getValue()) {
        this.suppressEmit = true;
        this.editor.setValue(next);
        this.suppressEmit = false;
      }
    }

    if (changes['language'] && this.editor?.getModel() && this.monacoInstance) {
      this.monacoInstance.editor.setModelLanguage(this.editor.getModel()!, this.language || 'plaintext');
      this.selectedLanguage = this.language || 'plaintext';
    }

    if (changes['readOnly'] && this.editor) {
      this.editor.updateOptions({ readOnly: this.readOnly });
    }

    if (changes['remoteCursors'] && this.editor && this.monacoInstance) {
      this.updateRemoteCursors();
    }
  }

  private updateRemoteCursors(): void {
    if (!this.editor || !this.monacoInstance) return;

    const decorations: Monaco.editor.IModelDeltaDecoration[] = [];
    
    this.remoteCursors.forEach((cursor, userId) => {
      decorations.push({
        range: new this.monacoInstance!.Range(cursor.line, cursor.column, cursor.line, cursor.column + 1),
        options: {
          className: 'remote-cursor',
          beforeContentClassName: 'remote-cursor-' + userId,
          hoverMessage: { value: cursor.name },
          stickiness: 1
        }
      });
      
      decorations.push({
        range: new this.monacoInstance!.Range(cursor.line, 1, cursor.line, 1),
        options: {
          className: 'remote-cursor-label',
          beforeContentClassName: 'remote-cursor-label-' + userId,
          stickiness: 1
        }
      });
    });

    this.cursorDecorations = this.editor.deltaDecorations(this.cursorDecorations, decorations);
  }

  ngOnDestroy(): void {
    this.editor?.dispose();
  }

  onLanguageChange(): void {
    if (this.selectedLanguage && this.editor?.getModel() && this.monacoInstance) {
      this.monacoInstance.editor.setModelLanguage(this.editor.getModel()!, this.selectedLanguage);
      this.languageChange.emit(this.selectedLanguage);
    }
  }

  getSelectionInfo(): { startLine: number; endLine: number; startColumn: number; endColumn: number; text: string; hasSelection: boolean } | null {
    if (!this.editor) {
      return null;
    }
    const selection = this.editor.getSelection();
    const model = this.editor.getModel();
    if (!selection || !model) {
      return null;
    }
    return {
      startLine: selection.startLineNumber,
      endLine: selection.endLineNumber,
      startColumn: selection.startColumn,
      endColumn: selection.endColumn,
      text: model.getValueInRange(selection),
      hasSelection: !selection.isEmpty()
    };
  }

  revealLine(line: number): void {
    if (!this.editor) return;
    this.editor.revealLineInCenter(line);
    this.editor.setPosition({ lineNumber: line, column: 1 });
    this.editor.focus();
  }

  flashLineRange(startLine: number, endLine: number, durationMs = 2000): void {
    if (!this.editor || !this.monacoInstance) return;
    this.flashDecorations = this.editor.deltaDecorations(this.flashDecorations, [
      {
        range: new this.monacoInstance.Range(startLine, 1, endLine, 1),
        options: { isWholeLine: true, className: 'cs-line-flash' }
      }
    ]);
    setTimeout(() => {
      if (!this.editor) return;
      this.flashDecorations = this.editor.deltaDecorations(this.flashDecorations, []);
    }, durationMs);
  }

  setFindQuery(query: string): { count: number; activeIndex: number } {
    if (!this.editor || !this.monacoInstance) {
      return { count: 0, activeIndex: -1 };
    }
    const model = this.editor.getModel();
    if (!model || !query) {
      this.clearFind();
      return { count: 0, activeIndex: -1 };
    }

    this.findRanges = model.findMatches(query, true, false, false, null, true).map((m) => m.range);
    this.findDecorations = this.editor.deltaDecorations(
      this.findDecorations,
      this.findRanges.map((range, index) => ({
        range,
        options: {
          className: index === 0 ? 'cs-find-match-active' : 'cs-find-match'
        }
      }))
    );

    if (this.findRanges.length > 0) {
      this.activeFindIndex = 0;
      const active = this.findRanges[0];
      this.editor.revealRangeInCenter(active);
      this.editor.setSelection(active);
      this.editor.focus();
    } else {
      this.activeFindIndex = -1;
    }
    return { count: this.findRanges.length, activeIndex: this.activeFindIndex };
  }

  moveFind(direction: 'next' | 'prev'): { count: number; activeIndex: number } {
    if (!this.editor || !this.monacoInstance || this.findRanges.length === 0) {
      return { count: this.findRanges.length, activeIndex: -1 };
    }
    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = (this.activeFindIndex + delta + this.findRanges.length) % this.findRanges.length;
    this.activeFindIndex = nextIndex;

    const active = this.findRanges[this.activeFindIndex];
    this.editor.revealRangeInCenter(active);
    this.editor.setSelection(active);
    this.editor.focus();

    this.findDecorations = this.editor.deltaDecorations(
      this.findDecorations,
      this.findRanges.map((range, index) => ({
        range,
        options: {
          className: index === this.activeFindIndex ? 'cs-find-match-active' : 'cs-find-match'
        }
      }))
    );
    return { count: this.findRanges.length, activeIndex: this.activeFindIndex };
  }

  clearFind(): void {
    if (!this.editor) return;
    this.findDecorations = this.editor.deltaDecorations(this.findDecorations, []);
    this.findRanges = [];
    this.activeFindIndex = -1;
  }
}
