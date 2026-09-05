/**
 * PDF 排版与打印样式表（保留语雀排版、支持代码高亮与 A4 优雅分页）
 */
export const PDF_STYLES = `
/* ==================== 基础与排版设置 ==================== */
*, *::before, *::after {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  background-color: #ffffff;
  color: #24292f;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.75;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

@page {
  size: A4;
  margin: 16mm 14mm 16mm 14mm;
}

@media print {
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}

/* ==================== 封面页 ==================== */
.cover-container {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 60px 20px;
  page-break-after: always;
  break-after: always;
}

.cover-badge {
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  color: #1677ff;
  background: #e6f4ff;
  border: 1px solid #91caff;
  padding: 4px 14px;
  border-radius: 20px;
  margin-bottom: 24px;
  letter-spacing: 0.5px;
}

.cover-title {
  font-size: 34px;
  font-weight: 800;
  color: #1f2328;
  line-height: 1.35;
  margin: 0 0 20px 0;
  max-width: 800px;
}

.cover-desc {
  font-size: 15px;
  color: #57606a;
  line-height: 1.6;
  max-width: 650px;
  margin: 0 0 50px 0;
}

.cover-meta {
  border-top: 1px solid #d0d7de;
  padding-top: 24px;
  display: flex;
  gap: 32px;
  color: #656d76;
  font-size: 13px;
}

.cover-meta-item span {
  font-weight: 600;
  color: #24292f;
}

/* ==================== 目录页 ==================== */
.toc-container {
  padding: 20px 0;
  page-break-after: always;
  break-after: always;
}

.toc-header {
  font-size: 26px;
  font-weight: 700;
  color: #1f2328;
  margin: 0 0 24px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid #1677ff;
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-item {
  margin: 6px 0;
  display: flex;
  align-items: baseline;
  line-height: 1.5;
}

.toc-level-0 {
  font-size: 16px;
  font-weight: 700;
  color: #1f2328;
  margin-top: 18px;
  margin-bottom: 8px;
}

.toc-level-1 {
  font-size: 14px;
  padding-left: 18px;
}

.toc-level-2 {
  font-size: 13.5px;
  padding-left: 36px;
  color: #424a53;
}

.toc-level-3 {
  font-size: 13px;
  padding-left: 54px;
  color: #656d76;
}

.toc-link {
  color: #0969da;
  text-decoration: none;
  transition: color 0.15s;
}

.toc-link:hover {
  text-decoration: underline;
}

.toc-dots {
  flex: 1;
  border-bottom: 1px dotted #d0d7de;
  margin: 0 10px;
  min-width: 20px;
}

.toc-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f6f8fa;
  color: #656d76;
  border: 1px solid #d0d7de;
  margin-right: 8px;
  font-weight: 500;
}

/* ==================== 正文与章节分页控制 ==================== */
.article-section {
  page-break-before: always;
  break-before: always;
  padding-top: 10px;
}

.category-header-section {
  page-break-before: always;
  break-before: always;
  padding: 40px 0 20px 0;
  border-bottom: 2px solid #0969da;
  margin-bottom: 24px;
}

.category-header-title {
  font-size: 26px;
  font-weight: 800;
  color: #0969da;
  margin: 0;
}

.article-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2328;
  margin: 0 0 16px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid #d0d7de;
  line-height: 1.35;
}

.article-meta {
  font-size: 12px;
  color: #656d76;
  margin-bottom: 20px;
  padding: 8px 12px;
  background: #f6f8fa;
  border-radius: 6px;
}

.back-to-toc {
  float: right;
  font-size: 12px;
  color: #0969da;
  text-decoration: none;
  font-weight: normal;
}

/* ==================== Markdown 内容排版 ==================== */
h1, h2, h3, h4, h5, h6 {
  color: #1f2328;
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 14px;
  line-height: 1.4;
  page-break-after: avoid;
  break-after: avoid;
}

h1 { font-size: 20px; }
h2 { font-size: 18px; }
h3 { font-size: 16px; }
h4 { font-size: 15px; }
h5 { font-size: 14px; }
h6 { font-size: 13px; }

p {
  margin: 12px 0;
  word-wrap: break-word;
}

a {
  color: #0969da;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* 引用块 */
blockquote {
  margin: 16px 0;
  padding: 10px 16px;
  color: #57606a;
  background: #f6f8fa;
  border-left: 4px solid #1677ff;
  border-radius: 0 6px 6px 0;
  page-break-inside: avoid;
  break-inside: avoid;
}

blockquote p {
  margin: 6px 0;
}

/* 列表 */
ul, ol {
  padding-left: 24px;
  margin: 12px 0;
}

li {
  margin: 4px 0;
}

/* 表格 */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 13px;
  page-break-inside: avoid;
  break-inside: avoid;
}

th, td {
  border: 1px solid #d0d7de;
  padding: 8px 12px;
  line-height: 1.5;
}

th {
  background-color: #f6f8fa;
  font-weight: 600;
  color: #24292f;
  text-align: left;
}

tr:nth-child(2n) {
  background-color: #fbfbfb;
}

/* 图片 */
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 16px auto;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  page-break-inside: avoid;
  break-inside: avoid;
}

/* 水平分割线 */
hr {
  height: 1px;
  background-color: #d0d7de;
  border: none;
  margin: 24px 0;
}

/* 行内代码 */
code:not([class*="language-"]) {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 85%;
  color: #24292f;
  background-color: rgba(175, 184, 193, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
}

/* 代码块容器 */
pre {
  background-color: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 14px 16px;
  margin: 16px 0;
  overflow-x: auto;
  page-break-inside: avoid;
  break-inside: avoid;
}

pre code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
  background-color: transparent;
  padding: 0;
  border-radius: 0;
}

/* ==================== Highlight.js 代码高亮主题 (GitHub Light) ==================== */
.hljs {
  color: #24292f;
}
.hljs-doctag,
.hljs-keyword,
.hljs-meta .hljs-keyword,
.hljs-template-tag,
.hljs-template-variable,
.hljs-type,
.hljs-variable.language_ {
  color: #cf222e;
  font-weight: 600;
}
.hljs-title,
.hljs-title.class_,
.hljs-title.class_.inherited__,
.hljs-title.function_ {
  color: #8250df;
  font-weight: 600;
}
.hljs-attr,
.hljs-attribute,
.hljs-literal,
.hljs-meta,
.hljs-number,
.hljs-operator,
.hljs-selector-attr,
.hljs-selector-class,
.hljs-selector-id,
.hljs-variable {
  color: #0550ae;
}
.hljs-meta .hljs-string,
.hljs-regexp,
.hljs-string {
  color: #0a3069;
}
.hljs-built_in,
.hljs-symbol {
  color: #116329;
}
.hljs-comment,
.hljs-code,
.hljs-formula {
  color: #6e7781;
  font-style: italic;
}
.hljs-name,
.hljs-quote,
.hljs-selector-pseudo,
.hljs-selector-tag {
  color: #116329;
}
.hljs-subst {
  color: #24292f;
}
.hljs-section {
  color: #0550ae;
  font-weight: bold;
}
.hljs-bullet {
  color: #cf222e;
}
.hljs-emphasis {
  font-style: italic;
}
.hljs-strong {
  font-weight: bold;
}
.hljs-addition {
  color: #116329;
  background-color: #dafbe1;
}
.hljs-deletion {
  color: #82071e;
  background-color: #ffebe9;
}
`
