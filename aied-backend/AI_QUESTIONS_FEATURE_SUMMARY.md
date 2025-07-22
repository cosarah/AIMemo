# AI出题功能已完成

## 新增功能说明

为管理控制台添加了AI出题功能，包含以下两个API端点：

### 1. AI生成题目 (预览)
- **端点:** `POST /admin/ai/generate-questions/`
- **功能:** 基于卡片内容和用户要求生成题目，但不保存到数据库
- **请求参数:**
  - `card_id`: 卡片的UUID
  - `requirements`: 用户的出题要求
- **响应:** 返回生成的题目列表

### 2. AI批量创建题目 (保存到数据库)
- **端点:** `POST /admin/ai/batch-create-questions/`
- **功能:** 将AI生成的题目保存到数据库中
- **请求参数:**
  - `card_id`: 卡片的UUID
  - `questions`: 题目列表
- **响应:** 返回创建成功的题目信息

## 使用流程

1. 管理员在管理控制台选择一个卡片
2. 输入出题要求（如："生成3道选择题，难度适中"）
3. 调用AI生成题目API预览生成结果
4. 满意后调用批量创建API保存到数据库

## 题目类型支持

- 选择题 (choice): question_type = 1
- 简答题 (short_answer): question_type = 2  
- 代码题 (code): question_type = 3

## 技术实现

- 在 `utils/chat.py` 中添加了 `generate_questions_with_ai()` 函数
- 在 `cards/views.py` 中添加了两个新的视图函数
- 在 `aied/urls.py` 中添加了URL路由配置

功能已完成，可以开始使用。
