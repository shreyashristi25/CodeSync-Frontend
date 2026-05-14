import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FileNode } from '../../services/file.service';

@Component({
  selector: 'app-file-tree',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './file-tree.html',
  styleUrl: './file-tree.css'
})
export class FileTreeComponent {
  @Input() nodes: FileNode[] = [];
  @Input() selectedId: number | null = null;
  @Input() selectedFolderId: number | null = null;
  @Output() fileSelected = new EventEmitter<FileNode>();
  @Output() fileRenamed = new EventEmitter<{node: FileNode, newName: string}>();
  @Output() folderSelected = new EventEmitter<FileNode>();

  readonly collapsed = new Set<number>();
  contextMenuNode: FileNode | null = null;
  contextMenuPosition = { x: 0, y: 0 };
  showContextMenu = false;
  renamingNode: FileNode | null = null;
  newName = '';

  toggle(node: FileNode): void {
    if (!node.isDirectory) {
      this.fileSelected.emit(node);
      return;
    }
    if (this.collapsed.has(node.id)) {
      this.collapsed.delete(node.id);
    } else {
      this.collapsed.add(node.id);
    }
  }

  select(node: FileNode): void {
    if (!node.isDirectory) {
      this.fileSelected.emit(node);
    } else {
      this.folderSelected.emit(node);
    }
  }

  onNodeClick(event: MouseEvent, node: FileNode): void {
    if (!node.isDirectory) {
      this.fileSelected.emit(node);
    } else {
      // Auto-expand the folder when selected
      this.collapsed.delete(node.id);
      this.folderSelected.emit(node);
    }
  }

  onArrowClick(event: MouseEvent, node: FileNode): void {
    event.stopPropagation();
    if (node.isDirectory) {
      if (this.collapsed.has(node.id)) {
        this.collapsed.delete(node.id);
      } else {
        this.collapsed.add(node.id);
      }
    }
  }

  onDoubleClick(event: MouseEvent, node: FileNode): void {
    if (node.isDirectory) {
      if (this.collapsed.has(node.id)) {
        this.collapsed.delete(node.id);
      } else {
        this.collapsed.add(node.id);
      }
    }
  }

  isCollapsed(nodeId: number): boolean {
    return this.collapsed.has(nodeId);
  }

  isFolderSelected(nodeId: number): boolean {
    return this.selectedFolderId === nodeId;
  }

  trackByNodeId(_: number, node: FileNode): number {
    return node.id;
  }

  onRightClick(event: MouseEvent, node: FileNode): void {
    event.preventDefault();
    event.stopPropagation();
    if (node.isDirectory) {
      this.folderSelected.emit(node);
    }
    this.contextMenuNode = node;
    this.contextMenuPosition = { x: event.clientX, y: event.clientY };
    this.showContextMenu = true;
  }

  closeContextMenu(): void {
    this.showContextMenu = false;
    this.contextMenuNode = null;
  }

  createFileInFolder(): void {
    if (this.contextMenuNode?.isDirectory) {
      this.folderSelected.emit(this.contextMenuNode);
    }
    this.closeContextMenu();
  }

  quickCreateFile(node: FileNode): void {
    this.folderSelected.emit(node);
  }

  quickCreateFolder(node: FileNode): void {
    this.folderSelected.emit(node);
  }

  createFolderInFolder(): void {
    if (this.contextMenuNode?.isDirectory) {
      this.folderSelected.emit(this.contextMenuNode);
    }
    this.closeContextMenu();
  }

  startRename(node: FileNode): void {
    this.closeContextMenu();
    this.renamingNode = node;
    this.newName = node.name;
  }

  commitRename(): void {
    if (this.renamingNode && this.newName.trim() && this.newName !== this.renamingNode.name) {
      this.fileRenamed.emit({ node: this.renamingNode, newName: this.newName.trim() });
    }
    this.cancelRename();
  }

  cancelRename(): void {
    this.renamingNode = null;
    this.newName = '';
  }

  onRenameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.commitRename();
    } else if (event.key === 'Escape') {
      this.cancelRename();
    }
  }
}
