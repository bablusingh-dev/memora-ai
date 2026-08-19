'use client';

import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MindMapPayload } from '@/types/api';

interface MindMapViewerProps {
  payload: MindMapPayload;
}

const LEVEL_SPACING = 160;

/**
 * Radial tree layout, computed by hand — no layout library dependency
 * beyond React Flow itself (which only renders; it doesn't position nodes).
 * A BFS spanning tree from `rootId` gives each node a depth; each subtree is
 * allocated an angular slice proportional to its leaf count (the standard
 * "radial tidy tree" approach), so siblings with bigger subtrees get more
 * angular room and a node's children fan out around it rather than
 * overlapping. Nodes reachable via more than one edge, or not reachable at
 * all from the root, still render — just placed by whichever edge the BFS
 * saw first, or dropped to a fallback ring if unreachable.
 */
function computeRadialLayout(payload: MindMapPayload): { nodes: Node[]; edges: Edge[] } {
  const { nodes: rawNodes, edges: rawEdges, rootId } = payload;

  const childrenByParent = new Map<string, string[]>();
  for (const e of rawEdges) {
    if (!childrenByParent.has(e.source)) childrenByParent.set(e.source, []);
    childrenByParent.get(e.source)!.push(e.target);
  }

  // BFS spanning tree from root — determines each node's depth and its
  // single layout-parent, breaking any cycles/multi-parent edges for
  // positioning purposes (all original edges still render below).
  const depth = new Map<string, number>();
  const treeChildren = new Map<string, string[]>();
  const visited = new Set<string>([rootId]);
  depth.set(rootId, 0);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const kids = childrenByParent.get(current) || [];
    const unvisitedKids: string[] = [];
    for (const kid of kids) {
      if (visited.has(kid)) continue;
      visited.add(kid);
      depth.set(kid, (depth.get(current) || 0) + 1);
      unvisitedKids.push(kid);
      queue.push(kid);
    }
    if (unvisitedKids.length > 0) treeChildren.set(current, unvisitedKids);
  }

  // Leaf-count weight per node (post-order over the spanning tree), used to
  // proportion angular width among siblings.
  const weight = new Map<string, number>();
  function computeWeight(id: string): number {
    const kids = treeChildren.get(id) || [];
    const w = kids.length === 0 ? 1 : kids.reduce((sum, k) => sum + computeWeight(k), 0);
    weight.set(id, w);
    return w;
  }
  computeWeight(rootId);

  const positions = new Map<string, { x: number; y: number }>();
  positions.set(rootId, { x: 0, y: 0 });

  function assignAngles(id: string, startAngle: number, endAngle: number) {
    const kids = treeChildren.get(id) || [];
    if (kids.length === 0) return;
    const totalWeight = kids.reduce((sum, k) => sum + (weight.get(k) || 1), 0);
    let angleCursor = startAngle;
    for (const kid of kids) {
      const slice = ((weight.get(kid) || 1) / totalWeight) * (endAngle - startAngle);
      const kidAngle = angleCursor + slice / 2;
      const r = (depth.get(kid) || 1) * LEVEL_SPACING;
      positions.set(kid, { x: r * Math.cos(kidAngle), y: r * Math.sin(kidAngle) });
      assignAngles(kid, angleCursor, angleCursor + slice);
      angleCursor += slice;
    }
  }
  assignAngles(rootId, 0, 2 * Math.PI);

  // Any node the BFS never reached (disconnected from root) gets placed on
  // an outer fallback ring rather than silently dropped.
  const unreached = rawNodes.filter((n) => !positions.has(n.id));
  unreached.forEach((n, i) => {
    const r = (Math.max(...Array.from(depth.values()), 0) + 2) * LEVEL_SPACING;
    const angle = (i / Math.max(unreached.length, 1)) * 2 * Math.PI;
    positions.set(n.id, { x: r * Math.cos(angle), y: r * Math.sin(angle) });
  });

  const nodes: Node[] = rawNodes.map((n) => ({
    id: n.id,
    position: positions.get(n.id) || { x: 0, y: 0 },
    data: { label: n.label },
    style:
      n.id === rootId
        ? {
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            fontWeight: 700,
            borderRadius: 16,
            border: 'none',
            padding: '10px 16px',
            fontSize: 12,
          }
        : {
            background: 'var(--card)',
            color: 'var(--card-foreground)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '8px 12px',
            fontSize: 11,
          },
  }));

  const edges: Edge[] = rawEdges.map((e, i) => ({
    id: `e${i}-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.label,
    style: { stroke: 'var(--border)' },
    labelStyle: { fontSize: 10, fill: 'var(--muted-foreground)' },
  }));

  return { nodes, edges };
}

export function MindMapViewer({ payload }: MindMapViewerProps) {
  const { nodes, edges } = useMemo(() => computeRadialLayout(payload), [payload]);

  return (
    <div className="h-[60vh] w-full rounded-2xl overflow-hidden border border-border/50">
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.2} maxZoom={2} proOptions={{ hideAttribution: true }}>
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
