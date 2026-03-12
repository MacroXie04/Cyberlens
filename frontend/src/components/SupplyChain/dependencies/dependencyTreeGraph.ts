import type * as d3 from "d3";

import type { Dependency } from "../../../types";
import { colors } from "../../../theme/theme";

export interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  fullName: string;
  ecosystem: string;
  isVulnerable: boolean;
  vulnCount: number;
  isCenter: boolean;
}

export interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
}

export function buildGraph(dependencies: Dependency[]) {
  const nodes: SimNode[] = [{ id: "project", name: "Project", fullName: "Project", ecosystem: "", isVulnerable: false, vulnCount: 0, isCenter: true }];
  const links: SimLink[] = [];
  const ecosystems = [...new Set(dependencies.map((dependency) => dependency.ecosystem))];
  nodes.push(...ecosystems.map((ecosystem) => ({ id: `eco-${ecosystem}`, name: ecosystem, fullName: ecosystem, ecosystem, isVulnerable: false, vulnCount: 0, isCenter: false })));
  ecosystems.forEach((ecosystem) => links.push({ source: "project", target: `eco-${ecosystem}` }));
  dependencies.forEach((dependency) => {
    const vulnCount = dependency.vulnerabilities?.length || 0;
    nodes.push({ id: `dep-${dependency.id}`, name: dependency.name, fullName: `${dependency.name}@${dependency.version}`, ecosystem: dependency.ecosystem, isVulnerable: dependency.is_vulnerable, vulnCount, isCenter: false });
    links.push({ source: `eco-${dependency.ecosystem}`, target: `dep-${dependency.id}` });
  });
  return { links, nodes };
}

export function nodeColor(node: SimNode): string {
  if (node.isCenter) return colors.primary;
  if (node.id.startsWith("eco-")) return colors.onPrimaryContainer;
  if (node.isVulnerable) return node.vulnCount >= 3 ? colors.error : "#FF7043";
  return colors.safe;
}

export function nodeRadius(node: SimNode): number {
  if (node.isCenter) return 24;
  if (node.id.startsWith("eco-")) return 16;
  if (node.isVulnerable) return 8 + Math.min(node.vulnCount * 2, 8);
  return 6;
}
