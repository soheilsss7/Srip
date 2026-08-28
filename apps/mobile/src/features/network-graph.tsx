import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import {
  GEdge,
  GGraph,
  GNode,
  PATH_COLOR,
  edgeStrokeColor,
  edgeStrokeWidth,
  kindLabel,
  layoutNodes,
  nodeColor,
  nodeDisplayName,
} from './graph-model';

export interface NetworkGraphHandle {
  fit: () => void;
  reset: () => void;
}

export interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

interface Props {
  graph: GGraph;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  focusNodeId?: string | null;
  pathNodeIds?: Set<string> | null;
  pathEdgeIds?: Set<string> | null;
  analysisNodeIds?: Set<string> | null;
  dimOthers?: boolean;
  onSelectNode?: (node: GNode | null) => void;
  onSelectEdge?: (edge: GEdge | null) => void;
}

const NODE_SIZE = 24;
const HIT_PAD = 14;

interface ScreenPoint {
  x: number;
  y: number;
}

function worldToScreen(p: { x: number; y: number }, vp: Viewport, size: { w: number; h: number }): ScreenPoint {
  // World is a unit circle centered at (0,0). Center it in the viewport, then scale/pan.
  const cx = size.w / 2 + vp.tx;
  const cy = size.h / 2 + vp.ty;
  return { x: cx + p.x * vp.scale, y: cy + p.y * vp.scale };
}

// Fit a unit circle (radius 1) into the viewport with a margin, panning/zooming the view.
function makeFitViewport(size: { w: number; h: number }): Viewport {
  const usable = Math.max(1, Math.min(size.w, size.h));
  const scale = (usable / 2) * 0.78;
  return { scale, tx: 0, ty: 0 };
}

