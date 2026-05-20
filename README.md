# 123ST Memory Chat

一个零依赖静态 Web 项目，可直接上传到 GitHub，并通过 Vercel 部署。

## 功能

- 首次进入展示主界面、slogan 和作者信息
- 轻触后进入聊天界面，点击聊天空白区或底部提示均可推进对话
- 自动读取 `for.md`，按月份从 `2025.9` 到 `2026.5` 播放
- 每完成一个月份章节，弹出记忆碎片和对应配图
- 左上角返回桌面，桌面提供 `Chat`、`Pic`、`Summery`
- 右上角聊天记录菜单，可查看已读章节
- 完成过去篇后进入未来篇假结局 `be.md`，再进入真结局 `he.md`
- 真结局结束后提供 `mailto:` 邮件选项
- 背景音乐使用 `三葉のテーマ.mp3`

## 内容文件

- `for.md`：过去篇聊天记录
  - `T:` 或 `T：` 表示时间
  - `A:` 或 `A：` 表示右侧发言
  - `B:` 或 `B：` 表示左侧发言
  - `####` 可用于分隔聊天片段
- `To.md`：每个月份完成后的记忆碎片文本
- `be.md`：未来篇假结局文本
- `he.md`：未来篇真结局文本，邮件地址会被自动识别

## 素材目录

- `stFront.jpg`：聊天头像
- `三葉のテーマ.mp3`：背景音乐
- `bgpic/neri.jpg`：过去篇和桌面背景
- `bgpic/mirai.jpg`：未来篇真结局背景
- `pic/`：记忆碎片图片，命名为 `2025.9.webp`、`2025.10.webp` 等，`2026.5` 使用 `png`
- `tempPic/tem.png`：碎片弹窗参考图

## 本地预览

```powershell
python -m http.server 4173
```

然后访问：

```text
http://localhost:4173
```

## Vercel 部署

1. 将整个目录提交到 GitHub。
2. 在 Vercel 导入该 GitHub 仓库。
3. Framework Preset 选择 `Other`。
4. Build Command 留空。
5. Output Directory 留空。

项目是纯静态站，入口文件为 `index.html`。

## 进度存储

已阅读章节、已收集图片和结局进度会保存在浏览器 `localStorage` 中。调试时如果想重置进度，可在浏览器开发者工具里清除站点数据。
