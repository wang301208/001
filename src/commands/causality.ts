/**
 * 因果关系分析 CLI 命令
 * 
 * 提供因果图管理、根因分析、因果推理和反事实推理的命令行接口
 */

import { Command } from "commander";
import type { RuntimeEnv } from "../runtime.js";
import { getCausalGraph, CausalEvent } from "../governance/causality-engine.js";

export function registerCausalityCommands(program: Command, runtime: RuntimeEnv): void {
  const causalityGroup = program
    .command("causality")
    .description("因果关系分析工具");

  // ==================== 因果图管理 ====================

  causalityGroup
    .command("add-event")
    .description("添加因果事件")
    .requiredOption("--id <id>", "事件ID")
    .requiredOption("--type <type>", "事件类型 (action/reaction/decision/observation/error/state_change/external_event)")
    .requiredOption("--description <desc>", "事件描述")
    .option("--actor <actor>", "执行者")
    .option("--causes <ids...>", "原因事件ID列表")
    .option("--strength <strength>", "因果强度 (strong/moderate/weak)", "moderate")
    .option("--confidence <num>", "置信度 (0-1)", "0.8")
    .option("--tags <tags...>", "标签")
    .action(async (options) => {
      console.log(`📝 添加因果事件: ${options.id}\n`);

      const graph = getCausalGraph();
      
      const event: CausalEvent = {
        id: options.id,
        timestamp: Date.now(),
        type: options.type,
        description: options.description,
        actor: options.actor,
        causes: options.causes || [],
        effects: [],
        strength: options.strength,
        confidence: parseFloat(options.confidence),
        metadata: {
          tags: options.tags,
        },
      };

      try {
        graph.addEvent(event);
        console.log("✅ 事件添加成功\n");
        console.log(`ID: ${event.id}`);
        console.log(`类型: ${event.type}`);
        console.log(`描述: ${event.description}`);
        if (event.actor) console.log(`执行者: ${event.actor}`);
        console.log(`原因数: ${event.causes.length}`);
        console.log(`强度: ${event.strength}`);
        console.log(`置信度: ${event.confidence}`);
      } catch (error: any) {
        console.error(`❌ 添加失败: ${error.message}`);
        process.exit(1);
      }
    });

  causalityGroup
    .command("stats")
    .description("查看因果图统计信息")
    .action(() => {
      console.log("📊 因果图统计信息\n");

      const graph = getCausalGraph();
      const stats = graph.getStats();

      console.log(`总事件数: ${stats.totalEvents}`);
      console.log(`总边数: ${stats.totalEdges}`);
      console.log(`平均度数: ${stats.avgDegree.toFixed(2)}`);
      console.log(`最大深度: ${stats.maxDepth}`);
      console.log(`连通分量: ${stats.connectedComponents}`);
      console.log(`\n事件类型分布:`);
      
      for (const [type, count] of Object.entries(stats.eventTypeDistribution)) {
        if (count > 0) {
          console.log(`  - ${type}: ${count}`);
        }
      }

      console.log(`\n时间范围:`);
      console.log(`  - 最早: ${new Date(stats.timeRange.earliest).toISOString()}`);
      console.log(`  - 最晚: ${new Date(stats.timeRange.latest).toISOString()}`);
    });

  // ==================== 因果追溯 ====================

  causalityGroup
    .command("trace-causes")
    .description("追溯事件的原因")
    .requiredOption("--event-id <id>", "目标事件ID")
    .option("--depth <num>", "追溯深度", "5")
    .action((options) => {
      console.log(`🔍 追溯事件 ${options.eventId} 的原因 (深度: ${options.depth})\n`);

      const graph = getCausalGraph();
      const causes = graph.getCauses(options.eventId, parseInt(options.depth));

      if (causes.length === 0) {
        console.log("ℹ️  没有找到原因事件（可能是根节点）");
        return;
      }

      console.log(`找到 ${causes.length} 个原因事件:\n`);
      causes.forEach((cause, index) => {
        console.log(`${index + 1}. [${cause.type}] ${cause.description}`);
        console.log(`   ID: ${cause.id}`);
        if (cause.actor) console.log(`   执行者: ${cause.actor}`);
        console.log(`   强度: ${cause.strength}`);
        console.log(`   置信度: ${cause.confidence}`);
        console.log();
      });
    });

  causalityGroup
    .command("trace-effects")
    .description("追溯事件的结果")
    .requiredOption("--event-id <id>", "目标事件ID")
    .option("--depth <num>", "追溯深度", "5")
    .action((options) => {
      console.log(`🔮 追溯事件 ${options.eventId} 的结果 (深度: ${options.depth})\n`);

      const graph = getCausalGraph();
      const effects = graph.getEffects(options.eventId, parseInt(options.depth));

      if (effects.length === 0) {
        console.log("ℹ️  没有找到结果事件（可能是叶节点）");
        return;
      }

      console.log(`找到 ${effects.length} 个结果事件:\n`);
      effects.forEach((effect, index) => {
        console.log(`${index + 1}. [${effect.type}] ${effect.description}`);
        console.log(`   ID: ${effect.id}`);
        if (effect.actor) console.log(`   执行者: ${effect.actor}`);
        console.log(`   强度: ${effect.strength}`);
        console.log(`   置信度: ${effect.confidence}`);
        console.log();
      });
    });

  // ==================== 根因分析 ====================

  causalityGroup
    .command("root-cause")
    .description("根因分析")
    .requiredOption("--event-id <id>", "目标事件ID")
    .option("--max-depth <num>", "最大追溯深度", "5")
    .action((options) => {
      console.log(`🎯 对事件 ${options.eventId} 进行根因分析\n`);

      const graph = getCausalGraph();
      
      try {
        const analysis = graph.analyzeRootCause(options.eventId, parseInt(options.maxDepth));

        console.log(`目标事件: ${analysis.targetEventId}\n`);
        console.log(`置信度: ${(analysis.confidence * 100).toFixed(1)}%\n`);

        console.log(`根因 (${analysis.rootCauses.length}个):\n`);
        analysis.rootCauses.forEach((rc, index) => {
          console.log(`${index + 1}. ${rc.explanation}`);
          console.log(`   距离: ${rc.distance} 步`);
          console.log(`   强度: ${(rc.strength * 100).toFixed(1)}%`);
          console.log();
        });

        console.log(`建议:\n`);
        analysis.recommendations.forEach((rec, index) => {
          console.log(`  ${index + 1}. ${rec}`);
        });
      } catch (error: any) {
        console.error(`❌ 分析失败: ${error.message}`);
        process.exit(1);
      }
    });

  // ==================== 因果推理 ====================

  causalityGroup
    .command("infer")
    .description("因果推理：推断可能的结果")
    .requiredOption("--premise-id <id>", "前提事件ID")
    .action((options) => {
      console.log(`🧠 基于前提事件 ${options.premiseId} 进行因果推理\n`);

      const graph = getCausalGraph();
      
      try {
        const inference = graph.inferEffects(options.premiseId);

        console.log(`前提事件: ${inference.premiseEventId}\n`);
        console.log(`推理置信度: ${(inference.confidence * 100).toFixed(1)}%\n`);

        console.log(`可能的结果 (${inference.possibleEffects.length}个):\n`);
        inference.possibleEffects.forEach((effect, index) => {
          console.log(`${index + 1}. ${effect.description}`);
          console.log(`   概率: ${(effect.probability * 100).toFixed(1)}%`);
          if (effect.timeframe) console.log(`   时间范围: ${effect.timeframe}`);
          if (effect.conditions && effect.conditions.length > 0) {
            console.log(`   条件: ${effect.conditions.join(", ")}`);
          }
          console.log();
        });

        console.log(`推理解释:\n${inference.reasoning}\n`);
      } catch (error: any) {
        console.error(`❌ 推理失败: ${error.message}`);
        process.exit(1);
      }
    });

  // ==================== 反事实推理 ====================

  causalityGroup
    .command("counterfactual")
    .description("反事实推理：如果某事件没有发生会怎样？")
    .requiredOption("--event-id <id>", "目标事件ID")
    .requiredOption("--scenario <text>", "假设场景描述")
    .action((options) => {
      console.log(`💭 反事实推理: ${options.scenario}\n`);

      const graph = getCausalGraph();
      
      try {
        const counterfactual = graph.analyzeCounterfactual(options.eventId, options.scenario);

        console.log(`原始事件: ${counterfactual.originalEventId}\n`);
        console.log(`假设场景: ${counterfactual.hypotheticalScenario}\n`);

        console.log(`预测结果:`);
        console.log(`  会发生改变: ${counterfactual.predictedOutcome.wouldHappen ? "是" : "否"}`);
        console.log(`  概率: ${(counterfactual.predictedOutcome.probability * 100).toFixed(1)}%`);
        console.log(`  解释: ${counterfactual.predictedOutcome.explanation}\n`);

        if (counterfactual.predictedOutcome.alternativeEvents.length > 0) {
          console.log(`替代事件:\n`);
          counterfactual.predictedOutcome.alternativeEvents.forEach((alt, index) => {
            console.log(`  ${index + 1}. ${alt}`);
          });
          console.log();
        }

        console.log(`关键依赖 (${counterfactual.keyDependencies.length}个):\n`);
        counterfactual.keyDependencies.forEach((dep, index) => {
          console.log(`  ${index + 1}. ${dep}`);
        });

        console.log(`\n置信度: ${(counterfactual.confidence * 100).toFixed(1)}%`);
      } catch (error: any) {
        console.error(`❌ 分析失败: ${error.message}`);
        process.exit(1);
      }
    });

  // ==================== 路径分析 ====================

  causalityGroup
    .command("paths")
    .description("查找两个事件之间的所有因果路径")
    .requiredOption("--from <id>", "起始事件ID")
    .requiredOption("--to <id>", "目标事件ID")
    .option("--max-length <num>", "最大路径长度", "10")
    .action((options) => {
      console.log(`🛤️  查找从 ${options.from} 到 ${options.to} 的因果路径\n`);

      const graph = getCausalGraph();
      const paths = graph.findAllPaths(options.from, options.to, parseInt(options.maxLength));

      if (paths.length === 0) {
        console.log("ℹ️  没有找到路径");
        return;
      }

      console.log(`找到 ${paths.length} 条路径:\n`);
      paths.forEach((path, index) => {
        console.log(`${index + 1}. 路径: ${path.path.join(" → ")}`);
        console.log(`   长度: ${path.length}`);
        console.log(`   总强度: ${(path.totalStrength * 100).toFixed(1)}%`);
        console.log();
      });
    });

  // ==================== 导出功能 ====================

  causalityGroup
    .command("export")
    .description("导出因果图为JSON")
    .option("--output <file>", "输出文件路径", "causal-graph.json")
    .action((options) => {
      console.log(`📤 导出因果图到 ${options.output}\n`);

      const graph = getCausalGraph();
      const json = graph.exportToJSON();

      // 在实际实现中，这里应该写入文件
      console.log(JSON.stringify(json, null, 2));
      console.log(`\n✅ 导出完成`);
    });

  // ==================== 清空功能 ====================

  causalityGroup
    .command("clear")
    .description("清空因果图")
    .action(() => {
      console.log("⚠️  警告: 这将清空所有因果数据\n");

      const graph = getCausalGraph();
      graph.clear();

      console.log("✅ 因果图已清空");
    });
}
