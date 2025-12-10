"use client";

import React, { useState, useEffect, useRef } from 'react';
import AnnotationEditor from './AnnotationEditor';
import AnnotationChat from './AnnotationChat';
import { Annotation, Reply } from './types';
// localStorage key for persistence
const ANNOTATIONS_STORAGE_KEY = 'annotation-tool-data';
import { ChevronRight, ChevronLeft, MessageSquare, CheckCircle, MessageCircle, RefreshCw } from 'lucide-react';

export default function AnnotationsPage() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatPosition, setChatPosition] = useState<{ x: number; y: number } | null>(null);
  const [customChatPositions, setCustomChatPositions] = useState<Record<string, { x: number, y: number }>>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [viewTick, setViewTick] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);

  const selectedAnnotation = annotations.find(a => a.id === selectedId && !a.completed);
  const activeAnnotations = annotations.filter(a => !a.completed);

  // Load annotations from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ANNOTATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setAnnotations(parsed);
        }
      }
    } catch (err) {
      console.error("Failed to load annotations from localStorage:", err);
    }
  }, []);

  const handleAddAnnotation = React.useCallback((newAnnotation: Annotation) => {
    setAnnotations(prev => [...prev, newAnnotation]);
  }, []);

  const handleClearAnnotations = React.useCallback(() => {
    setAnnotations([]);
  }, []);

  const handleMarkComplete = (id: string) => {
    setAnnotations(prev => prev.map(a =>
      a.id === id ? { ...a, completed: true } : a
    ));
    if (selectedId === id) setSelectedId(null);
    setConfirmingId(null);
  };

  const handleReply = (annotationId: string, text: string) => {
    const newReply: Reply = {
      id: Date.now().toString(),
      text,
      timestamp: Date.now(),
    };
    setAnnotations(prev => prev.map(a =>
      a.id === annotationId
        ? { ...a, replies: [...a.replies, newReply] }
        : a
    ));
  };
  
  const handleChatPositionChange = (id: string, position: { x: number, y: number }) => {
    setCustomChatPositions(prev => ({ ...prev, [id]: position }));
  };

  const handleResetChatPosition = (id: string) => {
    setCustomChatPositions(prev => {
      const newPositions = { ...prev };
      delete newPositions[id];
      return newPositions;
    });
    // Force recalculation of position
    setSelectedId(null);
    setTimeout(() => setSelectedId(id), 0);
  };

  // Auto-save to localStorage whenever annotations change
  useEffect(() => {
    // Skip initial empty state (wait for localStorage load)
    if (annotations.length === 0) {
      const stored = localStorage.getItem(ANNOTATIONS_STORAGE_KEY);
      if (stored && stored !== '[]') return;
    }
    try {
      localStorage.setItem(ANNOTATIONS_STORAGE_KEY, JSON.stringify(annotations));
    } catch (err) {
      console.error("Auto-save failed:", err);
    }
  }, [annotations]);

  // Calculate chat position based on selected annotation's highlight
  useEffect(() => {
    if (selectedAnnotation) {
      // If a custom position exists, use it.
      if (customChatPositions[selectedAnnotation.id]) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChatPosition(customChatPositions[selectedAnnotation.id]);
        return;
      }
      
      // Otherwise, calculate the initial position.
      if (editorRef.current) {
        const canvas = editorRef.current.querySelector('canvas');
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const containerRect = editorRef.current.getBoundingClientRect();

          const scaleX = rect.width / canvas.width;
          const scaleY = rect.height / canvas.height;

          let minX = 0, maxX = 0, minY = 0, maxY = 0;

          if (selectedAnnotation.highlight.type === 'rect') {
            const { x, y, width, height } = selectedAnnotation.highlight;
            minX = x;
            maxX = x + width;
            minY = y;
            maxY = y + height;
          } else {
            // Brush with multiple strokes
            minX = Infinity; maxX = -Infinity;
            minY = Infinity; maxY = -Infinity;

            for (const stroke of selectedAnnotation.highlight.strokes) {
              const halfSize = stroke.brushSize / 2;
              for (const p of stroke.points) {
                if (p.x - halfSize < minX) minX = p.x - halfSize;
                if (p.x + halfSize > maxX) maxX = p.x + halfSize;
                if (p.y - halfSize < minY) minY = p.y - halfSize;
                if (p.y + halfSize > maxY) maxY = p.y + halfSize;
              }
            }
          }

          const canvasOffsetX = rect.left - containerRect.left;
          const canvasOffsetY = rect.top - containerRect.top;

          const screenMaxX = (maxX * scaleX) + canvasOffsetX;
          const screenMinX = (minX * scaleX) + canvasOffsetX;
          const screenMinY = (minY * scaleY) + canvasOffsetY;

          const CHAT_WIDTH = 320;
          const GAP = 20;

          let finalX = screenMaxX + GAP;

          if (finalX + CHAT_WIDTH > containerRect.width) {
            finalX = screenMinX - CHAT_WIDTH - GAP;
          }

          if (finalX < 20) finalX = 20;

          let finalY = screenMinY;
          finalY = Math.max(20, Math.min(finalY, containerRect.height - 300));

          setChatPosition({
            x: finalX,
            y: finalY,
          });
        }
      }
    } else {
      setChatPosition(null);
    }
  }, [selectedAnnotation, customChatPositions, panelOpen, viewTick]);

  const handleViewChange = React.useCallback(() => {
    setViewTick(t => t + 1);
  }, []);

  return (
    <div className="flex h-screen w-full bg-neutral-900 overflow-hidden">
      {/* Left Slide-out Panel */}
      <div
        className={`absolute left-0 top-0 h-full z-30 flex transition-transform duration-300 ease-in-out ${panelOpen ? 'translate-x-0' : '-translate-x-80'}`}
      >
        {/* Panel Content */}
        <div className="w-80 bg-white h-full flex flex-col shadow-2xl">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Comments</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {activeAnnotations.length} {activeAnnotations.length === 1 ? 'item' : 'items'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activeAnnotations.length === 0 ? (
              <div className="text-center text-gray-400 py-10">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">No comments yet</p>
              </div>
            ) : (
              activeAnnotations.map((ann) => (
                <div
                  key={ann.id}
                  onClick={() => {
                    setSelectedId(selectedId === ann.id ? null : ann.id);
                  }}
                  className={`
                    group relative p-3 rounded-lg border transition-all cursor-pointer text-sm
                    ${selectedId === ann.id
                      ? 'bg-gray-50 border-black'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ann.color.replace(/[\d.]+\)$/g, '0.8)') }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 leading-relaxed break-words line-clamp-2">
                        {ann.text}
                      </p>
                      {ann.replies.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
                          <MessageCircle size={10} />
                          <span>{ann.replies.length}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mark Complete */}
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    {confirmingId === ann.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 flex-1">Confirm?</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmingId(null); }}
                          className="text-[10px] px-2 py-0.5 text-gray-500"
                        >
                          No
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkComplete(ann.id); }}
                          className="text-[10px] px-2 py-0.5 bg-green-600 text-white rounded"
                        >
                          Yes
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmingId(ann.id); }}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-green-600"
                      >
                        <CheckCircle size={12} />
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tab/Button to toggle panel */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="h-12 w-6 bg-white shadow-lg rounded-r-lg flex items-center justify-center self-center -mr-px hover:bg-gray-50 transition"
        >
          {panelOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Main Content - Editor takes full space, shrinks when panel open */}
      <div
        ref={editorRef}
        className={`flex-1 h-full relative transition-all duration-300 ease-in-out ${panelOpen ? 'ml-80' : 'ml-0'}`}
      >
        <AnnotationEditor
          annotations={annotations}
          onAddAnnotation={handleAddAnnotation}
          onClearAnnotations={handleClearAnnotations}
          selectedAnnotationId={selectedId}
          onSelectAnnotation={setSelectedId}
          panelOpen={panelOpen}
          onViewChange={handleViewChange}
        />

        {/* Floating Chat */}
        {selectedAnnotation && chatPosition && (
          <AnnotationChat
            annotation={selectedAnnotation}
            position={chatPosition}
            onClose={() => setSelectedId(null)}
            onReply={handleReply}
            onMarkComplete={handleMarkComplete}
            onPositionChange={(newPos) => handleChatPositionChange(selectedAnnotation.id, newPos)}
            onResetPosition={() => handleResetChatPosition(selectedAnnotation.id)}
          />
        )}
      </div>
    </div>
  );
}
