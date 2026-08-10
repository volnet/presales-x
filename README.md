<div align="center">
  <img src="src/ui/assets/presalesx-logo.png" width="92" alt="PreSalesX logo">
  <h1>PreSalesX</h1>
  <p>本地化售前文档审查与元数据编辑工作台</p>
</div>

PreSalesX 是一款默认离线运行的桌面专业工具，面向方案、报价、资质材料和其他售前文档。它提供“多家供应商批量审查”“文件属性编辑”“文件脱敏”和“文档媒体助理”四个独立工作台，并配有可拖动、可互动的桌面数字伙伴。

检测结果只用于提供人工复核线索，不直接作出串标、违法或其他法律定性结论。

## 四个独立工作台

### 多家供应商批量审查

每个上传的 ZIP 代表一家供应商，ZIP 文件名即供应商名称。审查结果分为三个连续区域：

1. **文件审查**：按供应商逐列展示 ZIP 文件名、文件数、文件大小、类型分布和解析异常，同时汇总整体一致的供应商包。文件采用带序号的折叠卡，完整路径自动换行，并直接展示作者、最后保存者、程序名称、公司、管理者、创建与修改时间等关键字段。每家供应商的第一个文件默认展开，也可以一键全部展开或全部收起。
2. **属性重复审查**：所有非空重复值都会列出并分成高、中、低风险。Office 重点检查作者、最后一次保存者、修订号、版本号、程序名称、公司、管理者、创建时间和保存时间；PDF 检查作者、标题、主题、关键词、创建程序、制作工具及时间字段；图片检查作者、标题、说明与创建软件。
3. **操作记录**：记录属性修改、删除、保存、另存为、输出路径和写入前后 SHA-256，并可导出操作报告。

“文件审查”支持“仅查看相同文件”和“仅查看属性重复文件”两个组合筛选。关键字段即使没有值也会显示为 `<空>`。文件属性重复、完全相同文件、文本 SimHash、图片与媒体指纹均由引擎自动审查，不再提供容易造成漏查的范围开关。文件路径使用浅色目录与深色文件名区分；相同文件、重复属性或相似性线索会紧跟可悬停的问题 Tag。点击“查看更多与编辑”会在右侧固定打开属性编辑器。供应商包整体内容完全一致等致命问题使用红色提示。

### 文件属性编辑器

用于直接打开 Office、PDF、图片或文本文件，集中查看文件属性，并对支持的 Office/PDF 元数据进行修改、删除、保存或另存为。它与供应商批量审查使用不同的页面和导航结构。

左侧文件栏和右侧属性区可以拖动调整宽度；长文件名和完整路径自动换行。文件栏右上角的“＋”可以继续添加文件。右侧属性段默认全部展开，并提供行业通用的 `+ / −`“全部展开 / 全部收起”图标。

## PDF 元数据

PDF 的“说明”区域在同一属性行中并列展示：

- 传统 PDF Info Dictionary，例如 `/Author`、`/Title`、`/Creator`、`/Producer`。
- XMP Metadata Stream，例如 `dc:creator`、`dc:title`、`xmp:CreatorTool`、`pdf:Producer`。

Info 与 XMP 默认联动，修改一侧会同步另一侧。也可以按属性解除关联并分别编辑，此时界面会明确提示不同阅读器可能显示不同值。

保存后编辑器不会被销毁或重建，当前输入框仍可继续获得光标并进行下一次修改。

### 文件脱敏

- 采用“文件 + 同行前后对照”工作台，不打开嵌套弹窗；每个项目的原值与脱敏结果由同一个 DOM 行渲染，勾选后右侧直接显示 `<空>`。
- Word 水印统一列为一项；Excel 背景按 Sheet 分项；Word 和 Excel 批注逐条列出。
- 水印和工作表背景默认全选，也可按“水印与背景”“批注”类型选择或一键全选。
- 不提供文件内容预览；界面只列出经过结构化检测确认的可脱敏项目，减少等待和误导。
- Word 处于修订状态时会显示醒目提示；脱敏不会擅自接受或拒绝修订。
- 文件脱敏暂只支持 Word 和 Excel，不接受 PDF。
- 每次只处理左侧当前选中的文件；“保存”更新当前文件，“另存为”可选择路径并修改文件名，宏与其他未处理的包内容原样保留。

### 文档媒体助理

