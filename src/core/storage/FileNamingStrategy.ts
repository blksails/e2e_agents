/**
 * 文件命名策略
 * 负责生成符合规范的文件名和目录名
 */
export class FileNamingStrategy {
  /**
   * 生成时间戳目录名
   * 格式: 2026-01-11T10-30-00Z
   */
  static generateTimestampDir(): string {
    return new Date().toISOString().replace(/:/g, "-").split(".")[0] + "Z";
  }

  /**
   * 生成索引文件名
   * @param prefix 前缀 (如 'scan', 'metadata')
   * @param index 索引号
   * @param extension 文件扩展名
   */
  static generateIndexedFileName(
    prefix: string,
    index: number,
    extension: string,
  ): string {
    const paddedIndex = String(index).padStart(3, "0");
    return `${prefix}_${paddedIndex}.${extension}`;
  }

  /**
   * 清理文件名（移除非法字符）
   */
  static sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_");
  }

  /**
   * 生成工作流文件名
   */
  static generateWorkflowFileName(workflowName: string): string {
    const sanitized = this.sanitizeFileName(workflowName);
    return `workflow_${sanitized}`;
  }
}
