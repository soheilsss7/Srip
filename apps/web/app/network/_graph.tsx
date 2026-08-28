'use client';
// Browser-only interactive force-directed graph wrapper around react-force-graph-2d.
// Lazy-loaded (ssr:false) because it depends on canvas/zoom/d3 which require a DOM.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import {
  GGraph,
  GNode,
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
}

export interface NetworkGraphProps {
  graph: GGraph;
  selectedNodeId?: string | null;
  dimOthers: boolean;
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
  { graph, selectedNodeId, dimOthers, onNodeSelect, onNodeHover, onEdgeSelect, onEdgeHover, onRendered },
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
      nodeColor={(n: any) => nodeColor(n as GNode)}
      nodeCanvasObject={(n: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const { x, y } = n as { x: number; y: number };
        const node = n as GNode;
        const selected = selectedNodeId === node.id;
        const dim = dimOthers && selectedNodeId != null && !selected;
        const size = 18 / globalScale;
        ctx.save();
        ctx.globalAlpha = dim ? 0.35 : 1;
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
      linkColor={(l: any) => edgeStrokeColor(l as any)}
      linkWidth={(l: any) => edgeStrokeWidth(l as any)}
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
