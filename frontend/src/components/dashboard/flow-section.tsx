"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion } from "framer-motion";
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
 * The node graph, kept as the signature "how the pieces connect" visual —
 * but now one bounded section on the dashboard rather than the entire
 * page. Fixed height, non-interactive pan/zoom (it's an illustration, not
 * a workspace here), nodes still clickable to open the detail drawer.
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
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
      className="rounded border border-border bg-bg-surface"
    >
      <div className="border-b border-border px-6 py-4">
        <p className="font-mono text-[11px] text-text-muted">how_it_works</p>
        <h3 className="mt-1 text-lg font-medium text-text-primary">
          Three agents, one shared file
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          You work with all three. They don&apos;t keep separate notes —
          everything flows into one employee file. Tap any node to see more.
        </p>
      </div>
      <div className="h-[420px] w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          nodesDraggable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          className="bg-bg-base"
        >
          <Background
            variant={BackgroundVariant.Lines}
            gap={32}
            color="var(--line-grid)"
          />
        </ReactFlow>
      </div>
    </motion.section>
  );
}
