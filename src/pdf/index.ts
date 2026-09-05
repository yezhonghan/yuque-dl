import fs from 'node:fs/promises'
import path from 'node:path'
import ora from 'ora'
import { renderHtmlToPdf } from './browser'
import { buildBookHtml, buildSingleDocHtml } from './html'
import { logger } from '../utils'
import type { IPdfExportOptions } from './types'

/**
 * 将整个知识库导出为单一 PDF
 */
export async function exportBookToPdf(
  bookPath: string,
  options?: IPdfExportOptions
): Promise<string> {
  const resolvedBookPath = path.resolve(bookPath)
  const bookName = options?.bookName || path.basename(resolvedBookPath)
  const cleanBookName = bookName.replace(/[\\/:*?"<>|]/g, '_')

  const outputPdfPath = options?.outputPath
    ? path.resolve(options.outputPath)
    : path.resolve(resolvedBookPath, `${cleanBookName}.pdf`)

  const tempHtmlPath = path.resolve(resolvedBookPath, `._temp_${Date.now()}.html`)

  const spinner = ora({
    text: `正在解析文档并构建 HTML: ${bookName}`,
    color: 'cyan',
  }).start()

  try {
    const html = buildBookHtml(resolvedBookPath, options)
    await fs.writeFile(tempHtmlPath, html, 'utf8')

    spinner.text = `正在通过无头浏览器渲染并导出 PDF: ${outputPdfPath}`
    await renderHtmlToPdf(tempHtmlPath, outputPdfPath, options)

    spinner.succeed(`√ PDF 导出完成: ${outputPdfPath}`)
    logger.info(`√ PDF 文件已保存至: ${outputPdfPath}`)
    return outputPdfPath
  } catch (error: any) {
    spinner.fail(`✕ PDF 导出失败: ${error.message}`)
    throw error
  } finally {
    try {
      await fs.unlink(tempHtmlPath)
    } catch {}
  }
}

/**
 * 将单个 Markdown 文档导出为 PDF
 */
export async function exportDocToPdf(
  docFilePath: string,
  options?: IPdfExportOptions
): Promise<string> {
  const resolvedDocPath = path.resolve(docFilePath)
  const dirName = path.dirname(resolvedDocPath)
  const fileName = path.basename(resolvedDocPath).replace(/\.md$/i, '')
  const cleanFileName = fileName.replace(/[\\/:*?"<>|]/g, '_')

  const outputPdfPath = options?.outputPath
    ? path.resolve(options.outputPath)
    : path.resolve(dirName, `${cleanFileName}.pdf`)

  const tempHtmlPath = path.resolve(dirName, `._temp_doc_${Date.now()}.html`)

  const spinner = ora({
    text: `正在将文档导出为 PDF: ${fileName}`,
    color: 'cyan',
  }).start()

  try {
    const html = buildSingleDocHtml(resolvedDocPath, options)
    await fs.writeFile(tempHtmlPath, html, 'utf8')

    spinner.text = `正在渲染并导出 PDF: ${outputPdfPath}`
    await renderHtmlToPdf(tempHtmlPath, outputPdfPath, options)

    spinner.succeed(`√ 文档 PDF 导出完成: ${outputPdfPath}`)
    logger.info(`√ PDF 文件已保存至: ${outputPdfPath}`)
    return outputPdfPath
  } catch (error: any) {
    spinner.fail(`✕ 文档 PDF 导出失败: ${error.message}`)
    throw error
  } finally {
    try {
      await fs.unlink(tempHtmlPath)
    } catch {}
  }
}

export * from './types'
export { findBrowserExecutable, renderHtmlToPdf } from './browser'
export { buildBookHtml, buildSingleDocHtml, loadBookDocuments } from './html'
export { PDF_STYLES } from './css'
