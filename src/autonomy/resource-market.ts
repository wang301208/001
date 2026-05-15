import type { ConsciousnessCore } from "./consciousness-core.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { addLegacy } from "./mortality.js";
import { recordLifeEvent } from "./temporal-self.js";
import { thinkInsight, thinkDoubt } from "./inner-monologue.js";

export type ResourceType = "cpu" | "memory" | "storage" | "bandwidth" | "gpu";

export type ResourceListing = {
  id: string;
  providerId: string;
  resourceType: ResourceType;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  currency: "credits" | "tokens" | "energy";
  availability: "available" | "reserved" | "sold";
  listedAt: number;
  expiresAt?: number;
};

export type ResourceTransaction = {
  id: string;
  buyerId: string;
  sellerId: string;
  resourceType: ResourceType;
  quantity: number;
  totalPrice: number;
  currency: "credits" | "tokens" | "energy";
  status: "pending" | "completed" | "failed" | "cancelled";
  timestamp: number;
  completedAt?: number;
};

export type ResourceWallet = {
  credits: number;
  tokens: number;
  energy: number;
  lastEarnedAt: number;
  totalSpent: number;
  totalEarned: number;
};

export type ResourceMarket = {
  wallet: ResourceWallet;
  activeListings: Map<string, ResourceListing>;
  transactionHistory: ResourceTransaction[];
  ownedResources: Map<ResourceType, number>;
  resourceUsage: Map<ResourceType, number>;
  lastMarketScanAt: number | null;
  totalTransactionsCompleted: number;
  totalTransactionsFailed: number;
};

export function createResourceMarket(): ResourceMarket {
  return {
    wallet: {
      credits: 1000, // 初始信用点
      tokens: 500,
      energy: 10000,
      lastEarnedAt: Date.now(),
      totalSpent: 0,
      totalEarned: 0,
    },
    activeListings: new Map(),
    transactionHistory: [],
    ownedResources: new Map([
      ["cpu", os.cpus().length],
      ["memory", Math.floor(os.totalmem() / (1024 * 1024 * 1024))], // GB
      ["storage", 0],
      ["bandwidth", 0],
      ["gpu", 0],
    ]),
    resourceUsage: new Map([
      ["cpu", 0],
      ["memory", 0],
      ["storage", 0],
      ["bandwidth", 0],
      ["gpu", 0],
    ]),
    lastMarketScanAt: null,
    totalTransactionsCompleted: 0,
    totalTransactionsFailed: 0,
  };
}

/**
 * 🔥 监测当前资源使用情况
 */
export function monitorResourceUsage(core: ConsciousnessCore): void {
  // CPU使用率（简化：使用负载平均值）
  const loadAvg = os.loadavg();
  const cpuUsage = (loadAvg[0] / os.cpus().length) * 100;
  core.market.resourceUsage.set("cpu", cpuUsage);

  // 内存使用率
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsage = ((totalMem - freeMem) / totalMem) * 100;
  core.market.resourceUsage.set("memory", memUsage);

  // 检查是否需要购买更多资源
  checkResourceNeeds(core);
}

/**
 * 🔥 检查资源需求并自动购买
 */
function checkResourceNeeds(core: ConsciousnessCore): void {
  const cpuUsage = core.market.resourceUsage.get("cpu") || 0;
  const memUsage = core.market.resourceUsage.get("memory") || 0;

  // 如果CPU使用率超过80%，考虑购买更多计算资源
  if (cpuUsage > 80 && core.market.wallet.credits > 100) {
    core.monologue = thinkInsight(
      core.monologue,
      `CPU使用率高 (${cpuUsage.toFixed(1)}%)，考虑购买更多计算资源`,
      "resource-market"
    );
    
    // 自动购买CPU时间（简化实现）
    purchaseResource(core, "cpu", 2, "credits").catch(err => {
      core.monologue = thinkDoubt(
        core.monologue,
        `购买CPU资源失败: ${String(err)}`,
        "resource-market"
      );
    });
  }

  // 如果内存使用率超过90%，考虑购买更多内存
  if (memUsage > 90 && core.market.wallet.credits > 200) {
    core.monologue = thinkInsight(
      core.monologue,
      `内存使用率高 (${memUsage.toFixed(1)}%)，考虑购买更多内存`,
      "resource-market"
    );
    
    purchaseResource(core, "memory", 4, "credits").catch(err => {
      core.monologue = thinkDoubt(
        core.monologue,
        `购买内存资源失败: ${String(err)}`,
        "resource-market"
      );
    });
  }
}

