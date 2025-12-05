"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Square, Brush, Eye, EyeOff } from "lucide-react";
import { Highlight, RectHighlight, BrushHighlight, BrushStroke, Point, Annotation } from "./types";

interface AnnotationEditorProps {
  annotations: Annotation[];
  onAddAnnotation: (annotation: Annotation) => void;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  panelOpen: boolean;
}

type Tool = 'select' | 'brush';

// Check if a point is near a line segment
function distanceToLineSegment(point: Point, p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSquared = dx * dx + dy * dy;
  
  if (lengthSquared === 0) {
    // p1 and p2 are the same point
    return Math.sqrt((point.x - p1.x) ** 2 + (point.y - p1.y) ** 2);
  }
  
  // Project point onto the line segment
  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  
  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;
  
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

// Check if a point is near a brush stroke (within brush radius)
function isPointNearStroke(point: Point, stroke: BrushStroke): boolean {
  const threshold = stroke.brushSize / 2 + 5; // Add small buffer for easier clicking
  
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const dist = distanceToLineSegment(point, stroke.points[i], stroke.points[i + 1]);
    if (dist <= threshold) {
      return true;
    }
  }
  return false;
}

// Check if a point is inside a rectangle
function isPointInRect(point: Point, rect: RectHighlight): boolean {
  return point.x >= rect.x && 
         point.x <= rect.x + rect.width && 
         point.y >= rect.y && 
         point.y <= rect.y + rect.height;
}

