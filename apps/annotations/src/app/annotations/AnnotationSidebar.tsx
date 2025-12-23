"use client";

import React, { useState } from 'react';
import { MessageSquare, CheckCircle, MessageCircle } from 'lucide-react';
import { Annotation } from './types';

interface AnnotationSidebarProps {
  annotations: Annotation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMarkComplete: (id: string) => void;
}

export default function AnnotationSidebar({ 
  annotations, 
  selectedId, 
  onSelect, 
  onMarkComplete
}: AnnotationSidebarProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const activeAnnotations = annotations.filter(a => !a.completed);

  const handleMarkComplete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmingId === id) {
      onMarkComplete(id);
      setConfirmingId(null);
    } else {
      setConfirmingId(id);
    }
  };

  const handleCancelConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingId(null);
  };

  return (
    <aside className="w-80 border-r border-gray-200 flex flex-col bg-white h-full">
      <div className="p-6 border-b border-gray-100">
        <h1 className="text-2xl font-serif font-bold tracking-tight">Annotations</h1>
        <p className="text-xs text-gray-500 mt-1">
          {activeAnnotations.length} {activeAnnotations.length === 1 ? 'item' : 'items'} active
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeAnnotations.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">No annotations yet.</p>
            <p className="text-xs">Click and drag on the image to highlight.</p>
          </div>
        ) : (
          activeAnnotations.map((ann) => (
            <div 
              key={ann.id}
              onClick={() => onSelect(selectedId === ann.id ? null : ann.id)}
              className={`
                group relative p-4 rounded-lg border transition-all cursor-pointer
                ${selectedId === ann.id 
                  ? 'bg-gray-50 border-black ring-1 ring-black' 
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div 
                  className="mt-1 w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: ann.color.replace(/[\d.]+\)$/g, '0.8)') }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-relaxed break-words">
                    {ann.text}
                  </p>
                  {ann.replies.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                      <MessageCircle size={12} />
                      <span>{ann.replies.length} {ann.replies.length === 1 ? 'reply' : 'replies'}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Mark Complete Button */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                {confirmingId === ann.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 flex-1">Confirm?</span>
                    <button
                      onClick={handleCancelConfirm}
                      className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                    >
                      No
                    </button>
                    <button
                      onClick={(e) => handleMarkComplete(ann.id, e)}
                      className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Yes
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => handleMarkComplete(ann.id, e)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-600 transition"
                  >
                    <CheckCircle size={14} />
                    Mark Complete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
