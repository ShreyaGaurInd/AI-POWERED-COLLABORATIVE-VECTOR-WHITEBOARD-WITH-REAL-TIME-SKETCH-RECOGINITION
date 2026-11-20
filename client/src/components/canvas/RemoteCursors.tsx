/**
 * RemoteCursors — Phase 4 Live Collaboration UI
 *
 * HOW IT WORKS (Viva Explanation):
 * ─────────────────────────────────────────────────────────────────────────────
 * Each collaborator's cursor position is stored in WORLD space (the infinite
 * canvas coordinate system). To display it on screen, we apply the same
 * viewport transform used by the canvas renderer:
 *
 *   screenX = worldX * zoom + panX
 *   screenY = worldY * zoom + panY
 *
 * This ensures remote cursors stay exactly aligned with strokes regardless of
 * how much the local user has panned or zoomed.
 *
 * pointer-events: none is critical — otherwise the cursor divs would intercept
 * the user's own mouse events and break drawing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import { ViewportTransform } from '../../types/canvas';
import { RemoteCursorEntry } from '../../hooks/useSocket';

interface RemoteCursorsProps {
  remoteCursors: Map<string, RemoteCursorEntry>;
  transform: ViewportTransform;
}

export const RemoteCursors: React.FC<RemoteCursorsProps> = ({ remoteCursors, transform }) => {
  if (remoteCursors.size === 0) return null;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: 'none', zIndex: 20 }}
    >
      {Array.from(remoteCursors.entries()).map(([socketId, cursor]) => {
        // Convert world coordinates → screen coordinates using the same
        // viewport transform applied by CanvasRenderer.
        const screenX = cursor.x * transform.zoom + transform.panX;
        const screenY = cursor.y * transform.zoom + transform.panY;

        // Skip if cursor is off-screen (avoid phantom labels at edges)
        if (screenX < -40 || screenY < -40 || screenX > window.innerWidth + 40 || screenY > window.innerHeight + 40) {
          return null;
        }

        return (
          <div
            key={socketId}
            className="absolute"
            style={{
              transform: `translate(${screenX}px, ${screenY}px)`,
              transition: 'transform 0.05s linear', // Tiny interpolation for smoothness
              pointerEvents: 'none',
            }}
          >
            {/* Cursor SVG arrow */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              className="drop-shadow-sm"
              style={{ display: 'block' }}
            >
              <path
                d="M2 2 L2 16 L6 12 L10 18 L12 17 L8 11 L14 11 Z"
                fill={cursor.avatarColor || '#6366f1'}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* Name label pill below cursor */}
            <div
              className="absolute top-5 left-1 text-white text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shadow-md"
              style={{
                backgroundColor: cursor.avatarColor || '#6366f1',
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {cursor.fullName.split(' ')[0] /* Show first name only */}
            </div>
          </div>
        );
      })}
    </div>
  );
};