export default function AnnotationEditor({ 
  annotations, 
  onAddAnnotation, 
  selectedAnnotationId,
  onSelectAnnotation,
  panelOpen
}: AnnotationEditorProps) {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  
  // Tool state
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [brushSize, setBrushSize] = useState(20);
  const [brushOpacity, setBrushOpacity] = useState(0.4);
  
  // View state
  const [showHighlights, setShowHighlights] = useState(true);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [brushPoints, setBrushPoints] = useState<Point[]>([]);
  const [pendingStrokes, setPendingStrokes] = useState<BrushStroke[]>([]);
  
  // Annotation input
  const [showInput, setShowInput] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState<Highlight | null>(null);
  const [inputText, setInputText] = useState("");
  const [inputPosition, setInputPosition] = useState<{ x: number; y: number } | null>(null);
  const [pendingColor, setPendingColor] = useState<string | null>(null);
  
  // Popover dragging
  const [isDraggingPopover, setIsDraggingPopover] = useState(false);
  const [popoverDragOffset, setPopoverDragOffset] = useState<{ x: number; y: number } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Subtle highlight colors
  const annotationColors = [
    'rgba(255, 180, 0, 0.25)',
    'rgba(0, 200, 150, 0.25)',
    'rgba(100, 150, 255, 0.25)',
    'rgba(255, 100, 100, 0.25)',
    'rgba(180, 100, 255, 0.25)',
    'rgba(100, 220, 220, 0.25)',
  ];

  // Load hardcoded image on mount
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      console.log('Image loaded:', img.width, img.height);
      setOriginalImage(img);
    };
    img.onerror = (e) => {
      console.error('Failed to load image:', e);
    };
    img.src = '/annotation/ChatGPT Image Nov 24, 2025, 03_40_33 PM.jpeg';
  }, []);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: BrushStroke, color: string) => {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.brushSize;
    ctx.strokeStyle = color;
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }, []);

  const drawHighlight = useCallback((ctx: CanvasRenderingContext2D, highlight: Highlight, opacity?: number) => {
    if (highlight.type === 'rect') {
      const alpha = opacity ?? 0.25;
      const color = highlight.color.replace(/[\d.]+\)$/g, `${alpha})`);
      ctx.fillStyle = color;
      ctx.fillRect(highlight.x, highlight.y, highlight.width, highlight.height);
      ctx.strokeStyle = highlight.color.replace(/[\d.]+\)$/g, `${Math.min(alpha + 0.3, 1)})`);
      ctx.lineWidth = 2;
      ctx.strokeRect(highlight.x, highlight.y, highlight.width, highlight.height);
    } else if (highlight.type === 'brush') {
      const alpha = opacity ?? highlight.opacity;
      const color = highlight.color.replace(/[\d.]+\)$/g, `${alpha})`);
      for (const stroke of highlight.strokes) {
        drawStroke(ctx, stroke, color);
      }
    }
  }, [drawStroke]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !originalImage || !container) return;
    
    // Keep canvas at original image resolution
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    
    // Scale to fit container (contain behavior)
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const imgAspect = originalImage.width / originalImage.height;
    const containerAspect = containerWidth / containerHeight;
    
    let displayWidth, displayHeight;
    if (imgAspect > containerAspect) {
      // Image is wider - fit by width
      displayWidth = containerWidth;
      displayHeight = containerWidth / imgAspect;
    } else {
      // Image is taller - fit by height
      displayHeight = containerHeight;
      displayWidth = containerHeight * imgAspect;
    }
    
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalImage, 0, 0);

    // Draw saved annotations (only non-completed, and only if showHighlights is on)
    if (showHighlights) {
      annotations.filter(a => !a.completed).forEach(ann => {
        const isSelected = selectedAnnotationId === ann.id;
        
        // For rect: use stored color opacity, for brush: use stored opacity
        let opacity: number;
        if (ann.highlight.type === 'brush') {
          opacity = isSelected ? Math.min(ann.highlight.opacity + 0.2, 1) : ann.highlight.opacity;
        } else {
          opacity = isSelected ? 0.4 : 0.25;
        }
        
        // Dim non-selected when something is selected
        if (selectedAnnotationId && !isSelected) {
          opacity = 0.08;
        }

        drawHighlight(ctx, ann.highlight, opacity);
      });
    }

    // Draw pending highlight
    if (pendingHighlight) {
      drawHighlight(ctx, pendingHighlight, 0.35);
    }

    // Draw pending strokes (multi-stroke brush mode)
    if (pendingStrokes.length > 0 && pendingColor) {
      const color = pendingColor.replace(/[\d.]+\)$/g, `${brushOpacity})`);
      for (const stroke of pendingStrokes) {
        drawStroke(ctx, stroke, color);
      }
    }

    // Draw current drag preview (select tool - rectangle)
    if (activeTool === 'select' && isDrawing && dragStart && dragEnd) {
      const x = Math.min(dragStart.x, dragEnd.x);
      const y = Math.min(dragStart.y, dragEnd.y);
      const w = Math.abs(dragEnd.x - dragStart.x);
      const h = Math.abs(dragEnd.y - dragStart.y);
      
      ctx.fillStyle = 'rgba(255, 200, 0, 0.25)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    // Draw current brush stroke preview
    if (activeTool === 'brush' && brushPoints.length > 1) {
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = `rgba(255, 200, 0, ${brushOpacity})`;
      ctx.moveTo(brushPoints[0].x, brushPoints[0].y);
      for (let i = 1; i < brushPoints.length; i++) {
        ctx.lineTo(brushPoints[i].x, brushPoints[i].y);
      }
      ctx.stroke();
    }

  }, [originalImage, annotations, selectedAnnotationId, pendingHighlight, pendingStrokes, pendingColor, isDrawing, dragStart, dragEnd, activeTool, brushPoints, brushSize, brushOpacity, drawHighlight, drawStroke, showHighlights]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas, panelOpen]);

  // Resize observer for container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const observer = new ResizeObserver(() => {
      redrawCanvas();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [redrawCanvas]);

  // Focus input when shown
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === '[') setBrushSize(s => Math.max(5, s - 5));
      if (e.key === ']') setBrushSize(s => Math.min(100, s + 5));
      if (e.key === 'b' || e.key === 'B') setActiveTool('brush');
      if (e.key === 's' || e.key === 'S') setActiveTool('select');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const getScreenPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const findAnnotationAtPoint = (canvasPos: Point): Annotation | null => {
    // Check annotations in reverse order (top-most first)
    const activeAnnotations = annotations.filter(a => !a.completed).reverse();
    
    for (const ann of activeAnnotations) {
      if (ann.highlight.type === 'rect') {
        if (isPointInRect(canvasPos, ann.highlight)) {
          return ann;
        }
      } else if (ann.highlight.type === 'brush') {
        // Check if click is near any stroke path
        for (const stroke of ann.highlight.strokes) {
          if (isPointNearStroke(canvasPos, stroke)) {
            return ann;
          }
        }
      }
    }
    return null;
  };

  // Constrain popover position to stay within container bounds
  const constrainPopoverPosition = (pos: { x: number; y: number }) => {
    if (!containerRef.current) return pos;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const POPOVER_WIDTH = 256; // w-64 = 16rem = 256px
    const POPOVER_HEIGHT = 180; // Approximate height
    const PADDING = 16;
    
    let constrainedX = pos.x;
    let constrainedY = pos.y;
    
    // Keep within right edge
    if (constrainedX + POPOVER_WIDTH > containerRect.width - PADDING) {
      constrainedX = containerRect.width - POPOVER_WIDTH - PADDING;
    }
    
    // Keep within left edge
    if (constrainedX < PADDING) {
      constrainedX = PADDING;
    }
    
    // Keep within bottom edge
    if (constrainedY + POPOVER_HEIGHT > containerRect.height - PADDING) {
      constrainedY = containerRect.height - POPOVER_HEIGHT - PADDING;
    }
    
    // Keep within top edge
    if (constrainedY < PADDING) {
      constrainedY = PADDING;
    }
    
    return { x: constrainedX, y: constrainedY };
  };

  // Global mouse handlers for drawing (to handle dragging outside canvas)
  useEffect(() => {
    if (!isDrawing) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      // We need to manually calculate canvas position since the event is on window
      if (!canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      // Clamp position to canvas bounds
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      
      // Allow dragging slightly outside, but clamp for drawing data
      const x = Math.max(0, Math.min(canvas.width, rawX * scaleX));
      const y = Math.max(0, Math.min(canvas.height, rawY * scaleY));
      
      const pos = { x, y };

      if (activeTool === 'select' && dragStart) {
        setDragEnd(pos);
      } else if (activeTool === 'brush') {
        setBrushPoints(prev => [...prev, pos]);
      }
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      setIsDrawing(false);
      
      // Calculate screen pos for popover
      let screenPos = { x: 0, y: 0 };
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        screenPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }

      const nextColor = pendingColor || annotationColors[annotations.length % annotationColors.length];

      if (activeTool === 'select' && dragStart && dragEnd) {
        const x = Math.min(dragStart.x, dragEnd.x);
        const y = Math.min(dragStart.y, dragEnd.y);
        const w = Math.abs(dragEnd.x - dragStart.x);
        const h = Math.abs(dragEnd.y - dragStart.y);
        
        if (w > 10 && h > 10) {
          const highlight: RectHighlight = {
            type: 'rect',
            x, y, width: w, height: h,
            color: nextColor,
          };
          setPendingHighlight(highlight);
          setShowInput(true);
          setInputPosition(constrainPopoverPosition(screenPos));
        }
      } else if (activeTool === 'brush' && brushPoints.length > 2) {
        // Add stroke to pending strokes
        const newStroke: BrushStroke = {
          points: brushPoints,
          brushSize: brushSize,
        };
        setPendingStrokes(prev => [...prev, newStroke]);
        
        // Only open/position input on first stroke
        if (!showInput) {
          setShowInput(true);
          setInputPosition(constrainPopoverPosition(screenPos));
        } else {
          // Re-focus the input after adding a stroke
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        }
      }
      
      setDragStart(null);
      setDragEnd(null);
      setBrushPoints([]);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDrawing, activeTool, dragStart, dragEnd, brushPoints, pendingColor, annotations.length, brushSize, showInput]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    // For rect tool, don't allow drawing if input is showing
    if (showInput && activeTool === 'select') return;
    
    const canvasPos = getCanvasPos(e);
    
    // Check if clicking on an existing annotation (only if not in pending strokes mode)
    if (pendingStrokes.length === 0 && !showInput) {
      const clickedAnnotation = findAnnotationAtPoint(canvasPos);
      if (clickedAnnotation) {
        onSelectAnnotation(clickedAnnotation.id);
        return;
      }
    }
    
    // Otherwise start drawing
    setIsDrawing(true);
    onSelectAnnotation(null);

    if (activeTool === 'select') {
      setDragStart(canvasPos);
      setDragEnd(canvasPos);
    } else if (activeTool === 'brush') {
      setBrushPoints([canvasPos]);
      // Set color on first stroke
      if (pendingStrokes.length === 0) {
        setPendingColor(annotationColors[annotations.length % annotationColors.length]);
      }
    }
  };

  const handleSaveAnnotation = () => {
    let highlight: Highlight;
    
    if (pendingStrokes.length > 0 && pendingColor) {
      // Brush with multiple strokes
      highlight = {
        type: 'brush',
        strokes: pendingStrokes,
        opacity: brushOpacity,
        color: pendingColor,
      };
    } else if (pendingHighlight) {
      highlight = pendingHighlight;
    } else {
      return;
    }
    
    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      text: inputText.trim() || '', // Note is optional
      highlight: highlight,
      color: highlight.color,
      timestamp: Date.now(),
      replies: [],
      completed: false,
    };
    
    onAddAnnotation(newAnnotation);
    setPendingHighlight(null);
    setPendingStrokes([]);
    setPendingColor(null);
    setInputText("");
    setShowInput(false);
    setInputPosition(null);
  };

  const handleDiscard = () => {
    setPendingHighlight(null);
    setPendingStrokes([]);
    setPendingColor(null);
    setInputText("");
    setShowInput(false);
    setInputPosition(null);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveAnnotation();
    }
    if (e.key === 'Escape') {
      handleDiscard();
    }
  };

  // Popover drag handlers
  const handlePopoverMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only drag from the header area (not textarea or buttons)
    if ((e.target as HTMLElement).closest('textarea, button')) return;
    
    e.preventDefault();
    setIsDraggingPopover(true);
    if (inputPosition) {
      setPopoverDragOffset({
        x: e.clientX - inputPosition.x,
        y: e.clientY - inputPosition.y,
      });
    }
  };

  const handlePopoverMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingPopover || !popoverDragOffset || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = e.clientX - popoverDragOffset.x - containerRect.left;
    const newY = e.clientY - popoverDragOffset.y - containerRect.top;
    
    setInputPosition(constrainPopoverPosition({ x: newX, y: newY }));
  }, [isDraggingPopover, popoverDragOffset]);

  const handlePopoverMouseUp = useCallback(() => {
    setIsDraggingPopover(false);
    setPopoverDragOffset(null);
  }, []);

  // Global mouse events for popover dragging
  useEffect(() => {
    if (isDraggingPopover) {
      window.addEventListener('mousemove', handlePopoverMouseMove);
      window.addEventListener('mouseup', handlePopoverMouseUp);
      return () => {
        window.removeEventListener('mousemove', handlePopoverMouseMove);
        window.removeEventListener('mouseup', handlePopoverMouseUp);
      };
    }
  }, [isDraggingPopover, handlePopoverMouseMove, handlePopoverMouseUp]);

  return (
    <div className="flex flex-col h-full w-full relative bg-neutral-900">
      {/* Sleek Toolbar - vertical on right side */}
      <div className={`fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2 bg-black/80 backdrop-blur-sm rounded-full px-2 py-4 shadow-lg transition-opacity duration-200 ${isDrawing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Tool Switcher */}
        <button 
          onClick={() => setActiveTool('select')}
          className={`p-2 rounded-full transition ${activeTool === 'select' ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}
          title="Select Tool (S)"
        >
          <Square size={18} />
        </button>
        <div className="relative">
          <button 
            onClick={() => setActiveTool('brush')}
            className={`p-2 rounded-full transition ${activeTool === 'brush' ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}
            title="Brush Tool (B)"
          >
            <Brush size={18} />
          </button>
          {/* Brush Options - Animated */}
          <div className={`absolute right-full top-1/2 -translate-y-1/2 mr-3 flex flex-col items-center gap-2 bg-black/80 backdrop-blur-sm rounded-full px-2 py-4 shadow-lg transition-all duration-200 ease-in-out origin-right ${activeTool === 'brush' ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
              {/* Brush Size */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[8px] font-mono text-white/50">SIZE</span>
                <input 
                  type="range" 
                  min="5" 
                  max="100" 
                  value={brushSize} 
                  onChange={(e) => setBrushSize(Number(e.target.value))} 
                  className="w-16 accent-white -rotate-90 origin-center"
                  style={{ marginTop: '24px', marginBottom: '24px' }}
                />
                <span className="text-[10px] font-mono text-white/70">{brushSize}</span>
              </div>
              <div className="h-px w-6 bg-white/20" />
              {/* Brush Opacity */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[8px] font-mono text-white/50">OPACITY</span>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  value={brushOpacity * 100} 
                  onChange={(e) => setBrushOpacity(Number(e.target.value) / 100)} 
                  className="w-16 accent-white -rotate-90 origin-center"
                  style={{ marginTop: '24px', marginBottom: '24px' }}
                />
                <span className="text-[10px] font-mono text-white/70">{Math.round(brushOpacity * 100)}%</span>
              </div>
          </div>
        </div>

        <div className="h-px w-6 bg-white/20" />

        {/* Eye Toggle - show/hide highlights */}
        <button
          onClick={() => setShowHighlights(!showHighlights)}
          className={`p-2 rounded-full transition ${showHighlights ? 'text-white/70 hover:text-white' : 'bg-white/10 text-white'}`}
          title={showHighlights ? "Hide Highlights" : "Show Highlights"}
        >
          {showHighlights ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>

      {/* Canvas Area - Full Screen */}
      <div 
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        ref={containerRef}
      >
        {!originalImage ? (
          <div className="text-white/50 text-sm">Loading image...</div>
        ) : (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            className="cursor-crosshair"
          />
        )}

        {/* Annotation Input Popover */}
        {showInput && inputPosition && (
          <div 
            style={{ 
              position: 'absolute', 
              left: inputPosition.x, 
              top: inputPosition.y,
            }}
            className={`bg-white rounded-lg shadow-xl border border-gray-200 w-64 z-30 ${pendingStrokes.length > 0 ? 'cursor-move' : ''}`}
            onMouseDown={pendingStrokes.length > 0 ? handlePopoverMouseDown : undefined}
          >
            {/* Drag handle for brush mode */}
            {pendingStrokes.length > 0 && (
              <div className="px-4 pt-3 pb-1 border-b border-gray-100 select-none">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
                    {pendingStrokes.length} stroke{pendingStrokes.length > 1 ? 's' : ''}
                  </div>
                  <div className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                  </div>
                </div>
                <div className="text-[9px] text-gray-400 mt-0.5">drag to move · keep drawing</div>
              </div>
            )}
            <div className="p-4 pt-3">
              <textarea
                ref={inputRef}
                className="w-full border border-gray-300 rounded p-2 text-sm mb-2 min-h-[50px] resize-none"
                placeholder="Add a note (optional)..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleInputKeyDown}
              />
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-400">Enter to save</span>
                <div className="flex gap-2">
                  <button 
                    onClick={handleDiscard}
                    className="text-xs text-gray-500 hover:text-red-500 px-2 py-1"
                  >
                    Discard
                  </button>
                  <button 
                    onClick={handleSaveAnnotation}
                    className="text-xs bg-black text-white px-3 py-1 rounded hover:bg-gray-800"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

