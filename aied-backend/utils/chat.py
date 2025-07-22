import json
from openai import OpenAI
from time import time


# SiliconFlow
SILICONFLOW_API_KEY = "sk-tscthrcsxcwcluumybymwrzoxtaelbrqgbxkuedghxfhidtr"
SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1"
DEEPSEEK_MODEL_NAME = "deepseek-ai/DeepSeek-V3"

# Claude
CLAUDE_API_KEY = "sk-mZmO0IeaR5WQHtOaAoLg91OsHQKdFwutGTvw52bpfq90g1y6"
CLAUDE_BASE_URL = "https://api.openai-proxy.org/v1"
CLAUDE_MODEL_NAME = "claude-sonnet-4-20250514"

client = OpenAI(
    api_key=CLAUDE_API_KEY,
    base_url=CLAUDE_BASE_URL
)

def analyze_with_ai(prompt):
    response = client.chat.completions.create(
        model=CLAUDE_MODEL_NAME,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

def ask_ai(card_content, message):
    response = client.chat.completions.create(
                model=CLAUDE_MODEL_NAME,
                messages=[
                    {"role": "system", "content": f"根据卡片内容回答：{card_content}"},
                    {"role": "user", "content": message}
                ]
            )
    return response.choices[0].message.content

def generate_questions_with_ai(card_content, requirements):
    """
    使用AI根据卡片内容和用户要求生成题目
    
    Args:
        card_content: 卡片内容
        requirements: 用户要求，包含题目类型、数量、难度等
    
    Returns:
        包含生成题目的JSON字符串
    """
    prompt = f"""
请根据以下卡片内容和用户要求生成题目：

卡片内容：
{card_content}

用户要求：
{requirements}

请生成符合要求的题目，并按照以下JSON格式返回：
{{
    "questions": [
        {{
            "content": "题目内容",
            "type": "题目类型(choice/short_answer/code)",
            "options": ["选项1", "选项2", "选项3", "选项4"],  // 仅选择题需要
            "correct_answer": "正确答案"
        }}
    ]
}}

注意：
1. 选择题的正确答案应该是选项的索引号（0,1,2,3）
2. 简答题的正确答案应该是文本描述
3. 代码题的正确答案应该是预期的输出结果
4. 题目应该紧密围绕卡片内容，确保学习者能够通过卡片内容找到答案
5. 题目难度应该适中，既不过于简单也不过于困难
"""
    
    response = client.chat.completions.create(
        model=DEEPSEEK_MODEL_NAME,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return response.choices[0].message.content

if __name__ == '__main__':
    print('start')
    start = time()
    res = analyze_with_ai('世界第四高峰是什么？')
    print(res)
    print('time usage', time() - start)