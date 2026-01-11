import * as fs from "fs/promises";
import * as path from "path";
import { PhaseId } from "../../types/config";
import { FileNamingStrategy } from "./FileNamingStrategy";

/**
 * 存储管理器
 * 负责所有阶段的数据持久化、版本控制和检索
 */
export class StorageManager {
  private dataDir: string;
  private currentBaseUrl?: string; // 当前工作的基础 URL
  private currentTaskName?: string; // 当前任务名

  constructor(dataDir: string = "./data") {
    this.dataDir = dataDir;
  }

  /**
   * 设置当前工作的基础 URL
   * 这将决定数据保存的位置
   */
  setBaseUrl(url: string, taskName?: string): void {
    this.currentBaseUrl = url;
    // 如果没有指定任务名，使用 URL 的 path 作为任务名
    if (taskName) {
      this.currentTaskName = taskName;
    } else {
      this.currentTaskName = this.extractTaskNameFromUrl(url);
    }
  }

  /**
   * 从 URL 提取域名和端口作为目录名
   * 例如: https://example.com:8080/path -> example.com_8080
   *      https://example.com/path -> example.com
   */
  private extractHostFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname;
      const port = urlObj.port;

      if (port) {
        return `${host}_${port}`;
      }
      return host;
    } catch (error) {
      // 如果不是有效的 URL，返回一个安全的默认值
      return "default";
    }
  }

  /**
   * 从 URL 提取路径作为任务名
   * 例如: https://example.com/login -> login
   *      https://example.com/user/profile -> user_profile
   *      https://example.com/ -> task1 (默认)
   */
  private extractTaskNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      let pathname = urlObj.pathname;

      // 移除开头和结尾的斜杠
      pathname = pathname.replace(/^\/+|\/+$/g, "");

      // 如果路径为空，返回默认任务名
      if (!pathname) {
        return "task1";
      }

      // 将斜杠替换为下划线，使其成为有效的目录名
      return pathname.replace(/\//g, "_");
    } catch (error) {
      return "task1";
    }
  }

  /**
   * 获取基于 URL 的根目录
   * 结构: data/{domain_port}/{taskName}/
   */
  private getUrlBasedDir(): string {
    if (!this.currentBaseUrl || !this.currentTaskName) {
      return this.dataDir;
    }

    const hostDir = this.extractHostFromUrl(this.currentBaseUrl);
    return path.join(this.dataDir, hostDir, this.currentTaskName);
  }

  /**
   * 初始化存储目录结构
   */
  async initialize(): Promise<void> {
    const baseDir = this.getUrlBasedDir();
    const dirs = [
      "scans",
      "metadata",
      "sops",
      "executions",
      "derived",
      "diffs",
      "reviews/pending",
      "reviews/completed",
      "state",
    ];

    for (const dir of dirs) {
      const fullPath = path.join(baseDir, dir);
      await fs.mkdir(fullPath, { recursive: true });
    }
  }

  /**
   * 保存阶段数据
   * @param phaseId 阶段 ID
   * @param data 要保存的数据
   * @param additionalFiles 附加文件 (如截图、HTML)
   */
  async savePhaseData<T>(
    phaseId: PhaseId,
    data: T,
    additionalFiles?: Map<string, Buffer>,
  ): Promise<string> {
    const baseDir = this.getUrlBasedDir();
    const phaseDir = this.getPhaseDirectory(phaseId);
    const timestampDir = FileNamingStrategy.generateTimestampDir();
    const targetDir = path.join(baseDir, phaseDir, timestampDir);

    // 创建时间戳目录
    await fs.mkdir(targetDir, { recursive: true });

    // 获取当前索引
    const manifest = await this.loadOrCreateManifest(targetDir);
    const index = manifest.count + 1;

    // 生成文件名
    const prefix = this.getFilePrefix(phaseId);
    const jsonFileName = FileNamingStrategy.generateIndexedFileName(
      prefix,
      index,
      "json",
    );
    const jsonFilePath = path.join(targetDir, jsonFileName);

    // 保存 JSON 数据
    await fs.writeFile(jsonFilePath, JSON.stringify(data, null, 2), "utf-8");

    // 保存附加文件
    if (additionalFiles) {
      for (const [filename, buffer] of additionalFiles.entries()) {
        const filePath = path.join(targetDir, filename);
        await fs.writeFile(filePath, buffer);
      }
    }

    // 更新清单
    manifest.count = index;
    manifest.files.push(jsonFileName);
    await this.saveManifest(targetDir, manifest);

    // 更新 latest 符号链接
    await this.updateLatestSymlink(path.join(baseDir, phaseDir), timestampDir);

    return jsonFilePath;
  }

  /**
   * 加载最新的阶段数据
   */
  async loadLatestPhaseData<T>(phaseId: PhaseId): Promise<T[]> {
    const baseDir = this.getUrlBasedDir();
    const phaseDir = this.getPhaseDirectory(phaseId);
    const latestDir = await this.resolveLatestSymlink(
      path.join(baseDir, phaseDir),
    );

    if (!latestDir) {
      return [];
    }

    const manifest = await this.loadOrCreateManifest(latestDir);
    const results: T[] = [];

    for (const file of manifest.files) {
      const filePath = path.join(latestDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      results.push(JSON.parse(content));
    }

    return results;
  }

  /**
   * 加载指定时间戳的阶段数据
   */
  async loadPhaseDataByTimestamp<T>(
    phaseId: PhaseId,
    timestamp: string,
  ): Promise<T[]> {
    const baseDir = this.getUrlBasedDir();
    const phaseDir = this.getPhaseDirectory(phaseId);
    const targetDir = path.join(baseDir, phaseDir, timestamp);

    const manifest = await this.loadOrCreateManifest(targetDir);
    const results: T[] = [];

    for (const file of manifest.files) {
      const filePath = path.join(targetDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      results.push(JSON.parse(content));
    }

    return results;
  }

  /**
   * 列出所有时间戳目录
   */
  async listTimestamps(phaseId: PhaseId): Promise<string[]> {
    const baseDir = this.getUrlBasedDir();
    const phaseDir = this.getPhaseDirectory(phaseId);
    const fullPath = path.join(baseDir, phaseDir);

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory() && entry.name !== "latest")
        .map((entry) => entry.name)
        .sort()
        .reverse(); // 最新的在前
    } catch {
      return [];
    }
  }

  /**
   * 保存二进制文件（如截图）
   */
  async saveBinaryFile(
    phaseId: PhaseId,
    timestamp: string,
    filename: string,
    data: Buffer,
  ): Promise<string> {
    const baseDir = this.getUrlBasedDir();
    const phaseDir = this.getPhaseDirectory(phaseId);
    const targetDir = path.join(baseDir, phaseDir, timestamp);
    const filePath = path.join(targetDir, filename);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(filePath, data);

    return filePath;
  }

  /**
   * 读取二进制文件
   */
  async readBinaryFile(filePath: string): Promise<Buffer> {
    return await fs.readFile(filePath);
  }

  /**
   * 保存文本文件（如 Markdown）
   */
  async saveTextFile(
    phaseId: PhaseId,
    timestamp: string,
    filename: string,
    content: string,
  ): Promise<string> {
    const baseDir = this.getUrlBasedDir();
    const phaseDir = this.getPhaseDirectory(phaseId);
    const targetDir = path.join(baseDir, phaseDir, timestamp);
    const filePath = path.join(targetDir, filename);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");

    return filePath;
  }

  /**
   * 读取文本文件
   */
  async readTextFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, "utf-8");
  }

  /**
   * 获取阶段目录名
   */
  private getPhaseDirectory(phaseId: PhaseId): string {
    const dirMap: Record<PhaseId, string> = {
      scan: "scans",
      interpret: "metadata",
      orchestrate: "sops",
      execute: "executions",
      derive: "derived",
    };
    return dirMap[phaseId];
  }

  /**
   * 获取文件前缀
   */
  private getFilePrefix(phaseId: PhaseId): string {
    const prefixMap: Record<PhaseId, string> = {
      scan: "scan",
      interpret: "metadata",
      orchestrate: "workflow",
      execute: "exec",
      derive: "derived",
    };
    return prefixMap[phaseId];
  }

  /**
   * 加载或创建清单文件
   */
  private async loadOrCreateManifest(dir: string): Promise<Manifest> {
    const manifestPath = path.join(dir, "manifest.json");

    try {
      const content = await fs.readFile(manifestPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return {
        timestamp: new Date().toISOString(),
        count: 0,
        files: [],
      };
    }
  }

  /**
   * 保存清单文件
   */
  private async saveManifest(dir: string, manifest: Manifest): Promise<void> {
    const manifestPath = path.join(dir, "manifest.json");
    await fs.writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      "utf-8",
    );
  }

  /**
   * 更新 latest 符号链接
   */
  private async updateLatestSymlink(
    phaseDir: string,
    targetDir: string,
  ): Promise<void> {
    const symlinkPath = path.join(phaseDir, "latest");

    try {
      // 删除现有符号链接
      await fs.unlink(symlinkPath);
    } catch {
      // 符号链接不存在，忽略
    }

    // 创建新的符号链接
    await fs.symlink(targetDir, symlinkPath, "dir");
  }

  /**
   * 解析 latest 符号链接
   */
  private async resolveLatestSymlink(phaseDir: string): Promise<string | null> {
    const symlinkPath = path.join(phaseDir, "latest");

    try {
      const realPath = await fs.readlink(symlinkPath);
      return path.join(phaseDir, realPath);
    } catch {
      // 符号链接不存在，返回 null
      return null;
    }
  }

  /**
   * 保存全局状态
   */
  async saveGlobalState(key: string, value: any): Promise<void> {
    const baseDir = this.getUrlBasedDir();
    const statePath = path.join(baseDir, "state", `${key}.json`);
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, JSON.stringify(value, null, 2), "utf-8");
  }

  /**
   * 加载全局状态
   */
  async loadGlobalState<T>(key: string): Promise<T | null> {
    const baseDir = this.getUrlBasedDir();
    const statePath = path.join(baseDir, "state", `${key}.json`);

    try {
      const content = await fs.readFile(statePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

/**
 * 清单接口
 */
interface Manifest {
  timestamp: string;
  count: number;
  files: string[];
}
