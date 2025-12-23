import React, { useState, useRef, useEffect } from 'react';
import { X, Send, CheckCircle } from 'lucide-react';
import { Annotation } from './types';

interface AnnotationChatProps {
  annotation: Annotation;
  position: { x: number; y: number };
  onClose: () => void;
  onReply: (annotationId: string, text: string) => void;
  onMarkComplete: (annotationId:string) => void;
  onPositionChange: (position: { x: number; y: number }) => void;
  onResetPosition: () => void;
}

export default function AnnotationChat({
  annotation,
  position,
  onClose,
  onReply,
  onMarkComplete,
  onPositionChange,
  onResetPosition,
}: AnnotationChatProps) {
  const [replyText, setReplyText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent starting a drag from buttons
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      onPositionChange({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);


  const handleSendReply = () => {
    if (!replyText.trim()) return;
    onReply(annotation.id, replyText);
    setReplyText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendReply();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleConfirmComplete = () => {
    onMarkComplete(annotation.id);
    setShowConfirm(false);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      style={{ 
        position: 'absolute', 
        left: position.x, 
        top: position.y,
        maxWidth: '320px',
        minWidth: '280px',
      }}
      className="bg-white rounded-lg shadow-2xl border border-gray-200 z-30 overflow-hidden"
    >
      {/* Header */}
      <div 
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 cursor-move"
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: annotation.color.replace(/[\d.]+\)$/g, '0.8)') }}
          />
          <span className="text-xs font-medium text-gray-600">Annotation Thread</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onResetPosition}
            className="text-gray-400 hover:text-gray-600 p-1 text-xs"
            title="Reset Position"
          >
            Reset
          </button>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="max-h-[250px] overflow-y-auto p-4 space-y-3">
        {/* Original annotation */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-800 leading-relaxed">{annotation.text}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">{formatTime(annotation.timestamp)}</span>
        </div>

        {/* Replies */}
        {annotation.replies.map((reply) => (
          <div key={reply.id} className="pl-3 border-l-2 border-gray-200">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-gray-800 leading-relaxed">{reply.text}</p>
              <span className="text-[10px] text-gray-400 mt-1 block">{formatTime(reply.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Reply Input */}
      <div className="p-3 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:border-gray-400"
          />
          <button 
            onClick={handleSendReply}
            disabled={!replyText.trim()}
            className="p-2 text-gray-500 hover:text-black disabled:opacity-30"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        {!showConfirm ? (
          <button 
            onClick={() => setShowConfirm(true)}
            className="w-full flex items-center justify-center gap-2 text-sm text-green-600 hover:text-green-700 py-2 rounded hover:bg-green-50 transition"
          >
            <CheckCircle size={16} />
            Mark as Complete
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-center text-gray-600">Are you sure? This will remove the annotation.</p>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowConfirm(false)}
                className="flex-1 text-sm py-2 rounded border border-gray-200 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmComplete}
                className="flex-1 text-sm py-2 rounded bg-green-600 text-white hover:bg-green-700"
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
