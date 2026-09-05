import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import { PDF_STYLES } from './css'
import type { IPdfDocItem, IPdfExportOptions, IPdfTocNode } from './types'

interface IMarkdownEnv {
  currentDir?: string
  fileToUuidMap?: Map<string, string>
  [key: string]: any
}

/**
 * 创建并配置 MarkdownIt 实例
 */
function createMarkdownRenderer(): InstanceType<typeof MarkdownIt> {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true,
    highlight: (str, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre><code class="hljs language-${lang}">${
            hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
          }</code></pre>`
        } catch {}
      }
      return `<pre><code class="hljs">${escapeHtml(str)}</code></pre>`
    },
  })

  // 重写图片渲染：将相对路径转换为绝对 file:/// 协议路径
  const defaultImageRule =
    md.renderer.rules.image ||
    ((tokens: any[], idx: number, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options))

  md.renderer.rules.image = (tokens: any[], idx: number, options: any, env: any, self: any) => {
    const token = tokens[idx]
    const customEnv = env as IMarkdownEnv
    const srcIndex = token.attrIndex('src')
    if (srcIndex >= 0 && customEnv?.currentDir) {
      const rawSrc = token.attrs![srcIndex][1]
      if (
        !rawSrc.startsWith('http://') &&
        !rawSrc.startsWith('https://') &&
        !rawSrc.startsWith('data:') &&
        !rawSrc.startsWith('file://')
      ) {
        const cleanSrc = decodeURIComponent(rawSrc.split('?')[0].split('#')[0])
        const absImgPath = path.resolve(customEnv.currentDir, cleanSrc)
        if (fs.existsSync(absImgPath)) {
          token.attrs![srcIndex][1] = pathToFileURL(absImgPath).href
        }
      }
    }
    return defaultImageRule(tokens, idx, options, env, self)
  }

  // 重写链接渲染：将内部跨文档 Markdown 链接转换为 PDF 内部锚点跳转
  const defaultLinkRule =
    md.renderer.rules.link_open ||
    ((tokens: any[], idx: number, options: any, _env: any, self: any) => self.renderToken(tokens, idx, options))

  md.renderer.rules.link_open = (tokens: any[], idx: number, options: any, env: any, self: any) => {
    const token = tokens[idx]
    const customEnv = env as IMarkdownEnv
    const hrefIndex = token.attrIndex('href')
    if (hrefIndex >= 0 && customEnv?.fileToUuidMap && customEnv?.currentDir) {
      const rawHref = token.attrs![hrefIndex][1]
      if (
        !rawHref.startsWith('http://') &&
        !rawHref.startsWith('https://') &&
        !rawHref.startsWith('mailto:') &&
        !rawHref.startsWith('#')
      ) {
        const [filePathPart, hashPart] = rawHref.split('#')
        if (filePathPart.endsWith('.md') || filePathPart.endsWith('.MD')) {
          const cleanPath = decodeURIComponent(filePathPart)
          const targetAbsPath = path.resolve(customEnv.currentDir, cleanPath)
          const targetUuid = customEnv.fileToUuidMap.get(targetAbsPath)
          if (targetUuid) {
            token.attrs![hrefIndex][1] = `#doc-${targetUuid}${hashPart ? '-' + hashPart : ''}`
          }
        }
      }
    }
    return defaultLinkRule(tokens, idx, options, env, self)
  }

  return md
}

export const STATIC_RESOURCE_NAMES = new Set([
  'img',
  'imgs',
  'image',
  'images',
  'attachment',
  'attachments',
  'asset',
  'assets',
  'static',
  'public',
  '.vitepress',
  'node_modules',
  '.git',
])

/**
 * 校验是否为静态资源目录（如 img、attachments 等）
 */
export function isStaticResourceName(name?: string): boolean {
  if (!name) return false
  const lower = name.toLowerCase().trim()
  if (STATIC_RESOURCE_NAMES.has(lower)) return true
  if (/^(img|images|attachments|assets)[_-]/i.test(lower)) return true
  return false
}

/**
 * 从知识库目录加载文档列表及目录结构
 */
