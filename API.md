# Music API 文档

本文档提供了本项目后端的 API 接口说明。后端采用 Express 实现，为前端提供音乐搜索、播放、歌词及详情获取等功能。通过这些标准化的接口，您可以轻松接入大语言模型（LLM）进行深入的音乐推荐、用户风格画像及知识图谱分析（如分析用户矛盾又统一的音乐品味：古典与摇滚并存等）。

## 基础 URL
所有接口均基于 `/api` 路径，建议配合本地环境或代理请求使用。
例如：`http://localhost:3000/api`

---

## 1. 跨平台综合搜索获取完整结果 `GET /api/search`

聚合各大平台的搜索结果，等待所有平台返回后统一响应。

**请求参数 (Query Parameters):**
- `q` (string, required): 搜索关键词
- `page` (number, optional): 页码，默认为 1

**响应示例:**
```json
{
  "success": true,
  "results": [
    {
      "sourceId": "xiaoyun",
      "platform": "小云音乐",
      "data": [
         { "id": "123", "title": "Song", "artist": "Artist" }
      ]
    }
  ]
}
```

---

## 2. 跨平台流式搜索结果 `GET /api/search/stream`

(推荐用于降低延迟) 聚合各大平台的搜索结果，通过 Server-Sent Events (SSE) 流式返回结果。

**请求参数 (Query Parameters):**
- `q` (string, required): 搜索关键词
- `type` (string, optional): 搜索类型，可选值为 `music` (默认), `artist`, `album`, `sheet`
- `page` (number, optional): 页码，默认为 1

**响应格式:**
返回 `Content-Type: text/event-stream` 的 SSE 流，数据体如下：
```json
// data: 
{
  "sourceId": "xiaoyun",
  "platform": "小云音乐",
  "data": [ ... ],
  "isEnd": false
}
```
**LLM 接入建议：** 可以使用搜索接口检索与用户收藏相似的音乐曲目，丰富已有用户的用户画像特征，让音乐库的覆盖面更广。

---

## 3. 获取播放链接 `POST /api/play`

根据音乐信息获取真实的可播放音频流媒体链接。支持多种音质选择。

**请求头部:**
- `Content-Type: application/json`

**请求体 (JSON):**
- `sourceId` (string, required): 音源插件ID，如 `xiaoyun`, `xiaoqiu`, `xiaogou`, `xiaowo`, `xiaomi`
- `musicItem` (object, required): 音乐项目的 `raw` 原始数据对象
- `quality` (string, optional): 音质选择。支持 `low` (128kbps), `standard` (320kbps), `flac` (无损), `wav` (原音轨)，默认值为 `standard`

**响应示例:**
```json
{
  "success": true,
  "url": "https://example.com/stream/abc.mp3"
}
```

---

## 4. 获取歌词 `POST /api/lyric`

获取指定歌曲的歌词内容。

**请求头部:**
- `Content-Type: application/json`

**请求体 (JSON):**
- `sourceId` (string, required): 音源插件ID
- `musicItem` (object, required): 音乐原始数据

**响应示例:**
```json
{
  "success": true,
  "lyric": "[00:00.00] 歌词内容...\n[00:05.12] 另一句歌词..."
}
```
**LLM 接入建议：** 提取歌词文本输入给 LLM，用于深度情感分析、主题分类。结合用户的听歌偏好，挖掘用户深层的情绪画像（如表面小众狂热，内心深藏流行）。

---

## 5. 插件方法调用 (如获取歌手、歌单详情) `POST /api/invoke`

调用指定插件（平台）的具体高级方法，如获取专辑详细信息、歌手作品列表、排行榜、或者解析导入的外部链接。

**请求头部:**
- `Content-Type: application/json`

**请求体 (JSON):**
- `sourceId` (string, required): 音源插件ID
- `method` (string, required): 调用的方法名，例如：
  - `getArtistWorks` (获取歌手详情及作品)
  - `getAlbumInfo` (获取专辑详情列表)
  - `getMusicSheetInfo` (获取歌单详情)
  - `importMusicSheet` (导入/解析平台分享的歌单链接)
- `args` (array, optional): 方法的参数数组

**响应示例 (以导入歌单为例):**
```json
{
  "success": true,
  "data": [
    {
      "id": "music_id",
      "title": "Song Title",
      "artist": "Artist Name",
      ...
    }
  ]
}
```
**LLM 接入建议：** 如果用户分享了一个网易云或 QQ 音乐的歌单链接，调用 `importMusicSheet` 方法将其解析为 JSON 数据。将该歌单的全部歌曲列表输入给 LLM，让 LLM 拆解歌单风格，将其映射到音乐知识图谱的不同节点，完成“融合古典与摇滚”等复杂品味的画像构建。

---

## 6. 音频代理 `GET /api/proxy`

解决跨域播放限制和防盗链的音频流媒体代理接口。

**请求参数:**
- `url` (string, required): 目标音频的完整 URL (需 URL Encoding)

---

## 未来扩展: LLM 音乐画像分析

基于前面列举的数据捕获接口，推荐在后续开发时由后端集成 LLM 对用户创建好的音乐实体进行二次加工：

1. **多维度风格提取**: 调用获取歌单接口，提取百首单曲后批量请求大模型，生成例如："60%古典, 30%黑金摇滚, 10%周杰伦"标签。
2. **知识图谱关系映射**: 可以映射出诸如 "贝多芬 (流派) -> 门德尔松" 和 "Linkin Park (流派) -> Nu Metal" 这样不同分支却最终同属某个具体用户的神奇纽带。
3. **情绪与曲风追踪**: 利用歌词 `lyric` API 请求 LLM 构建歌曲内在情感的雷达图。