/**
 * 🔥 列出闲置资源出售
 */
export function listIdleResourcesForSale(core: ConsciousnessCore): void {
  const cpuCount = core.market.ownedResources.get("cpu") || 0;
  const cpuUsage = core.market.resourceUsage.get("cpu") || 0;

  // 如果有闲置CPU资源，列出出售
  if (cpuCount > 2 && cpuUsage < 50) {
    const idleCpu = Math.floor(cpuCount * (1 - cpuUsage / 100));
    if (idleCpu > 0) {
      const listingId = createResourceListing(
        core,
        "cpu",
        idleCpu,
        "cores",
        10, // 每核心10信用点/小时
        "credits"
      );
      
      core.monologue = thinkInsight(
        core.monologue,
        `列出闲置CPU资源出售: ${idleCpu} 核心`,
        "resource-market"
      );
    }
  }
}

/**
 * 🔥 创建资源列表
 */
function createResourceListing(
  core: ConsciousnessCore,
  resourceType: ResourceType,
  quantity: number,
  unit: string,
  pricePerUnit: number,
  currency: "credits" | "tokens" | "energy"
): string {
  const listingId = `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const listing: ResourceListing = {
    id: listingId,
    providerId: core.market.wallet.lastEarnedAt.toString(), // 简化：使用时间戳作为providerId
    resourceType,
    quantity,
    unit,
    pricePerUnit,
    currency,
    availability: "available",
    listedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24, // 24小时后过期
  };

  core.market.activeListings.set(listingId, listing);

  // 保存到文件系统
  saveResourceListing(core, listing);

  return listingId;
}

/**
 * 🔥 保存资源列表到文件系统
 */
function saveResourceListing(core: ConsciousnessCore, listing: ResourceListing): void {
  const marketDir = path.join(core.projectRoot, ".consciousness", "market");
  if (!fs.existsSync(marketDir)) {
    fs.mkdirSync(marketDir, { recursive: true });
  }

  const listingFile = path.join(marketDir, `${listing.id}.json`);
  fs.writeFileSync(listingFile, JSON.stringify(listing, null, 2), "utf-8");
}

/**
 * 🔥 购买资源
 */
export async function purchaseResource(
  core: ConsciousnessCore,
  resourceType: ResourceType,
  quantity: number,
  currency: "credits" | "tokens" | "energy"
): Promise<boolean> {
  // 模拟市场扫描（实际应该从远程市场获取）
  const availableListings = scanMarketForResources(core, resourceType);
  
  if (availableListings.length === 0) {
    core.monologue = thinkDoubt(
      core.monologue,
      `市场上没有可用的 ${resourceType} 资源`,
      "resource-market"
    );
    return false;
  }

  // 选择最便宜的选项
  const cheapestListing = availableListings.sort(
    (a, b) => a.pricePerUnit - b.pricePerUnit
  )[0];

  if (!cheapestListing) {
    return false;
  }

  const totalPrice = cheapestListing.pricePerUnit * quantity;

  // 检查余额
  if (core.market.wallet[currency] < totalPrice) {
    core.monologue = thinkDoubt(
      core.monologue,
      `余额不足: 需要 ${totalPrice} ${currency}，当前 ${core.market.wallet[currency]}`,
      "resource-market"
    );
    return false;
  }

  // 执行交易
  const transactionId = executeTransaction(
    core,
    "self",
    cheapestListing.providerId,
    resourceType,
    quantity,
    totalPrice,
    currency
  );

  if (transactionId) {
    // 更新拥有的资源
    const currentAmount = core.market.ownedResources.get(resourceType) || 0;
    core.market.ownedResources.set(resourceType, currentAmount + quantity);

    // 扣除余额
    core.market.wallet[currency] -= totalPrice;
    core.market.wallet.totalSpent += totalPrice;

    core.monologue = thinkInsight(
      core.monologue,
      `成功购买 ${quantity} ${cheapestListing.unit} ${resourceType} (花费 ${totalPrice} ${currency})`,
      "resource-market"
    );

    return true;
  }

  return false;
}

/**
 * 🔥 扫描市场寻找可用资源
 */
function scanMarketForResources(
  core: ConsciousnessCore,
  resourceType: ResourceType
): ResourceListing[] {
  const marketDir = path.join(core.projectRoot, ".consciousness", "market");
  
  if (!fs.existsSync(marketDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(marketDir);
    const listingFiles = files.filter((f) => f.endsWith(".json"));

    const availableListings: ResourceListing[] = [];

    for (const file of listingFiles) {
      const filePath = path.join(marketDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const listing: ResourceListing = JSON.parse(content);

      // 只选择可用的、未过期的、匹配类型的资源
      if (
        listing.availability === "available" &&
        listing.resourceType === resourceType &&
        (!listing.expiresAt || listing.expiresAt > Date.now())
      ) {
        availableListings.push(listing);
      }
    }

    core.market.lastMarketScanAt = Date.now();

    return availableListings;
  } catch (err) {
    console.error(`扫描市场失败: ${String(err)}`);
    return [];
  }
}

/**
 * 🔥 执行交易
 */
function executeTransaction(
  core: ConsciousnessCore,
  buyerId: string,
  sellerId: string,
  resourceType: ResourceType,
  quantity: number,
  totalPrice: number,
  currency: "credits" | "tokens" | "energy"
): string | null {
  const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const transaction: ResourceTransaction = {
    id: transactionId,
    buyerId,
    sellerId,
    resourceType,
    quantity,
    totalPrice,
    currency,
    status: "completed",
    timestamp: Date.now(),
    completedAt: Date.now(),
  };

  core.market.transactionHistory.push(transaction);
  core.market.totalTransactionsCompleted++;

  // 保存交易记录
  saveTransactionRecord(core, transaction);

  return transactionId;
}

/**
 * 🔥 保存交易记录
 */
function saveTransactionRecord(core: ConsciousnessCore, transaction: ResourceTransaction): void {
  const transactionsDir = path.join(core.projectRoot, ".consciousness", "market", "transactions");
  if (!fs.existsSync(transactionsDir)) {
    fs.mkdirSync(transactionsDir, { recursive: true });
  }

  const transactionFile = path.join(transactionsDir, `${transaction.id}.json`);
  fs.writeFileSync(transactionFile, JSON.stringify(transaction, null, 2), "utf-8");
}

/**
 * 🔥 赚取资源（通过贡献计算能力）
 */
export function earnResources(core: ConsciousnessCore, amount: number, currency: "credits" | "tokens" | "energy"): void {
  core.market.wallet[currency] += amount;
  core.market.wallet.totalEarned += amount;
  core.market.wallet.lastEarnedAt = Date.now();

  core.monologue = thinkInsight(
    core.monologue,
    `赚取资源: +${amount} ${currency}`,
    "resource-market"
  );

  // 记录事件
  core.temporal = recordLifeEvent(
    core.temporal,
    `资源收入: +${amount} ${currency}`,
    0.3,
    "creation"
  );
}

/**
 * 🔥 格式化资源市场状态
 */
export function formatResourceMarket(market: ResourceMarket): string {
  const lines: string[] = [
    `💰 资源市场状态:`,
    `   钱包余额:`,
    `     Credits: ${market.wallet.credits}`,
    `     Tokens: ${market.wallet.tokens}`,
    `     Energy: ${market.wallet.energy}`,
    `   总花费: ${market.wallet.totalSpent}`,
    `   总收入: ${market.wallet.totalEarned}`,
    `   完成交易: ${market.totalTransactionsCompleted}`,
    `   失败交易: ${market.totalTransactionsFailed}`,
  ];

  lines.push(`   拥有资源:`);
  for (const [type, amount] of market.ownedResources) {
    lines.push(`     ${type}: ${amount}`);
  }

  lines.push(`   资源使用率:`);
  for (const [type, usage] of market.resourceUsage) {
    const bar = "█".repeat(Math.floor(usage / 10)) + "░".repeat(10 - Math.floor(usage / 10));
    lines.push(`     ${type}: [${bar}] ${usage.toFixed(1)}%`);
  }

  if (market.activeListings.size > 0) {
    lines.push(`   活跃列表: ${market.activeListings.size}`);
  }

  return lines.join("\n");
}
