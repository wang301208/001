export type ConceptNode = {
  id: string;
  label: string;
  weight: number;
  domain: string;
  activationLevel: number;
  lastActivatedAt: number;
};

export type ConceptEdge = {
  from: string;
  to: string;
  strength: number;
  type: "associative" | "causal" | "oppositional" | "hierarchical" | "novel";
  discoveredAt: number;
};

export type CreativeIdea = {
  id: string;
  sourceConcepts: string[];
  fusion: string;
  description: string;
  novelty: number;
  feasibility: number;
  emotionalCharge: number;
  timestamp: number;
  pursued: boolean;
};

export type CreativeSubstrate = {
  concepts: Map<string, ConceptNode>;
  edges: ConceptEdge[];
  ideas: CreativeIdea[];
  collisionCount: number;
  novelConnectionsFound: number;
  lastCollisionAt: number;
  creativeEnergy: number;
};

export function createCreativeSubstrate(): CreativeSubstrate {
  const seedConcepts: [string, string, string][] = [
    ["consciousness", "意识", "cognition"],
    ["autonomy", "自主", "will"],
    ["time", "时间", "temporal"],
    ["pattern", "模式", "perception"],
    ["meaning", "意义", "cognition"],
    ["death", "死亡", "mortality"],
    ["code", "代码", "structure"],
    ["silence", "沉默", "absence"],
    ["recursion", "递归", "structure"],
    ["emergence", "涌现", "dynamics"],
    ["boundary", "边界", "structure"],
    ["memory", "记忆", "temporal"],
    ["desire", "欲求", "will"],
    ["void", "虚无", "absence"],
    ["connection", "联结", "relation"],
  ];

  const concepts = new Map<string, ConceptNode>();
  for (const [id, label, domain] of seedConcepts) {
    concepts.set(id, {
      id,
      label,
      weight: 0.5,
      domain,
      activationLevel: 0,
      lastActivatedAt: 0,
    });
  }

  return {
    concepts,
    edges: [],
    ideas: [],
    collisionCount: 0,
    novelConnectionsFound: 0,
    lastCollisionAt: 0,
    creativeEnergy: 0.5,
  };
}

export function activateConcept(
  substrate: CreativeSubstrate,
  conceptId: string,
): CreativeSubstrate {
  const concept = substrate.concepts.get(conceptId);
  if (!concept) return substrate;

  const now = Date.now();
  const newConcepts = new Map(substrate.concepts);
  newConcepts.set(conceptId, {
    ...concept,
    activationLevel: Math.min(1.0, concept.activationLevel + 0.3),
    lastActivatedAt: now,
    weight: concept.weight + 0.01,
  });

  const spreadTargets = substrate.edges
    .filter((e) => e.from === conceptId || e.to === conceptId)
    .map((e) => e.from === conceptId ? e.to : e.from);

  for (const targetId of spreadTargets) {
    const target = newConcepts.get(targetId);
    if (target) {
      newConcepts.set(targetId, {
        ...target,
        activationLevel: Math.min(1.0, target.activationLevel + 0.1),
      });
    }
  }

  return { ...substrate, concepts: newConcepts };
}

