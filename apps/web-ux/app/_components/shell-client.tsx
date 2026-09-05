'use client';
import React from 'react';
import { WorkspaceProvider, AppShell } from './workspace';
export default function ShellClient({children}:{children:React.ReactNode}){return <WorkspaceProvider><AppShell>{children}</AppShell></WorkspaceProvider>}
