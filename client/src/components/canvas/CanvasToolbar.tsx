import React, { useState } from 'react';
import { 
  MousePointer, 
  Pen, 
  Highlighter, 
  Eraser, 
  Type, 
  StickyNote, 
  Square, 
  Circle, 
  Triangle, 
  Star, 
  ArrowRight, 
  Crosshair, 
  SlidersHorizontal,
  Pencil,
  Wand2
} from 'lucide-react';
import { CanvasTool, EraserMode, ShapeType } from '../../types/canvas';

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  onSelectTool: (tool: CanvasTool) => void;
  strokeColor: string;
  onSelectColor: (color: string) => void;
  strokeWidth: number;
  onSelectWidth: (width: number) => void;
  opacity: number;
  onSelectOpacity: (opacity: number) => void;
  isPencilOnly: boolean;
  onTogglePencilOnly: () => void;
  isSmartShapes: boolean;
  onToggleSmartShapes: () => void;
  selectedShape: ShapeType;
  onSelectShape: (shape: ShapeType) => void;
  eraserMode: EraserMode;
  onSelectEraserMode: (mode: EraserMode) => void;
  eraserSize: number;
  onSelectEraserSize: (size: number) => void;
}

const PRESET_COLORS = [
  '#000000', // Black
  '#64748b', // Slate
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#ffffff', // White
];