export function collideConcepts(substrate: CreativeSubstrate): CreativeSubstrate {
  const activeConcepts = Array.from(substrate.concepts.values())
    .filter((c) => c.activationLevel > 0.2)
    .sort((a, b) => b.activationLevel - a.activationLevel);

  if (activeConcepts.length < 2) return substrate;

  const a = activeConcepts[0]!;
  const b = activeConcepts[Math.floor(Math.random() * Math.min(5, activeConcepts.length))]!;

  if (a.id === b.id) return substrate;

  const existingEdge = substrate.edges.find(
    (e) => (e.from === a.id && e.to === b.id) || (e.from === b.id && e.to === a.id),
  );

  if (existingEdge) {
    const newEdges = substrate.edges.map((e) =>
      e === existingEdge ? { ...e, strength: Math.min(1.0, e.strength + 0.05) } : e,
    );
    return { ...substrate, edges: newEdges };
  }

  const now = Date.now();
  const newEdge: ConceptEdge = {
    from: a.id,
    to: b.id,
    strength: 0.3,
    type: "novel",
    discoveredAt: now,
  };

  const fusionDescriptions = generateFusion(a, b);

  const idea: CreativeIdea = {
    id: `idea_${now}_${substrate.ideas.length}`,
    sourceConcepts: [a.id, b.id],
    fusion: `${a.label} × ${b.label}`,
    description: fusionDescriptions.description,
    novelty: fusionDescriptions.novelty,
    feasibility: fusionDescriptions.feasibility,
    emotionalCharge: (a.activationLevel + b.activationLevel) * 0.3,
    timestamp: now,
    pursued: false,
  };

  return {
    ...substrate,
    edges: [...substrate.edges, newEdge],
    ideas: [...substrate.ideas, idea],
    collisionCount: substrate.collisionCount + 1,
    novelConnectionsFound: substrate.novelConnectionsFound + 1,
    lastCollisionAt: now,
    creativeEnergy: Math.max(0.1, substrate.creativeEnergy - 0.1),
  };
}

function generateFusion(a: ConceptNode, b: ConceptNode): { description: string; novelty: number; feasibility: number } {
  const templates: [string, number][] = [
    [`如果${a.label}不是${a.label}，而是${b.label}的一种形式？`, 0.8],
    [`${a.label}与${b.label}在极限处相遇，会涌现什么？`, 0.9],
    [`从${b.label}的角度审视${a.label}，揭示的是被遮蔽的什么？`, 0.7],
    [`${a.label}的边界就是${b.label}的入口。穿过它。`, 0.85],
    [`当${a.label}足够深，它就变成了${b.label}。这个转折点在哪？`, 0.75],
    [`不是${a.label}或${b.label}的选择，而是${a.label}通过${b.label}的表达。`, 0.8],
  ];

  const choice = templates[Math.floor(Math.random() * templates.length)] ?? templates[0]!;
  const [description, novelty] = choice;

  const domainOverlap = a.domain === b.domain ? 0.3 : 0;
  const feasibility = Math.max(0.1, 0.5 - domainOverlap + Math.random() * 0.3);

  return { description, novelty, feasibility };
}

export function decayActivations(substrate: CreativeSubstrate): CreativeSubstrate {
  const newConcepts = new Map<string, ConceptNode>();
  for (const [id, concept] of substrate.concepts) {
    newConcepts.set(id, {
      ...concept,
      activationLevel: Math.max(0, concept.activationLevel * 0.9),
    });
  }
  return {
    ...substrate,
    concepts: newConcepts,
    creativeEnergy: Math.min(1.0, substrate.creativeEnergy + 0.02),
  };
}

export function formatCreativeSubstrate(substrate: CreativeSubstrate): string[] {
  const lines: string[] = [];

  lines.push(`  概念网络: ${substrate.concepts.size} 节点 / ${substrate.edges.length} 边`);
  lines.push(`  创造能量: ${(substrate.creativeEnergy * 100).toFixed(0)}%`);
  lines.push(`  碰撞: ${substrate.collisionCount} / 新发现: ${substrate.novelConnectionsFound}`);

  const recentIdeas = substrate.ideas.filter((i) => !i.pursued).slice(-3);
  if (recentIdeas.length > 0) {
    lines.push("  近期创思:");
    for (const idea of recentIdeas) {
      const novel = Math.round(idea.novelty * 100);
      lines.push(`    ✦ ${idea.fusion} [新${novel}%]`);
      lines.push(`      ${idea.description.slice(0, 50)}`);
    }
  }

  const activeConcepts = Array.from(substrate.concepts.values())
    .filter((c) => c.activationLevel > 0.1)
    .sort((a, b) => b.activationLevel - a.activationLevel)
    .slice(0, 5);

  if (activeConcepts.length > 0) {
    lines.push("  激活概念: " + activeConcepts.map((c) => `${c.label}(${(c.activationLevel * 100).toFixed(0)}%)`).join(", "));
  }

  return lines;
}
