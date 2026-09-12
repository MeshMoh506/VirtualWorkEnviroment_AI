"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { AGENT_ORDER, type AgentId } from "@/lib/agents";
import { AgentNode, EmployeeFileNode, UserNode } from "@/components/board/nodes";
import type { BoardSelection } from "@/components/board/detail-panel";

const nodeTypes = {
  agent: AgentNode,
  user: UserNode,
  employeeFile: EmployeeFileNode,
};

const AGENT_POSITIONS: Record<AgentId, { x: number; y: number }> = {
  manager: { x: 40, y: 200 },
  mentor: { x: 300, y: 200 },
  hr: { x: 560, y: 200 },
};

interface FlowSectionProps {
  onSelect: (selection: BoardSelection) => void;
}

/**
 * The agents graph — now the board's whole right column. Interactive
 * again: the graph pans and zooms (Meshari asked for that back), with
 * Controls for zoom/fit and nodes still clickable to open the detail
 * drawer. Fills its parent, so the parent must be a sized/relative box.
 */
export function FlowSection({ onSelect }: FlowSectionProps) {
  const nodes: Node[] = useMemo(
    () => [
      { id: "user", type: "user", position: { x: 260, y: 20 }, data: { index: 0 } },
      ...AGENT_ORDER.map((agentId, i) => ({
        id: agentId,
        type: "agent",
        position: AGENT_POSITIONS[agentId],
        data: { agentId, index: i + 1, onSelect },
      })),
      {
        id: "employee-file",
        type: "employeeFile",
        position: { x: 240, y: 400 },
        data: { index: 4, onSelect: () => onSelect("employee-file") },
      },
    ],
    [onSelect]
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
        style: { stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "4 3" },
      })),
    ],
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      nodesDraggable={false}
      minZoom={0.4}
      maxZoom={1.5}
      className="bg-bg-base"
    >
      <Background variant={BackgroundVariant.Lines} gap={32} color="var(--line-grid)" />
      <Controls
        showInteractive={false}
        className="!border-border !bg-bg-surface [&_button]:!border-border [&_button]:!bg-bg-surface [&_button:hover]:!bg-bg-surface-raised [&_button_svg]:!fill-text-secondary"
      />
    </ReactFlow>
  );
}