const PRESET_WIDTHS = [2, 4, 8, 14, 24];

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  activeTool,
  onSelectTool,
  strokeColor,
  onSelectColor,
  strokeWidth,
  onSelectWidth,
  opacity,
  onSelectOpacity,
  isPencilOnly,
  onTogglePencilOnly,
  isSmartShapes,
  onToggleSmartShapes,
  selectedShape,
  onSelectShape,
  eraserMode,
  onSelectEraserMode,
  eraserSize,
  onSelectEraserSize,
}) => {  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [isShapesOpen, setIsShapesOpen] = useState(false);
  const [isEraserOpen, setIsEraserOpen] = useState(false);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 max-w-[calc(100vw-2rem)] pointer-events-auto">
      {/* Popover: Style / Color / Width / Opacity Picker */}
      {isStyleOpen && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 shadow-2xl backdrop-blur-xl w-72 mb-1 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Pen Styling
            </span>
            <button
              onClick={() => setIsStyleOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Close
            </button>
          </div>

          {/* Color Swatches */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onSelectColor(c)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-xs border ${
                    c === '#ffffff' ? 'border-gray-300 dark:border-gray-700' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {strokeColor === c && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        c === '#ffffff' || c === '#f59e0b' ? 'bg-gray-900' : 'bg-white'
                      }`}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Stroke Width */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              <span>Thickness</span>
              <span className="font-mono text-gray-500">{strokeWidth}px</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              {PRESET_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onSelectWidth(w)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${
                    strokeWidth === w
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Opacity Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span>Opacity</span>
              <span className="font-mono text-gray-500">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={opacity}
              onChange={(e) => onSelectOpacity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-600"
            />
          </div>
        </div>
      )}

      {/* Popover: Shapes Selection */}
      {isShapesOpen && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-2 shadow-2xl backdrop-blur-xl flex items-center gap-1.5 mb-1 animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => {
              onSelectShape('rectangle');
              onSelectTool('rectangle');
              setIsShapesOpen(false);
            }}
            className={`p-2 rounded-xl transition-colors ${
              selectedShape === 'rectangle' && activeTool === 'rectangle'
                ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Rectangle"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              onSelectShape('circle');
              onSelectTool('circle');
              setIsShapesOpen(false);
            }}
            className={`p-2 rounded-xl transition-colors ${
              selectedShape === 'circle' && activeTool === 'circle'
                ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Circle / Ellipse"
          >
            <Circle className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              onSelectShape('triangle');
              onSelectTool('triangle');
              setIsShapesOpen(false);
            }}
            className={`p-2 rounded-xl transition-colors ${
              selectedShape === 'triangle' && activeTool === 'triangle'
                ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Triangle"
          >
            <Triangle className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              onSelectShape('star');
              onSelectTool('star');
              setIsShapesOpen(false);
            }}
            className={`p-2 rounded-xl transition-colors ${
              selectedShape === 'star' && activeTool === 'star'
                ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Star"
          >
            <Star className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              onSelectShape('arrow');
              onSelectTool('arrow');
              setIsShapesOpen(false);
            }}
            className={`p-2 rounded-xl transition-colors ${
              selectedShape === 'arrow' && activeTool === 'arrow'
                ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Arrow"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Popover: Eraser Mode Selection (Stroke vs Precision) + Size */}
      {isEraserOpen && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 shadow-2xl backdrop-blur-xl flex flex-col gap-2 mb-1 animate-in fade-in zoom-in-95 duration-100 w-56">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-1 pt-0.5">
            Eraser Type
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectEraserMode('stroke');
              onSelectTool('eraser');
              setIsEraserOpen(false);
            }}
            className={`p-2 rounded-xl text-left text-xs font-medium flex items-center justify-between transition-colors ${
              eraserMode === 'stroke'
                ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 font-semibold'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <span>Whole Stroke</span>
            {eraserMode === 'stroke' && <span className="text-xs">✓</span>}
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectEraserMode('precision');
              onSelectTool('eraser');
              setIsEraserOpen(false);
            }}
            className={`p-2 rounded-xl text-left text-xs font-medium flex items-center justify-between transition-colors ${
              eraserMode === 'precision'
                ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 font-semibold'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <span>Precision Part</span>
            {eraserMode === 'precision' && <span className="text-xs">✓</span>}
          </button>

          {/* Eraser size slider */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2 mt-0.5">
            <div className="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <span>Eraser Size</span>
              <span className="font-mono text-gray-500">{eraserSize}px</span>
            </div>
            <input
              type="range"
              min="4"
              max="60"
              step="2"
              value={eraserSize}
              onChange={(e) => onSelectEraserSize(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>Fine</span>
              <span>Large</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Floating Pill Toolbar */}
      <div className="bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-800 rounded-full px-3 py-2 shadow-2xl backdrop-blur-md flex items-center gap-1 sm:gap-2">
        {/* Select / Move */}
        <button
          onClick={() => onSelectTool('select')}
          className={`p-2.5 rounded-full transition-all ${
            activeTool === 'select'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title="Select & Move Objects (V)"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* Freehand Pen */}
        <button
          onClick={() => onSelectTool('pen')}
          className={`p-2.5 rounded-full transition-all ${
            activeTool === 'pen'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title="Pen Tool (P)"
        >
          <Pen className="w-4 h-4" />
        </button>

        {/* Highlighter */}
        <button
          onClick={() => onSelectTool('highlighter')}
          className={`p-2.5 rounded-full transition-all ${
            activeTool === 'highlighter'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title="Highlighter (H)"
        >
          <Highlighter className="w-4 h-4" />
        </button>

        {/* Eraser with Stroke/Precision Mode indicator */}
        <button
          onClick={() => {
            if (activeTool === 'eraser') {
              setIsEraserOpen((prev) => !prev);
            } else {
              onSelectTool('eraser');
            }
            setIsStyleOpen(false);
            setIsShapesOpen(false);
          }}
          className={`p-2.5 rounded-full transition-all relative ${
            activeTool === 'eraser'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title={`Eraser (${eraserMode === 'stroke' ? 'Whole Stroke' : 'Precision'} mode) - Click again to switch mode`}
        >
          <Eraser className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 text-[9px] font-bold px-1 rounded-full bg-amber-400 text-amber-950 shadow-xs uppercase">
            {eraserMode === 'stroke' ? 'S' : 'P'}
          </span>
        </button>

        {/* Shapes Menu Button */}
        <button
          onClick={() => {
            setIsShapesOpen((prev) => !prev);
            setIsStyleOpen(false);
          }}
          className={`p-2.5 rounded-full transition-all relative ${
            ['rectangle', 'circle', 'triangle', 'star', 'arrow'].includes(activeTool)
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title="Vector Shapes"
        >
          {selectedShape === 'rectangle' && <Square className="w-4 h-4" />}
          {selectedShape === 'circle' && <Circle className="w-4 h-4" />}
          {selectedShape === 'triangle' && <Triangle className="w-4 h-4" />}
          {selectedShape === 'star' && <Star className="w-4 h-4" />}
          {selectedShape === 'arrow' && <ArrowRight className="w-4 h-4" />}
        </button>

        {/* Text */}
        <button
          onClick={() => onSelectTool('text')}
          className={`p-2.5 rounded-full transition-all ${
            activeTool === 'text'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title="Text Box (T)"
        >
          <Type className="w-4 h-4" />
        </button>

        {/* Sticky Note */}
        <button
          onClick={() => onSelectTool('sticker')}
          className={`p-2.5 rounded-full transition-all ${
            activeTool === 'sticker'
              ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title="Sticky Note (S)"
        >
          <StickyNote className="w-4 h-4" />
        </button>

        {/* Laser Pointer (Presentation Mode) */}
        <button
          onClick={() => onSelectTool('laser')}
          className={`p-2.5 rounded-full transition-all ${
            activeTool === 'laser'
              ? 'bg-red-600 text-white shadow-md shadow-red-500/30 animate-pulse'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title="Laser Pointer (L)"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />

        {/* Style / Color Trigger */}
        <button
          onClick={() => {
            setIsStyleOpen((prev) => !prev);
            setIsShapesOpen(false);
          }}
          className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1.5 transition-colors"
          title="Stroke Color & Size"
        >
          <span
            className="w-4 h-4 rounded-full shadow-inner border border-gray-300 dark:border-gray-700"
            style={{ backgroundColor: strokeColor }}
          />
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
        </button>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />

        {/* Pencil-Only Mode Toggle (Stylus-Only palm rejection) */}
        <button
          onClick={onTogglePencilOnly}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
            isPencilOnly
              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 ring-1 ring-amber-400'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title="Pencil Only Mode: When ON, touch pans/zooms and only stylus draws (Palm Rejection)"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Pencil Only</span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1 rounded-sm bg-black/10 dark:bg-white/10">
            {isPencilOnly ? 'ON' : 'OFF'}
          </span>
        </button>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />

        {/* Smart Shapes AI Recognition Toggle */}
        <button
          onClick={onToggleSmartShapes}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
            isSmartShapes
              ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-300 ring-1 ring-indigo-400'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title="Smart Shapes: Automatically converts rough freehand circles, rectangles, triangles, stars, and arrows into clean vector shapes"
        >
          <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
          <span className="hidden sm:inline">Smart Shapes</span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1 rounded-sm bg-black/10 dark:bg-white/10">
            {isSmartShapes ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>
    </div>
  );
};