export function loadBookDocuments(bookPath: string): {
  bookTitle: string
  bookDesc: string
  items: IPdfDocItem[]
  tocNodes: IPdfTocNode[]
  fileToUuidMap: Map<string, string>
} {
  const resolvedBookPath = path.resolve(bookPath)
  const defaultTitle = path.basename(resolvedBookPath)
  let bookTitle = defaultTitle
  let bookDesc = ''

  const progressJsonPath = path.join(resolvedBookPath, 'progress.json')
  const indexMdPath = path.join(resolvedBookPath, 'index.md')

  const items: IPdfDocItem[] = []
  const fileToUuidMap = new Map<string, string>()
  const rawTocNodes: IPdfTocNode[] = []

  // 1. 优先读取 progress.json
  if (fs.existsSync(progressJsonPath)) {
    try {
      const raw = fs.readFileSync(progressJsonPath, 'utf8')
      const progressData: any[] = JSON.parse(raw)

      // 构建 uuid 节点映射
      const nodeMap = new Map<string, IPdfTocNode>()

      for (const p of progressData) {
        const toc = p.toc || {}
        const uuid = toc.uuid || p.pathIdList?.at(-1) || String(toc.id || Math.random().toString(36).slice(2))
        const title = toc.title || p.pathTitleList?.at(-1) || '未命名文档'
        const rawTitle = p.rawPathTitleList?.at(-1) || title

        // 严格跳过静态资源目录（如 img、attachments 等）
        if (
          isStaticResourceName(title) ||
          isStaticResourceName(rawTitle) ||
          (p.path && (p.path === 'img' || p.path.startsWith('img/') || isStaticResourceName(p.path)))
        ) {
          continue
        }

        const type: 'TITLE' | 'DOC' | 'LINK' = (toc.type || 'DOC').toUpperCase()
        const level = typeof toc.level === 'number' ? toc.level : (p.pathTitleList?.length ? p.pathTitleList.length - 1 : 0)

        let relativePath: string | undefined
        let absolutePath: string | undefined
        let dirPath: string | undefined

        if (p.path && (type === 'DOC' || p.path.endsWith('.md'))) {
          const rel = p.path.endsWith('.md') ? p.path : `${p.path}.md`
          relativePath = rel
          const candidateAbsPath = path.resolve(resolvedBookPath, rel)
          if (fs.existsSync(candidateAbsPath)) {
            absolutePath = candidateAbsPath
            dirPath = path.dirname(candidateAbsPath)
          } else {
            // 尝试直接用 p.path
            const directPath = path.resolve(resolvedBookPath, p.path)
            if (fs.existsSync(directPath)) {
              absolutePath = directPath
              dirPath = path.dirname(directPath)
            }
          }
        }

        const docItem: IPdfDocItem = {
          uuid,
          title,
          type,
          level,
          relativePath,
          absolutePath,
          dirPath,
        }

        items.push(docItem)

        if (absolutePath) {
          fileToUuidMap.set(absolutePath, uuid)
          // 同时记录不带扩展名以及相对路径映射
          fileToUuidMap.set(absolutePath.replace(/\.md$/i, ''), uuid)
          if (relativePath) {
            fileToUuidMap.set(relativePath, uuid)
          }
        }

        const tocNode: IPdfTocNode = {
          uuid,
          title,
          type,
          level,
          item: docItem,
          children: [],
        }
        nodeMap.set(uuid, tocNode)

        const parentUuid = toc.parent_uuid
        if (parentUuid && nodeMap.has(parentUuid)) {
          nodeMap.get(parentUuid)!.children.push(tocNode)
        } else {
          rawTocNodes.push(tocNode)
        }
      }
    } catch (e) {
      // 容错处理
    }
  }

  // 若通过 index.md 提取描述或标题
  if (fs.existsSync(indexMdPath)) {
    try {
      const indexMd = fs.readFileSync(indexMdPath, 'utf8')
      const firstH1 = indexMd.match(/^#\s+(.+)$/m)
      if (firstH1 && firstH1[1]) {
        bookTitle = firstH1[1].trim()
      }
      const descMatch = indexMd.match(/^>\s+(.+)$/m)
      if (descMatch && descMatch[1]) {
        bookDesc = descMatch[1].trim()
      }

      // 如果 items 为空（缺少 progress.json），从 index.md 解析文档链接
      if (items.length === 0) {
        const linkRegex = /^\s*[-*]\s+\[([^\]]+)\]\(([^)]+)\)/gm
        let match: RegExpExecArray | null
        let counter = 0
        while ((match = linkRegex.exec(indexMd)) !== null) {
          counter++
          const title = match[1].trim()
          const rawLink = match[2].trim()

          // 忽略静态资源
          if (isStaticResourceName(title) || isStaticResourceName(rawLink)) {
            continue
          }

          const cleanLink = decodeURIComponent(rawLink.split('#')[0])
          const absPath = path.resolve(resolvedBookPath, cleanLink)
          const uuid = `doc-${counter}`

          if (fs.existsSync(absPath)) {
            const docItem: IPdfDocItem = {
              uuid,
              title,
              type: 'DOC',
              level: 1,
              relativePath: cleanLink,
              absolutePath: absPath,
              dirPath: path.dirname(absPath),
            }
            items.push(docItem)
            fileToUuidMap.set(absPath, uuid)
            rawTocNodes.push({
              uuid,
              title,
              type: 'DOC',
              level: 1,
              item: docItem,
              children: [],
            })
          }
        }
      }
    } catch {}
  }

  // 若依然没有任何文档，扫描当前目录下的所有 .md 文件
  if (items.length === 0) {
    const scanDir = (dir: string, currentLevel = 0) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') || isStaticResourceName(entry.name)) continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(fullPath, currentLevel + 1)
        } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'index.md') {
          const uuid = `scan-${items.length + 1}`
          const title = entry.name.replace(/\.md$/, '').replace(/_[a-zA-Z0-9-]+$/, '')
          if (isStaticResourceName(title)) continue
          const docItem: IPdfDocItem = {
            uuid,
            title,
            type: 'DOC',
            level: currentLevel,
            relativePath: path.relative(resolvedBookPath, fullPath),
            absolutePath: fullPath,
            dirPath: path.dirname(fullPath),
          }
          items.push(docItem)
          fileToUuidMap.set(fullPath, uuid)
          rawTocNodes.push({
            uuid,
            title,
            type: 'DOC',
            level: currentLevel,
            item: docItem,
            children: [],
          })
        }
      }
    }
    scanDir(resolvedBookPath)
  }

  // 剪枝目录树：剔除静态资源目录以及无文档的空分类
  const tocNodes = pruneTocNodes(rawTocNodes)

  // 收集有效文档与分类 UUID
  const validUuids = new Set<string>()
  const collectUuids = (nodes: IPdfTocNode[]) => {
    for (const n of nodes) {
      validUuids.add(n.uuid)
      if (n.children && n.children.length > 0) {
        collectUuids(n.children)
      }
    }
  }
  collectUuids(tocNodes)

  // 仅保留有效文档与分类
  const validItems = items.filter((item) => validUuids.has(item.uuid) && !isStaticResourceName(item.title))

  return {
    bookTitle,
    bookDesc,
    items: validItems,
    tocNodes,
    fileToUuidMap,
  }
}

