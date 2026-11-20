export type CanvasTool = 
  | 'select' 
  | 'pen' 
  | 'highlighter' 
  | 'eraser' 
  | 'text' 
  | 'sticker' 
  | 'rectangle' 
  | 'circle' 
  | 'triangle' 
  | 'star' 
  | 'arrow' 
  | 'laser';

export type EraserMode = 'stroke' | 'precision';

export type PenType = 'normal' | 'highlighter' | 'marker';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type CanvasItemType = 
  | 'stroke' 
  | 'shape' 
  | 'text' 
  | 'sticker';

export type ShapeType = 
  | 'rectangle' 
  | 'circle' 
  | 'triangle' 
  | 'star' 
  | 'arrow';

export interface BaseCanvasItem {
  id: string;
  type: CanvasItemType;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  zIndex: number;
  selected?: boolean;
}

export interface StrokeItem extends BaseCanvasItem {
  type: 'stroke';
  points: Point[];
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  penType: PenType;
}

export interface ShapeItem extends BaseCanvasItem {
  type: 'shape';
  shapeType: ShapeType;
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  opacity: number;
  startPoint?: Point;
  endPoint?: Point;
}

export interface TextItem extends BaseCanvasItem {
  type: 'text';
  content: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  width: number;
  height: number;
}

export interface StickerItem extends BaseCanvasItem {
  type: 'sticker';
  noteText: string;
  bgColor: string;
  width: number;
  height: number;
}

export type CanvasItem = StrokeItem | ShapeItem | TextItem | StickerItem;

export interface ViewportTransform {
  panX: number;
  panY: number;
  zoom: number;
}
