import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  findBrowserExecutable,
  buildBookHtml,
  buildSingleDocHtml,
  exportBookToPdf,
  exportDocToPdf,
} from '../src/pdf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('PDF Export Module', () => {
  it('should find local Chrome or Edge browser executable', () => {
    const browserPath = findBrowserExecutable()
    expect(typeof browserPath).toBe('string')
    expect(fs.existsSync(browserPath)).toBe(true)
  })

  it('should compile single doc HTML and preserve styles', () => {
    const tempDir = path.join(__dirname, 'helpers/fixtures/pdf-test-doc')
    fs.mkdirSync(tempDir, { recursive: true })
    const mdPath = path.join(tempDir, 'test.md')
    fs.writeFileSync(
      mdPath,
      '# 测试文档\n\n<font style="color:rgb(255, 0, 0);">这是红色字体</font>\n\n```js\nconst a = 1;\nconsole.log(a);\n```\n\n| 表头1 | 表头2 |\n| --- | --- |\n| 单元格1 | 单元格2 |\n',
      'utf8'
    )

    const html = buildSingleDocHtml(mdPath)
    expect(html).toContain('测试文档')
    expect(html).toContain('<font style="color:rgb(255, 0, 0);">这是红色字体</font>')
    expect(html).toContain('hljs language-js')
    expect(html).toContain('表头1')
  })

  it('should compile book HTML with TOC and resolve relative images & links', () => {
    const tempDir = path.join(__dirname, 'helpers/fixtures/pdf-test-book')
    const imgDir = path.join(tempDir, 'img/doc1')
    fs.mkdirSync(imgDir, { recursive: true })

    // 创建虚拟图片文件
    const sampleImgPath = path.join(imgDir, 'sample.png')
    fs.writeFileSync(sampleImgPath, 'fake-png-data')

    const doc1Path = path.join(tempDir, 'doc1.md')
    fs.writeFileSync(
      doc1Path,
      '# 第一章\n\n![示例图](./img/doc1/sample.png)\n\n[前往第二章](./doc2.md)\n',
      'utf8'
    )

    const doc2Path = path.join(tempDir, 'doc2.md')
    fs.writeFileSync(doc2Path, '# 第二章\n\n这是第二章正文。\n', 'utf8')

    const progressJsonPath = path.join(tempDir, 'progress.json')
    fs.writeFileSync(
      progressJsonPath,
      JSON.stringify([
        {
          path: 'doc1.md',
          pathTitleList: ['第一章'],
          toc: { uuid: 'uuid-1', title: '第一章', type: 'DOC', level: 0 },
        },
        {
          path: 'doc2.md',
          pathTitleList: ['第二章'],
          toc: { uuid: 'uuid-2', title: '第二章', type: 'DOC', level: 0 },
        },
      ]),
      'utf8'
    )

    const html = buildBookHtml(tempDir, { bookName: '测试知识库' })

    // 检查封面
    expect(html).toContain('测试知识库')
    expect(html).toContain('文档总数: <span>2 篇</span>')

    // 检查目录超链接跳转
    expect(html).toContain('href="#doc-uuid-1"')
    expect(html).toContain('href="#doc-uuid-2"')

    // 检查正文区域 id
    expect(html).toContain('id="doc-uuid-1"')
    expect(html).toContain('id="doc-uuid-2"')

    // 检查图片相对路径重写为 file:/// 协议绝对路径
    expect(html).toContain('file://')
    expect(html).toContain('sample.png')

    // 检查内部跨文档链接重写为锚点
    expect(html).toContain('href="#doc-uuid-2"')
  })

  it('should export a real PDF file from book directory', async () => {
    const tempDir = path.join(__dirname, 'helpers/fixtures/pdf-test-book')
    const outputPdf = path.join(tempDir, 'test_output.pdf')
    if (fs.existsSync(outputPdf)) {
      fs.unlinkSync(outputPdf)
    }

    const resultPath = await exportBookToPdf(tempDir, {
      outputPath: outputPdf,
      bookName: '真实测试知识库',
    })

    expect(fs.existsSync(resultPath)).toBe(true)
    const stats = fs.statSync(resultPath)
    expect(stats.size).toBeGreaterThan(1000) // PDF 文件大小通常 > 1KB
  }, 60000)
})
