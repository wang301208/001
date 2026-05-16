import type { EventBus } from "../event-bus/bus.js";

export type KnowledgeEntity = {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  confidence: number;
  source: string;
  extractedAt: number;
};

export type KnowledgeRelation = {
  id: string;
  source: string;
  target: string;
  type: string;
  properties?: Record<string, unknown>;
  confidence: number;
};

export type KnowledgeGraph = {
  entities: Map<string, KnowledgeEntity>;
  relations: KnowledgeRelation[];
  addEntity(entity: KnowledgeEntity): void;
  addRelation(relation: KnowledgeRelation): void;
  query(pattern: { type?: string; properties?: Partial<Record<string, unknown>> }): KnowledgeEntity[];
  traverse(entityId: string, maxDepth?: number): KnowledgeEntity[];
  getSubgraph(entityIds: string[]): { entities: KnowledgeEntity[]; relations: KnowledgeRelation[] };
};

export type ExtractedKnowledge = {
  entities: KnowledgeEntity[];
  relations: KnowledgeRelation[];
};

export type RagResult = {
  context: string;
  sources: { entityId: string; type: string; name: string; confidence: number }[];
  totalTokens: number;
};

export type KnowledgeSelfBuilder = {
  extractFromConversation(messages: { role: string; content: string }[]): Promise<ExtractedKnowledge>;
  integrate(knowledge: ExtractedKnowledge): void;
  getGraph(): KnowledgeGraph;
  search(query: string, topK?: number): { entity: KnowledgeEntity; relevance: number }[];
  rag(query: string, topK?: number): RagResult;
  getStats(): { entities: number; relations: number; avgConfidence: number; types: Record<string, number> };
};