/**
 * 递归剪枝目录树：剔除静态资源目录与没有真实文档的空目录
 */
function pruneTocNodes(nodes: IPdfTocNode[]): IPdfTocNode[] {
  const result: IPdfTocNode[] = []
  for (const node of nodes) {
    if (isStaticResourceName(node.title)) {
      continue
    }
    if (node.children && node.children.length > 0) {
      node.children = pruneTocNodes(node.children)
    }
    // 如果是文档，且文件实际存在于磁盘，保留
    if (node.type === 'DOC' && node.item?.absolutePath && fs.existsSync(node.item.absolutePath)) {
      result.push(node)
    } else if (node.children && node.children.length > 0) {
      // 如果是分类目录且拥有有效子文档，保留
      result.push(node)
    }
  }
  return result
}

/**
 * 递归生成目录 HTML
 */
function renderTocHtml(nodes: IPdfTocNode[]): string {
  let html = '<ul class="toc-list">\n'
  for (const node of nodes) {
    const levelClass = `toc-level-${Math.min(node.level, 3)}`
    if (node.type === 'TITLE' && !node.item?.absolutePath) {
      html += `  <li class="toc-item ${levelClass}">\n`
      html += `    <span class="toc-tag">目录</span>\n`
      html += `    <a href="#cat-${node.uuid}" class="toc-link"><strong>${escapeHtml(node.title)}</strong></a>\n`
      html += `    <span class="toc-dots"></span>\n`
      html += `  </li>\n`
    } else {
      html += `  <li class="toc-item ${levelClass}">\n`
      html += `    <a href="#doc-${node.uuid}" class="toc-link">${escapeHtml(node.title)}</a>\n`
      html += `    <span class="toc-dots"></span>\n`
      html += `  </li>\n`
    }
    if (node.children && node.children.length > 0) {
      html += renderTocHtml(node.children)
    }
  }
  html += '</ul>\n'
  return html
}

/**
 * 调整 Markdown 内容中的标题等级，确保生成的 PDF 大纲（Bookmarks）层级清晰
 */
function adjustHeadingLevels(mdText: string, offset = 1): string {
  return mdText.replace(/^(#{1,5})\s+(.+)$/gm, (_, hashes, text) => {
    const newHashes = '#'.repeat(hashes.length + offset)
    return `${newHashes} ${text}`
  })
}

/**
 * 处理富文本中的 <img src="./img/..." /> 本地图片路径
 */
