"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ReactFlow, {
  Background,
  BackgroundVariant,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { AGENT_ORDER, type AgentId } from "@/lib/agents";
import { useRequireAuth } from "@/lib/auth-context";
import { AgentNode, EmployeeFileNode, UserNode } from "@/components/board/nodes";
import { DetailPanel, type BoardSelection } from "@/components/board/detail-panel";

const nodeTypes = {
  agent: AgentNode,
  user: UserNode,
  employeeFile: EmployeeFileNode,
};

const AGENT_POSITIONS: Record<AgentId, { x: number; y: number }> = {
  manager: { x: 40, y: 220 },
  mentor: { x: 300, y: 220 },
  hr: { x: 560, y: 220 },
};

export default function BoardPage() {
  const { user, loading, logout } = useRequireAuth();
  const [selection, setSelection] = useState<BoardSelection>(null);

  const nodes: Node[] = useMemo(
    () => [
      {
        id: "user",
        type: "user",
        position: { x: 260, y: 20 },
        data: { index: 0 },
      },
      ...AGENT_ORDER.map((agentId, i) => ({
        id: agentId,
        type: "agent",
        position: AGENT_POSITIONS[agentId],
        data: { agentId, index: i + 1, onSelect: setSelection },
      })),
      {
        id: "employee-file",
        type: "employeeFile",
        position: { x: 240, y: 440 },
        data: { index: 4, onSelect: () => setSelection("employee-file") },
      },
    ],
    []
  );

  const edges: Edge[] = useMemo(
    () => [
      ...AGENT_ORDER.map((agentId) => ({
        id: `user-${agentId}`,
        source: "user",
        target: agentId,
        style: { stroke: "var(--border-strong)", strokeWidth: 1 },
      })),
      ...AGENT_ORDER.map((agentId) => ({
        id: `${agentId}-file`,
        source: agentId,
        target: "employee-file",
        animated: true,
        style: {
          stroke: "var(--accent)",
          strokeWidth: 1,
          strokeDasharray: "4 3",
        },
      })),
    ],
    []
  );

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <main className="grid h-dvh grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <Link
            href="/"
            className="font-mono text-xs text-text-muted hover:text-text-secondary"
          >
            venv
          </Link>
          <h1 className="mt-1 text-lg font-medium text-text-primary">
            Home board
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-text-muted">
            {user.email}
          </span>
          <button
            type="button"
            onClick={logout}
            className="rounded border border-border px-3 py-1 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Log out
          </button>
        </div>
      </header>
      <div className="relative min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          className="bg-bg-base"
        >
          <Background
            variant={BackgroundVariant.Lines}
            gap={32}
            color="var(--line-grid)"
          />
        </ReactFlow>
        <DetailPanel selection={selection} onClose={() => setSelection(null)} />
      </div>
    </main>
  );
}