- 从 Word、Excel、PowerPoint 文件中提取内置图片与视频，以相册方式集中展示；支持单文件和多文件操作。
- 图片可双击打开右侧前后对照预览，并显示 PNG、JPEG、GIF 等真实格式；支持多选导出、复制、转黑白，以及添加横向、竖向、斜向文字或图片水印。
- 视频可直接预览并按目标档位压缩。默认视频码率为 2095 kbps、音频码率为 128 kbps，也允许自定义；低于建议质量时会先提示，但不阻止用户继续。
- 顶部集中展示当前选中的媒体，并将“编辑”与“输出”操作分组。图片和视频也支持符合平台习惯的右键菜单及 `Ctrl+C` / `Command+C`。
- 底部任务区默认显示处理进度；展开后可查看当前步骤、实际参数和类似 Terminal 的执行记录。
- 导出单个源文件的媒体时，ZIP 沿用源文件名；媒体条目保留原始文件名。多个源文件按来源目录组织，避免同名覆盖。
- FFmpeg 与 FFprobe 已包含在 Windows/macOS 发布包中，用户无需另行安装。

### 桌面数字伙伴

数字伙伴采用连续帧状态机而不是随机替换静态表情：启动时从远处飞近、完成超人式落地并挥手欢迎；闲置后会坐下、侧躺并以无声的 `Z` 动画打呼噜；检测到用户操作时会爬起并问候；处理任务时展示连续思考和灵光一现动作。欢迎语和任务反馈只以短暂渐隐气泡出现。可直接拖动人物移动，双击聚焦主窗口；关闭 PreSalesX 主窗口时数字伙伴会随程序退出。

## 支持的文件

- Office Open XML：DOCX、DOCM、XLSX、XLSM、PPTX、PPTM
- PDF
- 图片：PNG、JPEG、TIFF、WebP 等常见格式
- 文本：TXT、CSV、XML、JSON、HTML

旧式二进制 DOC、XLS、PPT 仅识别类型，不进行深层属性解析。加密 Office/PDF 只报告状态，不绕过密码或权限限制。

## Windows 开发运行

建议使用 Node.js 20 LTS：

```powershell
cd E:\github\volnet\presales-x
npm.cmd install
npm.cmd start
```

如果 Electron 下载不完整并提示 `Electron failed to install correctly`：

```powershell
Remove-Item -Recurse -Force .\node_modules\electron
npm.cmd install
npm.cmd start
```

## 测试与构建

```powershell
npm.cmd test
npm.cmd run dist:win
```

Windows 免安装完整包输出为：

```text
dist\PreSalesX-1.3.3-Windows-x64.zip
```

解压后直接运行 `PreSalesX.exe`，无需另行安装 Node.js、Electron 或 npm 依赖。

macOS Universal 免安装完整包需要在 macOS 构建机上生成：

```bash
npm run dist:mac
```

输出为 `dist/PreSalesX-1.3.3-macOS-universal.zip`，同时包含 Intel 与 Apple Silicon 所需运行代码。解压后运行 `PreSalesX.app`，无需另行安装 Node.js 或 npm 依赖。未配置 Apple Developer 签名时，首次启动可能需要在 Finder 中右键选择“打开”。

推送 `v1.3.3` 标签后，GitHub Actions 会分别在 Windows 和 macOS 构建机上生成上述两个 ZIP，并自动附加到 GitHub Release。

正式对外分发时应配置对应平台的代码签名与 macOS 公证。

## 项目文件

项目默认保存为 `.presalesx.json`。

## 命令行审查

```powershell
node src\cli.js tests\供应商A.zip tests\供应商B.zip --out tests-output
```

输出包括 PreSalesX 项目 JSON、Excel 操作报告、HTML 报告和 PDF 报告。

## 安全与数据

- 分析过程在本机完成，不包含遥测、联网 API 或在线 AI。
- 只有用户明确点击“保存”时才覆盖本地原文件；“另存为”不会修改原文件。
- ZIP 内文件默认只读，属性修改通过“另存为”输出独立文件。
- 元数据写入使用临时文件和备份替换流程，完成后重新读取验证。
- 宏和 PDF JavaScript 只识别、不执行。
- ZIP 解析包含路径穿越、符号链接、条目数量、单文件大小、总体积与压缩比限制。
- 真实业务文件、解压内容、检测数据库和报告不应提交到仓库。

## 技术结构

- `src/analyzer.js`：文件识别、Office/PDF/图片属性解析和确定性风险规则。
- `src/audit.js`：供应商汇总、ZIP 清单一致性、相同文件与核心属性重复风险分组。
- `src/cleaner.js`：Office/PDF 元数据写入、Info/XMP 同步和写后验证。
- `src/office-images.js`：Office 内置图片与视频提取、媒体处理和导出。
- `src/video-processor.js`：视频探测、体积预估与 FFmpeg 压缩任务。
- `src/reports.js`：项目、供应商、相同文件、属性重复与操作记录报告。
- `src/ui`：专业工具式信息架构、供应商工作台与属性编辑器。

依赖版本由 `package-lock.json` 固定。