function fixHtmlImgTags(html: string, currentDir: string): string {
  return html.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (match, prefix, rawSrc, suffix) => {
    if (
      !rawSrc.startsWith('http://') &&
      !rawSrc.startsWith('https://') &&
      !rawSrc.startsWith('data:') &&
      !rawSrc.startsWith('file://')
    ) {
      const cleanSrc = decodeURIComponent(rawSrc.split('?')[0].split('#')[0])
      const absImgPath = path.resolve(currentDir, cleanSrc)
      if (fs.existsSync(absImgPath)) {
        const fileUrl = pathToFileURL(absImgPath).href
        return `<img ${prefix}src="${fileUrl}"${suffix}>`
      }
    }
    return match
  })
}

/**
 * 将整套知识库构建为单一完整的 HTML 页面
 */
export function buildBookHtml(bookPath: string, options?: IPdfExportOptions): string {
  const { bookTitle, bookDesc, items, tocNodes, fileToUuidMap } = loadBookDocuments(bookPath)
  const title = options?.bookName || bookTitle
  const desc = options?.bookDesc || bookDesc
  const mdRenderer = createMarkdownRenderer()

  const docCount = items.filter((it) => it.type === 'DOC' && it.absolutePath).length
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  let bodyHtml = ''

  // 1. 封面页
  if (options?.includeCover !== false) {
    bodyHtml += `
    <div class="cover-container" id="cover-page">
      <div class="cover-badge">语雀知识库导出文档</div>
      <h1 class="cover-title">${escapeHtml(title)}</h1>
      ${desc ? `<div class="cover-desc">${escapeHtml(desc)}</div>` : ''}
      <div class="cover-meta">
        <div class="cover-meta-item">文档总数: <span>${docCount} 篇</span></div>
        <div class="cover-meta-item">导出时间: <span>${dateStr}</span></div>
      </div>
    </div>
    `
  }

  // 2. 目录页（带返回顶部定位）
  if (options?.includeToc !== false && tocNodes.length > 0) {
    bodyHtml += `
    <div class="toc-container" id="toc-top">
      <h1 class="toc-header">目录导航</h1>
      ${renderTocHtml(tocNodes)}
    </div>
    `
  }

  // 3. 正文章节
  for (const item of items) {
    if (item.type === 'TITLE' && !item.absolutePath) {
      // 纯分类目录
      bodyHtml += `
      <div class="category-header-section" id="cat-${item.uuid}">
        <h1 class="category-header-title">${escapeHtml(item.title)}</h1>
      </div>
      `
      continue
    }

    if (!item.absolutePath || !fs.existsSync(item.absolutePath)) {
      continue
    }

    try {
      const rawMd = fs.readFileSync(item.absolutePath, 'utf8')
      const currentDir = item.dirPath || path.dirname(item.absolutePath)
      const env: any = {
        currentDir,
        fileToUuidMap,
      }

      // 如果正文中已带有 '# 标题'，为避免与正文大标题重复，将其降级为 h3，正文大标题使用 h2 形成完美 PDF 书签树
      const adjustedMd = adjustHeadingLevels(rawMd, 1)
      let renderedContent = mdRenderer.render(adjustedMd, env)
      renderedContent = fixHtmlImgTags(renderedContent, currentDir)

      bodyHtml += `
      <section class="article-section" id="doc-${item.uuid}">
        <div class="article-meta">
          <a href="#toc-top" class="back-to-toc">↑ 返回目录</a>
          <span>文档: ${escapeHtml(item.title)}</span>
        </div>
        <h2 class="article-title" id="heading-${item.uuid}">${escapeHtml(item.title)}</h2>
        <div class="article-body">
          ${renderedContent}
        </div>
      </section>
      `
    } catch (err: any) {
      bodyHtml += `
      <section class="article-section" id="doc-${item.uuid}">
        <h2 class="article-title">${escapeHtml(item.title)}</h2>
        <p style="color: red;">文档解析异常: ${escapeHtml(err.message)}</p>
      </section>
      `
    }
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${PDF_STYLES}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`
}

/**
 * 将单个 Markdown 文件构建为独立的 HTML 页面
 */
export function buildSingleDocHtml(filePath: string, options?: IPdfExportOptions): string {
  const resolvedPath = path.resolve(filePath)
  const currentDir = path.dirname(resolvedPath)
  const title = options?.bookName || path.basename(resolvedPath).replace(/\.md$/i, '')
  const mdRenderer = createMarkdownRenderer()

  const rawMd = fs.readFileSync(resolvedPath, 'utf8')
  const env: any = {
    currentDir,
    fileToUuidMap: new Map(),
  }

  let renderedContent = mdRenderer.render(rawMd, env)
  renderedContent = fixHtmlImgTags(renderedContent, currentDir)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${PDF_STYLES}
  </style>
</head>
<body>
  <section class="article-section" style="page-break-before: auto;">
    <h1 class="article-title">${escapeHtml(title)}</h1>
    <div class="article-body">
      ${renderedContent}
    </div>
  </section>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
