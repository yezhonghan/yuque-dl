import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'
import type { IPdfExportOptions } from './types'

/**
 * 跨平台探测系统已安装的 Chrome 或 Edge 浏览器可执行文件
 */
export function findBrowserExecutable(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH
  }
  if (process.env.EDGE_PATH && fs.existsSync(process.env.EDGE_PATH)) {
    return process.env.EDGE_PATH
  }

  const platform = os.platform()

  if (platform === 'win32') {
    const prefixes = [
      process.env.LOCALAPPDATA,
      process.env.PROGRAMFILES,
      process.env['PROGRAMFILES(X86)'],
      'C:\\Program Files',
      'C:\\Program Files (x86)',
    ].filter(Boolean) as string[]

    const relativePaths = [
      '\\Google\\Chrome\\Application\\chrome.exe',
      '\\Microsoft\\Edge\\Application\\msedge.exe',
    ]

    for (const prefix of prefixes) {
      for (const rel of relativePaths) {
        const full = path.join(prefix, rel)
        if (fs.existsSync(full)) {
          return full
        }
      }
    }
  } else if (platform === 'darwin') {
    const macPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ]
    for (const p of macPaths) {
      if (fs.existsSync(p)) return p
    }
  } else {
    // Linux
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
      '/snap/bin/chromium',
    ]
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p
    }
  }

  throw new Error(
    '未在系统中检测到 Chrome 或 Edge 浏览器。\n请安装 Google Chrome 或 Microsoft Edge，或者通过环境变量 PUPPETEER_EXECUTABLE_PATH 指定浏览器路径。'
  )
}

/**
 * 驱动无头浏览器将 HTML 文件渲染并打印为 PDF
 */
export async function renderHtmlToPdf(
  htmlFilePath: string,
  outputPdfPath: string,
  options?: IPdfExportOptions
): Promise<void> {
  const executablePath = options?.executablePath || findBrowserExecutable()

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    protocolTimeout: 600000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--allow-file-access-from-files',
      '--font-render-hinting=medium',
      '--disable-gpu',
    ],
  })

  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(600000)
    await page.setViewport({ width: 1200, height: 800 })

    const fileUrl = pathToFileURL(path.resolve(htmlFilePath)).href
    // 加载本地 HTML 文件
    await page.goto(fileUrl, {
      waitUntil: 'load',
      timeout: 600000,
    })

    // 等待所有图片加载完成，最多等待 15 秒防止单张损坏图片卡住流程
    await page.evaluate(`
      new Promise(function(resolve) {
        var images = Array.from(document.images);
        if (images.length === 0) return resolve();
        var remaining = images.length;
        var timer = setTimeout(resolve, 15000);
        images.forEach(function(img) {
          if (img.complete) {
            remaining--;
            if (remaining <= 0) {
              clearTimeout(timer);
              resolve();
            }
          } else {
            img.onload = img.onerror = function() {
              remaining--;
              if (remaining <= 0) {
                clearTimeout(timer);
                resolve();
              }
            };
          }
        });
      })
    `)

    await page.pdf({
      path: outputPdfPath,
      format: options?.format || 'A4',
      printBackground: true,
      timeout: 0,
      margin: {
        top: options?.margin?.top || '16mm',
        bottom: options?.margin?.bottom || '16mm',
        left: options?.margin?.left || '14mm',
        right: options?.margin?.right || '14mm',
      },
      displayHeaderFooter: options?.displayHeaderFooter ?? true,
      headerTemplate: '<div style="height: 0; padding: 0; margin: 0;"></div>',
      footerTemplate:
        '<div style="font-size: 9px; color: #8c8c8c; width: 100%; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</div>',
      outline: true,
      tagged: true,
    })
  } finally {
    await browser.close()
  }
}