export function createKnowledgeSelfBuilder(sourceId: string, eventBus?: EventBus): KnowledgeSelfBuilder {
  const graph: KnowledgeGraph = {
    entities: new Map(),
    relations: [],

    addEntity(entity) {
      const existing = this.entities.get(entity.id);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, entity.confidence);
        Object.assign(existing.properties, entity.properties);
      } else {
        this.entities.set(entity.id, entity);
      }
    },

    addRelation(relation) {
      const exists = this.relations.some(
        (r) => r.source === relation.source && r.target === relation.target && r.type === relation.type,
      );
      if (!exists) {
        this.relations.push(relation);
      }
    },

    query(pattern) {
      return [...this.entities.values()].filter((e) => {
        if (pattern.type && e.type !== pattern.type) return false;
        if (pattern.properties) {
          for (const [key, value] of Object.entries(pattern.properties)) {
            if (e.properties[key] !== value) return false;
          }
        }
        return true;
      });
    },

    traverse(entityId, maxDepth = 3) {
      const visited = new Set<string>();
      const result: KnowledgeEntity[] = [];
      const queue: { id: string; depth: number }[] = [{ id: entityId, depth: 0 }];

      while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (visited.has(id) || depth > maxDepth) continue;
        visited.add(id);
        const entity = this.entities.get(id);
        if (entity) {
          result.push(entity);
          for (const rel of this.relations) {
            if (rel.source === id && !visited.has(rel.target)) {
              queue.push({ id: rel.target, depth: depth + 1 });
            }
            if (rel.target === id && !visited.has(rel.source)) {
              queue.push({ id: rel.source, depth: depth + 1 });
            }
          }
        }
      }
      return result;
    },

    getSubgraph(entityIds) {
      const idSet = new Set(entityIds);
      return {
        entities: [...this.entities.values()].filter((e) => idSet.has(e.id)),
        relations: this.relations.filter((r) => idSet.has(r.source) && idSet.has(r.target)),
      };
    },
  };

  function extractEntitiesFromText(text: string, source: string): KnowledgeEntity[] {
    const entities: KnowledgeEntity[] = [];
    const patterns: { regex: RegExp; type: string; extractGroup: number }[] = [
      { regex: /([A-Z][a-z]+(?: [A-Z][a-z]+)+)/g, type: "person", extractGroup: 1 },
      { regex: /(?:called|named)\s+"([^"]+)"/g, type: "named-entity", extractGroup: 1 },
      { regex: /(\d+(?:\.\d+)?(?:%|ms|MB|GB|seconds?|minutes?|hours?))/g, type: "metric", extractGroup: 1 },
      { regex: /(https?:\/\/[^\s]+)/g, type: "url", extractGroup: 1 },
      { regex: /(?:error|fail|bug|issue)[:\s]+([^\n.]+)/gi, type: "error", extractGroup: 1 },
      { regex: /(?:model|provider|channel)[:\s]+([A-Za-z0-9_-]+)/gi, type: "config-ref", extractGroup: 1 },
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const name = match[pattern.extractGroup];
        if (name && name.length > 1 && name.length < 200) {
          const id = `${pattern.type}:${name.toLowerCase().replace(/\s+/g, "-")}`;
          entities.push({
            id,
            type: pattern.type,
            properties: { name, text: name },
            confidence: 0.7,
            source,
            extractedAt: Date.now(),
          });
        }
      }
    }
    return entities;
  }

  function inferRelations(entities: KnowledgeEntity[], msgRole: string): KnowledgeRelation[] {
    const relations: KnowledgeRelation[] = [];

    for (let i = 0; i < entities.length - 1; i++) {
      if (entities[i].type !== entities[i + 1].type) {
        relations.push({
          id: crypto.randomUUID(),
          source: entities[i].id,
          target: entities[i + 1].id,
          type: "co-occurs",
          confidence: 0.5,
        });
      }

      if (entities[i].type === "error" && entities[i + 1].type === "metric") {
        relations.push({
          id: crypto.randomUUID(),
          source: entities[i].id,
          target: entities[i + 1].id,
          type: "error-with-metric",
          confidence: 0.7,
        });
      }

      if (entities[i].type === "person" && entities[i + 1].type === "config-ref") {
        relations.push({
          id: crypto.randomUUID(),
          source: entities[i].id,
          target: entities[i + 1].id,
          type: "configured-by",
          confidence: 0.6,
        });
      }
    }

    if (msgRole === "assistant") {
      for (const entity of entities) {
        relations.push({
          id: crypto.randomUUID(),
          source: sourceId,
          target: entity.id,
          type: "produced",
          confidence: 0.8,
        });
      }
    }

    return relations;
  }

  return {
    async extractFromConversation(messages) {
      const allEntities: KnowledgeEntity[] = [];
      const allRelations: KnowledgeRelation[] = [];

      for (const msg of messages) {
        const entities = extractEntitiesFromText(msg.content, sourceId);
        allEntities.push(...entities);
        allRelations.push(...inferRelations(entities, msg.role));
      }

      eventBus?.publish("knowledge.extracted", {
        source: sourceId,
        entityCount: allEntities.length,
        relationCount: allRelations.length,
      });

      return { entities: allEntities, relations: allRelations };
    },

    integrate(knowledge) {
      for (const entity of knowledge.entities) {
        graph.addEntity(entity);
      }
      for (const relation of knowledge.relations) {
        graph.addRelation(relation);
      }

      eventBus?.publish("knowledge.integrated", {
        entities: knowledge.entities.length,
        relations: knowledge.relations.length,
        totalEntities: graph.entities.size,
        totalRelations: graph.relations.length,
      });
    },

    getGraph() {
      return graph;
    },

    search(query, topK = 10) {
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/);
      const results: { entity: KnowledgeEntity; relevance: number }[] = [];

      for (const entity of graph.entities.values()) {
        const nameStr = String(entity.properties.name ?? "").toLowerCase();
        const textStr = String(entity.properties.text ?? "").toLowerCase();
        const combined = `${nameStr} ${textStr}`;

        let relevance = 0;
        if (combined.includes(queryLower)) {
          relevance = entity.confidence;
        } else {
          const matchedWords = queryWords.filter((w) => combined.includes(w)).length;
          relevance = (matchedWords / queryWords.length) * entity.confidence;
        }

        if (relevance > 0) {
          results.push({ entity, relevance });
        }
      }

      results.sort((a, b) => b.relevance - a.relevance);
      return results.slice(0, topK);
    },

    rag(query, topK = 5) {
      const searchResults = this.search(query, topK);
      if (searchResults.length === 0) {
        return { context: "", sources: [], totalTokens: 0 };
      }

      const entityIds = searchResults.map((r) => r.entity.id);
      const subgraph = graph.getSubgraph(entityIds);

      const contextParts: string[] = [];
      for (const entity of subgraph.entities) {
        const name = String(entity.properties.name ?? entity.id);
        contextParts.push(`[${entity.type}] ${name}: ${JSON.stringify(entity.properties)}`);
      }

      for (const rel of subgraph.relations) {
        const srcEntity = graph.entities.get(rel.source);
        const tgtEntity = graph.entities.get(rel.target);
        if (srcEntity && tgtEntity) {
          contextParts.push(`${String(srcEntity.properties.name ?? srcEntity.id)} --[${rel.type}]--> ${String(tgtEntity.properties.name ?? tgtEntity.id)}`);
        }
      }

      const context = contextParts.join("\n");
      const totalTokens = Math.ceil(context.length / 4);

      return {
        context,
        sources: searchResults.map((r) => ({
          entityId: r.entity.id,
          type: r.entity.type,
          name: String(r.entity.properties.name ?? r.entity.id),
          confidence: r.relevance,
        })),
        totalTokens,
      };
    },

    getStats() {
      const entities = [...graph.entities.values()];
      const types: Record<string, number> = {};
      for (const e of entities) {
        types[e.type] = (types[e.type] ?? 0) + 1;
      }
      const avgConfidence = entities.length > 0
        ? entities.reduce((s, e) => s + e.confidence, 0) / entities.length
        : 0;
      return {
        entities: graph.entities.size,
        relations: graph.relations.length,
        avgConfidence,
        types,
      };
    },
  };
}