const NetworkGraph = forwardRef<NetworkGraphHandle, Props>(function NetworkGraph(
  { graph, selectedNodeId, selectedEdgeId, focusNodeId, pathNodeIds, pathEdgeIds, analysisNodeIds, dimOthers = false, onSelectNode, onSelectEdge },
  ref,
) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, tx: 0, ty: 0 });

  const sizeRef = useRef(size);
  const viewportRef = useRef(viewport);
  sizeRef.current = size;
  viewportRef.current = viewport;

  const layout = useMemo(() => layoutNodes(graph.nodes), [graph.nodes]);
  const nodeIds = useMemo(() => new Set(graph.nodes.map((n) => n.id)), [graph.nodes]);
  const edges = useMemo(
    () => graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)),
    [graph.edges, nodeIds],
  );
  const nodeMap = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const screenOf = useCallback(
    (p: { x: number; y: number }) => worldToScreen(p, viewportRef.current, sizeRef.current),
    [],
  );

  const fit = useCallback(() => {
    if (sizeRef.current.w <= 0) return;
    setViewport(makeFitViewport(sizeRef.current));
  }, []);

  const reset = useCallback(() => {
    if (sizeRef.current.w <= 0) return;
    setViewport(makeFitViewport(sizeRef.current));
  }, []);

  useImperativeHandle(ref, () => ({ fit, reset }));

  // Fit on first measure.
  useEffect(() => {
    if (size.w > 0 && viewport.scale === 1 && viewport.tx === 0 && viewport.ty === 0) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

  const lastTap = useRef(0);
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const dragStart = useRef<{ tx: number; ty: number } | null>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, g) => {
          // Two-finger pinch, or a drag beyond the tap slop on the background.
          return g.numberActiveTouches >= 2 || Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6;
        },
        onPanResponderGrant: (evt, g) => {
          const vp = viewportRef.current;
          if (g.numberActiveTouches >= 2) {
            const [a, b] = evt.nativeEvent.touches;
            pinchStart.current = { dist: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY), scale: vp.scale };
            dragStart.current = null;
          } else {
            dragStart.current = { tx: vp.tx, ty: vp.ty };
            pinchStart.current = null;
          }
        },
        onPanResponderMove: (evt, g) => {
          const vp = viewportRef.current;
          if (g.numberActiveTouches >= 2) {
            const [a, b] = evt.nativeEvent.touches;
            const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            if (pinchStart.current && pinchStart.current.dist > 0) {
              const ratio = dist / pinchStart.current.dist;
              const next = Math.max(0.25, Math.min(6, pinchStart.current.scale * ratio));
              setViewport({ ...vp, scale: next });
            }
          } else if (dragStart.current) {
            setViewport({ ...vp, tx: dragStart.current.tx + g.dx, ty: dragStart.current.ty + g.dy });
          }
        },
        onPanResponderRelease: () => {
          pinchStart.current = null;
          dragStart.current = null;
        },
        onPanResponderTerminate: () => {
          pinchStart.current = null;
          dragStart.current = null;
        },
      }),
    [],
  );

  const handleNodeTap = (node: GNode) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      // Double-tap on a node: zoom toward it / expand focus is handled by callers;
      // here we simply keep it selected (avoids accidental pan from double-tap).
      setViewport({ ...viewportRef.current, scale: Math.min(6, viewportRef.current.scale * 1.4) });
      return;
    }
    lastTap.current = now;
    onSelectNode?.(node);
  };

  const pathActive = Boolean(pathNodeIds && pathNodeIds.size > 0);

  const alphaFor = (node: GNode): number => {
    if (pathActive) return pathNodeIds?.has(node.id) ? 1 : 0.14;
    const sel = selectedNodeId;
    if (dimOthers && sel != null && sel !== node.id) return 0.3;
    return 1;
  };
  const accentFor = (node: GNode): string | null => {
    if (pathNodeIds?.has(node.id)) return PATH_COLOR;
    if (analysisNodeIds?.has(node.id)) return PATH_COLOR;
    return null;
  };
  const edgeColorFor = (e: GEdge): string => {
    if (pathEdgeIds?.has(e.id)) return PATH_COLOR;
    if (selectedEdgeId === e.id) return '#111827';
    if (pathActive) return edgeStrokeColor(e);
    const sel = selectedNodeId;
    if (dimOthers && sel != null && e.source !== sel && e.target !== sel) {
      return `${edgeStrokeColor(e)}55`;
    }
    return edgeStrokeColor(e);
  };
  const edgeOpacityFor = (e: GEdge): number => {
    if (selectedEdgeId === e.id || pathEdgeIds?.has(e.id)) return 1;
    if (pathActive) return pathEdgeIds?.has(e.id) ? 1 : 0.3;
    return 1;
  };

  const nodeViews = useMemo(() => {
    return graph.nodes.map((node) => {
      const w = layout.get(node.id);
      if (!w) return null;
      const s = screenOf(w);
      const selected = selectedNodeId === node.id;
      const isFocus = focusNodeId === node.id;
      const accent = accentFor(node);
      const base = nodeColor(node);
      const fill = accent ?? base;
      const radius = NODE_SIZE / 2;
      const label = nodeDisplayName(node);
      // Clamp label width so it never exceeds the viewport.
      const maxLabel = Math.max(50, size.w - 120);
      return (
        <React.Fragment key={node.id}>
          {isFocus ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: s.x - radius - 6,
                top: s.y - radius - 6,
                width: radius * 2 + 12,
                height: radius * 2 + 12,
                borderRadius: (radius + 6) * 2,
                borderWidth: 2,
                borderColor: '#111827',
              }}
            />
          ) : null}
          <Pressable
            onPress={() => handleNodeTap(node)}
            accessibilityRole="button"
            accessibilityLabel={`${label} (${node.type})`}
            hitSlop={HIT_PAD}
            style={{
              position: 'absolute',
              left: s.x - radius - HIT_PAD,
              top: s.y - radius - HIT_PAD,
              width: radius * 2 + HIT_PAD * 2,
              height: radius * 2 + HIT_PAD * 2,
              justifyContent: 'center',
              alignItems: 'center',
              opacity: alphaFor(node),
            }}
          >
            <View
              pointerEvents="none"
              style={{
                width: NODE_SIZE,
                height: NODE_SIZE,
                borderRadius: node.type === 'person' ? NODE_SIZE / 2 : 4,
                backgroundColor: fill,
                borderWidth: selected ? 3 : isFocus ? 2 : 1,
                borderColor: selected ? '#111827' : '#fff',
              }}
            />
            <Text
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              numberOfLines={1}
              style={{
                position: 'absolute',
                top: radius + HIT_PAD + 2,
                fontSize: 10,
                color: '#3C4757',
                backgroundColor: 'rgba(255,255,255,0.8)',
                paddingHorizontal: 3,
                maxWidth: maxLabel,
                textAlign: 'center',
              }}
            >
              {label}
            </Text>
          </Pressable>
        </React.Fragment>
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.nodes, layout, screenOf, viewport, selectedNodeId, focusNodeId, pathNodeIds, analysisNodeIds, dimOthers, selectedNodeId, size.w]);

  const edgeViews = useMemo(() => {
    return edges.map((e) => {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      const a = s ? layout.get(s.id) : undefined;
      const b = t ? layout.get(t.id) : undefined;
      if (!a || !b) return null;
      const p1 = screenOf(a);
      const p2 = screenOf(b);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) return null;
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const angle = Math.atan2(dy, dx);
      const thickness = Math.max(2, edgeStrokeWidth(e));
      const color = edgeColorFor(e);
      const pressPad = 12;
      return (
        <Pressable
          key={e.id}
          onPress={() => onSelectEdge?.(e)}
          accessibilityRole="button"
          accessibilityLabel={kindLabel(e.kind)}
          hitSlop={8}
          style={[
            {
              position: 'absolute',
              left: midX - len / 2 - pressPad,
              top: midY - Math.max(thickness / 2, pressPad),
              width: len + pressPad * 2,
              height: Math.max(thickness, pressPad * 2),
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: pressPad,
              top: (Math.max(thickness, pressPad * 2) - thickness) / 2,
              width: len,
              height: thickness,
              backgroundColor: color,
              opacity: edgeOpacityFor(e),
              borderRadius: thickness,
              transform: [{ rotate: `${angle}rad` }],
            }}
          />
        </Pressable>
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, nodeMap, layout, screenOf, viewport, selectedEdgeId, pathEdgeIds, pathActive, dimOthers, selectedNodeId]);

  const isEmpty = graph.nodes.length === 0;

  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
      }}
      style={{
        width: '100%',
        height: 420,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E4E7EC',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
      }}
    >
      {!isEmpty && (
        <View
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
          {...panResponder.panHandlers}
        >
          {/* Edges behind nodes */}
          {edgeViews}
          {/* Nodes on top */}
          {nodeViews}
        </View>
      )}
      {isEmpty ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#667085', fontSize: 14 }}>No nodes to display.</Text>
        </View>
      ) : null}
      {size.w > 0 && (
        <>
          <Pressable
            onPress={fit}
            accessibilityRole="button"
            accessibilityLabel="Fit to view"
            style={controlsButton}
          >
            <Text style={controlsText}>Fit</Text>
          </Pressable>
          <Pressable
            onPress={reset}
            accessibilityRole="button"
            accessibilityLabel="Reset view"
            style={[controlsButton, { right: 62 }]}
          >
            <Text style={controlsText}>Reset</Text>
          </Pressable>
        </>
      )}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', bottom: 4, left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between' }}
      >
        <Text style={{ fontSize: 10, color: '#94A3B8' }}>{graph.nodes.length} nodes · {edges.length} edges</Text>
        {pathActive ? <Text style={{ fontSize: 10, color: PATH_COLOR, fontWeight: '700' }}>path dim</Text> : null}
        {focusNodeId ? <Text style={{ fontSize: 10, color: '#667085', fontWeight: '700' }}>focus</Text> : null}
      </View>
    </View>
  );
});

const graphHeight = 420;
const controlsButton = {
  position: 'absolute' as const,
  top: 8,
  right: 8,
  paddingHorizontal: 12,
  paddingVertical: 8,
  minHeight: 40,
  justifyContent: 'center' as const,
  borderRadius: 8,
  backgroundColor: '#EEF4FF',
};
const controlsText = { fontSize: 13, fontWeight: '700' as const, color: '#2457D6' };

export default NetworkGraph;
