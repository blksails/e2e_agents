import { Page } from "playwright";
import { ElementInfo } from "../../types/schemas";

/**
 * 元素提取器
 * 从页面中提取可交互元素的信息
 */
export class ElementExtractor {
  /**
   * 提取页面中的所有交互元素
   */
  async extractElements(page: Page): Promise<ElementInfo[]> {
    const elements = await page.evaluate(() => {
      const results: any[] = [];

      // 选择所有可交互元素
      const selectors = [
        "button",
        "a",
        "input",
        "textarea",
        "select",
        '[role="button"]',
        '[role="link"]',
        "[onclick]",
        "form",
      ];

      const allElements = document.querySelectorAll(selectors.join(", "));

      allElements.forEach((el) => {
        const rect = el.getBoundingClientRect();

        // 只提取可见的元素
        if (rect.width > 0 && rect.height > 0) {
          const element = el as HTMLElement;

          // 生成唯一的 CSS 选择器
          const selector = generateSelector(element);

          // 提取属性
          const attributes: Record<string, string> = {};
          for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            if (attr) {
              attributes[attr.name] = attr.value!;
            }
          }

          // 判断元素类型
          const elementType = getElementType(element);

          results.push({
            selector,
            tagName: element.tagName.toLowerCase(),
            text: element.textContent?.trim().substring(0, 100) || undefined,
            attributes,
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            isInteractive: true,
            elementType,
          });
        }
      });

      // 辅助函数：生成选择器
      function generateSelector(element: Element): string {
        if (element.id) {
          return "#" + element.id;
        }

        if (element.className && typeof element.className === "string") {
          const classes = element.className.trim().split(/\s+/).join(".");
          if (classes) {
            return element.tagName.toLowerCase() + "." + classes;
          }
        }

        // 使用 nth-child
        let path = element.tagName.toLowerCase();
        const parent = element.parentElement;

        if (parent) {
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(element) + 1;
          path =
            parent.tagName.toLowerCase() +
            " > " +
            path +
            ":nth-child(" +
            index +
            ")";
        }

        return path;
      }

      // 辅助函数：判断元素类型
      function getElementType(element: HTMLElement): string {
        const tag = element.tagName.toLowerCase();

        if (tag === "button" || element.getAttribute("role") === "button") {
          return "button";
        }
        if (tag === "a") {
          return "link";
        }
        if (tag === "input" || tag === "textarea" || tag === "select") {
          return "input";
        }
        if (tag === "form") {
          return "form";
        }
        if (tag === "img") {
          return "image";
        }
        if (
          ["p", "span", "div", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)
        ) {
          return "text";
        }

        return "other";
      }

      return results;
    });

    return elements;
  }

  /**
   * 提取特定类型的元素
   */
  async extractElementsByType(
    page: Page,
    type: "button" | "input" | "link" | "form",
  ): Promise<ElementInfo[]> {
    const allElements = await this.extractElements(page);
    return allElements.filter((el) => el.elementType === type);
  }

  /**
   * 提取页面中的所有链接
   */
  async extractLinks(
    page: Page,
  ): Promise<Array<{ text: string; href: string }>> {
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a[href]"));
      return links.map((link) => ({
        text: (link as HTMLElement).textContent?.trim() || "",
        href: (link as HTMLAnchorElement).href,
      }));
    });
  }

  /**
   * 提取页面中的所有表单
   */
  async extractForms(page: Page): Promise<
    Array<{
      action: string;
      method: string;
      fields: Array<{ name: string; type: string; required: boolean }>;
    }>
  > {
    return await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll("form"));
      return forms.map((form) => {
        const fields = Array.from(
          form.querySelectorAll("input, textarea, select"),
        ).map((field) => ({
          name:
            (field as HTMLInputElement).name ||
            (field as HTMLInputElement).id ||
            "",
          type: (field as HTMLInputElement).type || field.tagName.toLowerCase(),
          required: (field as HTMLInputElement).required || false,
        }));

        return {
          action: (form as HTMLFormElement).action,
          method: (form as HTMLFormElement).method,
          fields,
        };
      });
    });
  }
}
