# Collaborative AI Smart Whiteboard (CollabWhiteboard)

An enterprise-grade, real-time collaborative smart whiteboard featuring in-browser AI shape classification (trained on Google Quick, Draw!), custom spatial Quadtree indexing, presentation mode for educators, and granular role-based access control.

---

## Architecture at a Glance

- **Frontend**: React 18 + TypeScript + Vite + HTML5 Canvas 2D Engine
- **Backend**: Node.js + Express + Socket.IO + TypeScript
- **Database**: MySQL 8.0 with Prisma ORM
- **Machine Learning**: Custom CNN trained on Quick, Draw! $\rightarrow$ Exported to TensorFlow.js for client-side zero-latency inference
- **Spatial Index**: Custom Quadtree implemented from scratch for $O(\log N)$ collision and viewport culling

---

## Directory Structure

```text
collab-whiteboard/
├── client/          # React + Vite + TypeScript frontend
├── server/          # Express + Socket.IO + Prisma backend
├── ml/              # Quick, Draw! CNN training scripts & Colab notebook
└── README.md
```

---

## Getting Started (Phase 1)

### 1. Database Setup
Ensure MySQL is running on port 3306. Create the database:
```sql
CREATE DATABASE IF NOT EXISTS collab_whiteboard;
```

### 2. Backend Setup
```bash
cd server
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

### 3. Frontend Setup
```bash
cd ../client
npm install
npm run dev
```
# AI-POWERED-COLLABORATIVE-VECTOR-WHITEBOARD-WITH-REAL-TIME-SKETCH-RECOGINITION
An AI-powered collaborative smart whiteboard for real-time drawing, brainstorming, and teamwork. Features include AI-based sketch recognition using CNN, sketch-to-vector conversion, WebSocket collaboration, folder organization, board sharing, MySQL database, and Quadtree-based canvas optimization for efficient object management.
