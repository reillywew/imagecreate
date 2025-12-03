export interface Point {
  x: number;
  y: number;
}

export interface RectHighlight {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface BrushStroke {
  points: Point[];
  brushSize: number;
}

export interface BrushHighlight {
  type: 'brush';
  strokes: BrushStroke[];
  opacity: number;
  color: string;
}

export type Highlight = RectHighlight | BrushHighlight;

export interface Reply {
  id: string;
  text: string;
  timestamp: number;
}

export interface Annotation {
  id: string;
  text: string;
  highlight: Highlight;
  color: string;
  timestamp: number;
  replies: Reply[];
  completed: boolean;
}
