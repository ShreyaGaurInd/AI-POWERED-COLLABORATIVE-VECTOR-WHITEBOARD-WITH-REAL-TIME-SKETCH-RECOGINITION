import { AABB, CanvasItem, ShapeItem, StickerItem, StrokeItem, TextItem, ViewportTransform } from '../types/canvas';
import { Quadtree } from './Quadtree';
import { drawArrow, drawStar } from './VectorMath';

export class CanvasRenderer {
  /**
   * Render background grid (dots or subtle grid lines)
   */
  public static renderGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    transform: ViewportTransform,
    isDark: boolean
  ) {
    const { panX, panY, zoom } = transform;
    const gridSize = 32 * zoom;
    const dotRadius = Math.max(1, 1.2 * zoom);

    // Calculate grid start offsets
    const startX = ((panX % gridSize) + gridSize) % gridSize;
    const startY = ((panY % gridSize) + gridSize) % gridSize;

    ctx.save();
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    for (let x = startX; x < width; x += gridSize) {
      for (let y = startY; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Main render loop with Quadtree Viewport Culling
   */
  public static renderScene(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    transform: ViewportTransform,
    quadtree: Quadtree,
    currentStroke: StrokeItem | null,
    laserPoints: { x: number; y: number; time: number }[],
    selectedItemId: string | null,
    eraserCursor: { x: number; y: number; radius: number } | null = null,
    remoteLaserTrails: Map<string, { avatarColor: string; points: { x: number; y: number; time: number }[] }> | null = null
  ) {
    const { panX, panY, zoom } = transform;

    // 1. Calculate camera viewport in Canvas World coordinates
    const viewportAABB: AABB = {
      minX: -panX / zoom - 50,
      minY: -panY / zoom - 50,
      maxX: (-panX + width) / zoom + 50,
      maxY: (-panY + height) / zoom + 50,
    };

    // 2. Query Quadtree for visible objects only (Viewport Culling: O(log N))
    const visibleItems = quadtree.queryRange(viewportAABB);

    // Sort by zIndex to respect layering
    visibleItems.sort((a, b) => a.zIndex - b.zIndex);

    // Apply Camera Matrix Transform
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // 3. Render visible canvas items
    for (const item of visibleItems) {
      this.renderItem(ctx, item, item.id === selectedItemId);
    }

    // 4. Render currently drawing stroke (in progress)
    if (currentStroke && currentStroke.points.length > 0) {
      this.renderStroke(ctx, currentStroke);
    }

    // 5. Render laser pointer trails (local and remote collaborators)
    if (laserPoints.length > 0) {
      this.renderLaserTrail(ctx, laserPoints, '#ef4444');
    }
    if (remoteLaserTrails) {
      for (const trail of remoteLaserTrails.values()) {
        if (trail.points && trail.points.length > 0) {
          this.renderLaserTrail(ctx, trail.points, trail.avatarColor || '#3b82f6');
        }
      }
    }

    // 6. Render visual eraser ring indicator
    if (eraserCursor) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(eraserCursor.x, eraserCursor.y, eraserCursor.radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Render single canvas item
   */
  public static renderItem(ctx: CanvasRenderingContext2D, item: CanvasItem, isSelected: boolean) {
    ctx.save();

    const cx = (item.minX + item.maxX) / 2;
    const cy = (item.minY + item.maxY) / 2;

    const hasTransform = Boolean(item.rotation || item.flipX || item.flipY);
    if (hasTransform) {
      ctx.translate(cx, cy);
      if (item.rotation) ctx.rotate(item.rotation);
      if (item.flipX || item.flipY) ctx.scale(item.flipX ? -1 : 1, item.flipY ? -1 : 1);
      ctx.translate(-cx, -cy);
    }

    switch (item.type) {
      case 'stroke':
        this.renderStroke(ctx, item);
        break;
      case 'shape':
        this.renderShape(ctx, item);
        break;
      case 'text':
        this.renderText(ctx, item);
        break;
      case 'sticker':
        this.renderSticker(ctx, item);
        break;
    }

    // If item is selected, render bounding box with resize anchors
    if (isSelected) {
      this.renderSelectionBounds(ctx, item);
    }

    ctx.restore();
  }

  /**
   * Render freehand stroke with pressure and opacity
   */
  private static renderStroke(ctx: CanvasRenderingContext2D, stroke: StrokeItem) {
    if (stroke.points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = stroke.strokeColor;
    ctx.lineWidth = stroke.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = stroke.opacity;

    // Highlighter mode
    if (stroke.penType === 'highlighter') {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = stroke.strokeWidth * 2.5;
    }

    const pts = stroke.points;
    if (pts.length === 1) {
      // Single tap / dot
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, stroke.strokeWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.strokeColor;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);

      // Smooth curve using midpoint quadratic beziers
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render vector shape
   */
  private static renderShape(ctx: CanvasRenderingContext2D, shape: ShapeItem) {
    const { minX, minY, maxX, maxY, shapeType, strokeColor, strokeWidth, fillColor, opacity } = shape;
    const width = maxX - minX;
    const height = maxY - minY;

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = fillColor || 'transparent';

    switch (shapeType) {
      case 'rectangle':
        ctx.beginPath();
        ctx.rect(minX, minY, width, height);
        if (fillColor) ctx.fill();
        ctx.stroke();
        break;

      case 'circle':
        ctx.beginPath();
        ctx.ellipse(minX + width / 2, minY + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
        if (fillColor) ctx.fill();
        ctx.stroke();
        break;

      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(minX + width / 2, minY);
        ctx.lineTo(maxX, maxY);
        ctx.lineTo(minX, maxY);
        ctx.closePath();
        if (fillColor) ctx.fill();
        ctx.stroke();
        break;

      case 'star':
        const cx = minX + width / 2;
        const cy = minY + height / 2;
        const outer = Math.min(width, height) / 2;
        const inner = outer * 0.45;
        drawStar(ctx, cx, cy, 5, outer, inner);
        if (fillColor) ctx.fill();
        ctx.stroke();
        break;

      case 'arrow':
        if (shape.startPoint && shape.endPoint) {
          drawArrow(ctx, shape.startPoint.x, shape.startPoint.y, shape.endPoint.x, shape.endPoint.y);
        } else {
          drawArrow(ctx, minX, minY + height / 2, maxX, minY + height / 2);
        }
        break;
    }

    ctx.restore();
  }

  /**
   * Render sticky note / sticker with realistic shadow
   */
  private static renderSticker(ctx: CanvasRenderingContext2D, sticker: StickerItem) {
    const { minX, minY, width, height, noteText, bgColor } = sticker;

    ctx.save();
    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;

    // Note background
    ctx.fillStyle = bgColor;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(minX, minY, width, height, 12);
      ctx.fill();
    } else {
      ctx.fillRect(minX, minY, width, height);
    }

    // Reset shadow for text
    ctx.shadowColor = 'transparent';

    // Note Text
    ctx.fillStyle = '#1e293b'; // Slate 800
    ctx.font = '15px Inter, sans-serif';
    ctx.textBaseline = 'top';

    // Multi-line word wrap
    const padding = 16;
    const maxWidth = width - padding * 2;
    const words = (noteText || 'Double-click to type note...').split(' ');
    let line = '';
    let y = minY + padding;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, minX + padding, y);
        line = words[n] + ' ';
        y += 22;
        if (y > minY + height - padding - 15) break; // truncate if overflowing
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, minX + padding, y);

    ctx.restore();
  }

  /**
   * Render text box
   */
  private static renderText(ctx: CanvasRenderingContext2D, textItem: TextItem) {
    const { minX, minY, content, fontFamily, fontSize, fontColor } = textItem;

    ctx.save();
    ctx.fillStyle = fontColor;
    ctx.font = `${fontSize}px ${fontFamily || 'Inter'}, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(content || 'Type here...', minX, minY);
    ctx.restore();
  }

  /**
   * Render selection bounding box and corner transform handles
   */
  private static renderSelectionBounds(ctx: CanvasRenderingContext2D, item: CanvasItem) {
    const margin = 6;
    const minX = item.minX - margin;
    const minY = item.minY - margin;
    const width = item.maxX - item.minX + margin * 2;
    const height = item.maxY - item.minY + margin * 2;

    ctx.save();
    ctx.strokeStyle = '#6366f1'; // Brand Indigo
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(minX, minY, width, height);

    // Corner transform anchors
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    const anchorSize = 8;

    const corners = [
      { x: minX, y: minY },
      { x: minX + width, y: minY },
      { x: minX, y: minY + height },
      { x: minX + width, y: minY + height },
    ];

    for (const c of corners) {
      ctx.fillRect(c.x - anchorSize / 2, c.y - anchorSize / 2, anchorSize, anchorSize);
      ctx.strokeRect(c.x - anchorSize / 2, c.y - anchorSize / 2, anchorSize, anchorSize);
    }

    // Top Rotation Stalk and Circular Knob
    const topCenterX = minX + width / 2;
    const stalkLength = 24;
    const rotKnobY = minY - stalkLength;

    // Stalk line
    ctx.beginPath();
    ctx.moveTo(topCenterX, minY);
    ctx.lineTo(topCenterX, rotKnobY);
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rotation circular knob
    ctx.beginPath();
    ctx.arc(topCenterX, rotKnobY, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center pivot dot
    ctx.beginPath();
    ctx.arc(topCenterX, rotKnobY, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#4f46e5';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Helper to parse hex string into rgb components for dynamic opacity rendering
   */
  private static hexToRgb(hex: string): { r: number; g: number; b: number } {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map((c) => c + c).join('');
    }
    const num = parseInt(clean, 16);
    if (isNaN(num)) return { r: 239, g: 68, b: 68 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  /**
   * Render continuous, liquid-smooth laser pointer trail with glowing aura
   */
  private static renderLaserTrail(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number; time: number }[],
    baseColor: string = '#ef4444'
  ) {
    if (points.length === 0) return;

    const now = Date.now();
    const lifetime = 900; // 0.9s trail duration for responsive feel

    // Filter active points within lifetime
    const activePts = points.filter((p) => now - p.time < lifetime);
    if (activePts.length === 0) return;

    const rgb = this.hexToRgb(baseColor);

    ctx.save();

    // 1. Draw connected glowing path between points
    if (activePts.length > 1) {
      for (let i = 0; i < activePts.length - 1; i++) {
        const p1 = activePts[i];
        const p2 = activePts[i + 1];
        const age = now - p2.time;
        const progress = Math.max(0, 1 - age / lifetime);

        if (progress <= 0) continue;

        // Outer Neon Glow Pass
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${progress * 0.7})`;
        ctx.lineWidth = Math.max(2, 10 * progress);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = 14 * progress;
        ctx.stroke();

        // Inner Bright Core Pass
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${progress * 0.95})`;
        ctx.lineWidth = Math.max(1.5, 3.5 * progress);
        ctx.lineCap = 'round';
        ctx.shadowBlur = 4;
        ctx.stroke();
      }
    }

    // 2. Render leading bright laser tip dot at current pointer position
    const tip = activePts[activePts.length - 1];
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 20;

    // Outer flare
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`;
    ctx.fill();

    // White core spark
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }
}
