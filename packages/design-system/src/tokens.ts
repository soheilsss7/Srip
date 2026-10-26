export const tokens = {
  color: { canvas:'var(--srip-canvas)', surface:'var(--srip-surface)', surfaceRaised:'var(--srip-surface-raised)', text:'var(--srip-text)', muted:'var(--srip-muted)', primary:'var(--srip-primary)', border:'var(--srip-border)', danger:'var(--srip-danger)', success:'var(--srip-success)', warning:'var(--srip-warning)', focus:'var(--srip-focus)' },
  typography: { fontFamily:'Inter, system-ui, sans-serif', sizes:{xs:12,sm:14,md:16,lg:20,xl:28,display:48}, weights:{regular:400,medium:500,semibold:600,bold:700,heavy:800} },
  radius:{sm:8,md:12,lg:16,xl:24,pill:999},
  spacing:{1:4,2:8,3:12,4:16,6:24,8:32,12:48,16:64},
  shadow:{sm:'0 1px 2px rgba(16,32,51,.06)',md:'0 8px 24px rgba(16,32,51,.08)'},
  motion:{fast:'120ms',normal:'180ms',slow:'260ms'}
} as const;
export type DesignTokens=typeof tokens;
