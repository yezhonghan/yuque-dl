import type { PaperFormat } from 'puppeteer-core'

export interface IPdfExportOptions {
  /** PDF 输出文件路径，默认在知识库同级或目录下生成 <bookName>.pdf */
  outputPath?: string
  /** 知识库名称 */
  bookName?: string
  /** 知识库简介 */
  bookDesc?: string
  /** 浏览器可执行文件路径，未指定时自动探测系统 Chrome / Edge */
  executablePath?: string
  /** 纸张尺寸，默认 A4 */
  format?: PaperFormat
  /** 页边距 */
  margin?: {
    top?: string
    bottom?: string
    left?: string
    right?: string
  }
  /** 是否展示页眉页脚（页码等），默认 true */
  displayHeaderFooter?: boolean
  /** 是否包含封面页，默认 true */
  includeCover?: boolean
  /** 是否包含目录页，默认 true */
  includeToc?: boolean
}

export interface IPdfDocItem {
  uuid: string
  title: string
  type: 'TITLE' | 'DOC' | 'LINK'
  level: number
  /** 相对路径，如 "球友必看内容_xxx/xxx.md" */
  relativePath?: string
  /** 绝对路径 */
  absolutePath?: string
  /** 对应所属目录的绝对路径，用于解析图片相对路径 */
  dirPath?: string
}

export interface IPdfTocNode {
  uuid: string
  title: string
  type: 'TITLE' | 'DOC' | 'LINK'
  level: number
  item?: IPdfDocItem
  children: IPdfTocNode[]
}
