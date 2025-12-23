"use client";

import React from 'react';
import styles from './AnnotationsPanelHeader.module.css';

interface AnnotationsPanelHeaderProps {
  activeCount: number;
}

export default function AnnotationsPanelHeader({ activeCount }: AnnotationsPanelHeaderProps) {
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>Comments</h2>
      <p className={styles.subtitle}>
        {activeCount} {activeCount === 1 ? 'item' : 'items'}
      </p>
    </div>
  );
}
