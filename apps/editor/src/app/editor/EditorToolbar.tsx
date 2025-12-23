"use client";

import React from 'react';
import { Download, FolderOpen } from 'lucide-react';
import styles from './EditorToolbar.module.css';

interface EditorToolbarProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  onOpenClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportPng: () => void;
}

export default function EditorToolbar({
  fileInputRef,
  onOpenClick,
  onFileChange,
  onExportPng,
}: EditorToolbarProps) {
  return (
    <header className={styles.toolbar}>
      <div className={styles.left} />

      <div className={styles.actions}>
        <button
          type="button"
          onClick={onOpenClick}
          className={styles.button}
        >
          <FolderOpen size={14} />
          Open
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.psd,.ai,.pdf,.svg"
          onChange={onFileChange}
          className={styles.fileInput}
        />

        <div className={styles.divider} />

        <button
          type="button"
          onClick={onExportPng}
          className={styles.primaryButton}
        >
          <Download size={14} />
          Export PNG
        </button>
      </div>
    </header>
  );
}
