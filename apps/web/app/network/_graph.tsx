'use client';
// Browser-only interactive force-directed graph wrapper around react-force-graph-2d.
// Lazy-loaded (ssr:false) because it depends on canvas/zoom/d3 which require a DOM.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import {
  GGraph,
  GNode,
  PATH_COLOR,
  edgeStrokeColor,
  edgeStrokeWidth,
  edgeDisplayLabel,
  nodeColor,
  nodeDisplayName,
  drawNode,
} from './_nodes';

export interface NetworkGraphHandle {
  fit: () => void;
  reset: () => void;
  zoomBy: (factor: number) => void;
}

export interface NetworkGraphProps {
  graph: GGraph;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  focusNodeId?: string | null;
  // Path highlight (organization path). When a path is set, non-path content is dimmed.
  pathNodeIds?: Set<string> | null;
  pathEdgeIds?: Set<string> | null;
  // Analytics-inferred highlight set (e.g. top centrality connectors).
  analysisNodeIds?: Set<string> | null;
  dimOthers?: boolean;
  onNodeSelect?: (node: GNode | null) => void;
  onNodeHover?: (node: GNode | null) => void;
  onEdgeSelect?: (edge: GNode['id'] | null) => void;
  onEdgeHover?: (edgeLabel: string | null) => void;
  onRendered?: (counts: { nodes: number; edges: number }) => void;
}

// react-force-graph-2d works with nodes + links; our backend model uses nodes + edges.
const LINK_SOURCE = 'source';
const LINK_TARGET = 'target';

const NetworkGraph = forwardRef<NetworkGraphHandle, NetworkGraphProps>(function NetworkGraph(
  {
    graph,
    selectedNodeId,
    selectedEdgeId,
    focusNodeId,
    pathNodeIds,
    pathEdgeIds,
    analysisNodeIds,
    dimOthers = false,
    onNodeSelect,
    onNodeHover,
    onEdgeSelect,
    onEdgeHover,
    onRendered,
  },
  ref,
) {
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const lastRendered = useRef({ nodes: 0, edges: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(760);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth || 760);
    return () => ro.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    fit: () => {
      const g = graphRef.current;
      if (g && typeof g.zoomToFit === 'function') graphRef.current?.zoomToFit(600, 48);
    },
    reset: () => {
      const g = graphRef.current;
      if (g && typeof g.zoom === 'function') {
        g.zoom(1, 500);
        if (typeof g.centerAt === 'function') g.centerAt(0, 0, 500);
      }
    },
    zoomBy: (factor: number) => {
      const g = graphRef.current;
      if (g && typeof g.zoom === 'function') {
        const current = (g as any).zoom?.() ?? 1;
        g.zoom(Math.min(8, Math.max(0.25, current * factor)), 300);
      }
    },
  }));

  const { nodes, links } = useMemo(() => {
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    // Never independently slice nodes and edges: keep the full payload and drop only
    // links whose endpoints are absent (surface the count via onRendered).
    const safeLinks = graph.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ ...e }));
    const dropped = graph.edges.length - safeLinks.length;
    const counts = { nodes: graph.nodes.length, edges: safeLinks.length };
    if (dropped > 0 && lastRendered.current.edges !== counts.edges) {
      console.warn(`[network] dropped ${dropped} orphan edges (endpoints outside node set)`);
    }
    lastRendered.current = counts;
    if (onRendered) onRendered(counts);
    return { nodes: graph.nodes, links: safeLinks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // When a path is active, only the path is emphasized and everything else is dimmed.
  const pathActive = Boolean(pathNodeIds && pathNodeIds.size > 0);

  const nodeAlpha = (id: string): number => {
    if (pathActive) return pathNodeIds?.has(id) ? 1 : 0.14;
    const sel = selectedNodeId;
    if (dimOthers && sel != null && sel !== id) return 0.3;
    return 1;
  };

  const nodeAccent = (id: string): string | null => {
    if (pathNodeIds?.has(id)) return PATH_COLOR;
    if (analysisNodeIds?.has(id)) return PATH_COLOR;
    return null;
  };

  const linkColorValue = (l: any): string => {
    if (pathEdgeIds?.has(l.id)) return PATH_COLOR;
    if (selectedEdgeId === l.id) return '#111827';
    if (pathActive) return edgeStrokeColor(l as any);
    const sel = selectedNodeId;
    if (dimOthers && sel != null && l.source !== sel && l.target !== sel) {
      const c = edgeStrokeColor(l as any);
      return `${c}33`;
    }
    return edgeStrokeColor(l as any);
  };

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <ForceGraph2D
        ref={graphRef as MutableRefObject<ForceGraphMethods | undefined>}
        graphData={{ nodes, links }}
        nodeId="id"
        linkSource={LINK_SOURCE}
        linkTarget={LINK_TARGET}
        width={Math.max(320, width)}
        height={560}
      backgroundColor="#ffffff"
      enableNodeDrag
      cooldownTicks={80}
      d3AlphaDecay={0.028}
      nodeLabel={(n: any) => nodeDisplayName(n as GNode)}
      linkLabel={(l: any) => edgeDisplayLabel(l as any)}
      nodeColor={(n: any) => {
        const accent = nodeAccent((n as GNode).id);
        if (accent) return accent;
        const alpha = nodeAlpha((n as GNode).id);
        const c = nodeColor(n as GNode);
        return alpha < 1 ? `${c}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : c;
      }}
      nodeCanvasObject={(n: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const { x, y } = n as { x: number; y: number };
        const node = n as GNode;
        const selected = selectedNodeId === node.id;
        const focusedN = focusNodeId === node.id;
        const alpha = nodeAlpha(node.id);
        const size = 18 / globalScale;
        ctx.save();
        ctx.globalAlpha = alpha;
        // Emphasis ring for the active focus node (Expand neighbors)
        if (focusedN) {
          ctx.beginPath();
          ctx.arc(x, y, 24 / globalScale, 0, Math.PI * 2);
          ctx.lineWidth = 2 / globalScale;
          ctx.strokeStyle = '#111827';
          ctx.stroke();
        }
        drawNode(ctx, x, y, size, nodeColor(node), node.type, selected);
        ctx.restore();
      }}
      nodePointerAreaPaint={(n: any, color: string, ctx: CanvasRenderingContext2D) => {
        const { x, y } = n as { x: number; y: number };
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();
      }}
      linkColor={(l: any) => linkColorValue(l)}
      linkWidth={(l: any) => {
        if (selectedEdgeId === l.id) return edgeStrokeWidth(l as any) + 2;
        if (pathEdgeIds?.has(l.id)) return edgeStrokeWidth(l as any) + 1;
        return edgeStrokeWidth(l as any);
      }}
      linkLineDash={(l: any) => {
        const kind = (l as any)?.kind;
        if (kind === 'membership') return [4, 3];
        return null;
      }}
      linkDirectionalParticles={0}
      onNodeClick={(n: any) => onNodeSelect && onNodeSelect(n as GNode)}
      onNodeHover={(n: any) => onNodeHover && onNodeHover((n as GNode) ?? null)}
      onLinkClick={(l: any) => onEdgeSelect && onEdgeSelect((l as any)?.id ?? null)}
      onLinkHover={(l: any) => onEdgeHover && onEdgeHover(l ? edgeDisplayLabel(l as any) : null)}
    />
    </div>
  );
});

export default NetworkGraph;
