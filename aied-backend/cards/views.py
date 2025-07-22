from django.shortcuts import render
import openai
import os
import json
import subprocess
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET, require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db import models
from .models import Card, ChatRecord, User, Question, AnswerRecord, LearningRecord, SmartScheduler
import uuid
from django.contrib.auth import get_user_model
from utils.chat import ask_ai, generate_questions_with_ai
from utils.utils_jwt import generate_jwt_token
from django.utils import timezone
from datetime import datetime

@csrf_exempt
@require_POST
def login(request):
    try:
        body = json.loads(request.body.decode("utf-8"))
        
        username = body.get("username")
        password = body.get("password")
        
        if not username or not password:
            return JsonResponse({'error': 'Missing username or password'}, status=400)
        
        # 使用Django标准User模型
        User = get_user_model()
        
        # 首先尝试Django标准User模型认证
        django_user = None
        if User.objects.filter(username=username).exists():
            from django.contrib.auth import authenticate
            django_user = authenticate(username=username, password=password)
            if django_user:
                return JsonResponse({"token": generate_jwt_token(username)})
        
        # 如果Django标准认证失败，尝试自定义User模型（向后兼容）
        from .models import User as CustomUser
        if CustomUser.objects.filter(username=username).exists():
            custom_user = CustomUser.objects.filter(username=username).first()
            if custom_user and custom_user.password == password:
                # 如果自定义用户存在但Django用户不存在，创建Django用户
                if not django_user:
                    django_user = User.objects.create_user(username=username, password=password)
                    # 创建智能调度器
                    try:
                        SmartScheduler.objects.get(user=django_user)
                    except SmartScheduler.DoesNotExist:
                        scheduler = SmartScheduler(user=django_user)
                        scheduler.save()
                return JsonResponse({"token": generate_jwt_token(username)})
            else:
                return JsonResponse({'error': 'wrong password'}, status=401)
        else:
            # 用户不存在，创建新用户（保持原有的自动注册逻辑）
            django_user = User.objects.create_user(username=username, password=password)
            custom_user = CustomUser(username=username, password=password)
            custom_user.save()
            
            # 创建智能调度器
            scheduler = SmartScheduler(user=django_user)
            scheduler.save()
            
            return JsonResponse({"token": generate_jwt_token(username)})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def register(request):
    """用户注册API"""
    try:
        body = json.loads(request.body.decode("utf-8"))
        
        username = body.get("username")
        password = body.get("password")
        confirm_password = body.get("confirm_password")
        
        # 验证必填字段
        if not username or not password or not confirm_password:
            return JsonResponse({'error': '请填写所有必填字段'}, status=400)
        
        # 验证用户名长度
        if len(username) < 3:
            return JsonResponse({'error': '用户名至少需要3个字符'}, status=400)
        if len(username) > 20:
            return JsonResponse({'error': '用户名最多20个字符'}, status=400)
            
        # 验证密码长度
        if len(password) < 6:
            return JsonResponse({'error': '密码至少需要6个字符'}, status=400)
        if len(password) > 50:
            return JsonResponse({'error': '密码最多50个字符'}, status=400)
            
        # 验证密码确认
        if password != confirm_password:
            return JsonResponse({'error': '两次输入的密码不一致'}, status=400)
        
        # 使用Django标准User模型
        User = get_user_model()
        
        # 检查用户名是否已存在
        if User.objects.filter(username=username).exists():
            return JsonResponse({'error': '用户名已存在，请选择其他用户名'}, status=409)
        
        # 创建新用户（使用Django标准User模型）
        user = User.objects.create_user(username=username, password=password)
        
        # 同时创建自定义User记录（保持向后兼容）
        from .models import User as CustomUser
        custom_user = CustomUser(username=username, password=password)
        custom_user.save()
        
        # 创建智能调度器
        scheduler = SmartScheduler(user=user)
        scheduler.save()
        
        # 生成token
        token = generate_jwt_token(username)
        
        return JsonResponse({
            "message": "注册成功",
            "token": token,
            "username": username
        })
        
    except Exception as e:
        return JsonResponse({'error': f'注册失败: {str(e)}'}, status=500)

@csrf_exempt
@require_POST  
def check_username(request):
    """检查用户名是否可用"""
    try:
        body = json.loads(request.body.decode("utf-8"))
        username = body.get("username")
        
        if not username:
            return JsonResponse({'error': '用户名不能为空'}, status=400)
            
        if len(username) < 3:
            return JsonResponse({'available': False, 'message': '用户名至少需要3个字符'})
        if len(username) > 20:
            return JsonResponse({'available': False, 'message': '用户名最多20个字符'})
            
        # 检查Django标准User模型中是否已存在
        User = get_user_model()
        django_user_exists = User.objects.filter(username=username).exists()
        
        # 也检查自定义User模型（向后兼容）
        from .models import User as CustomUser
        custom_user_exists = CustomUser.objects.filter(username=username).exists()
        
        if django_user_exists or custom_user_exists:
            return JsonResponse({'available': False, 'message': '用户名已存在'})
        else:
            return JsonResponse({'available': True, 'message': '用户名可用'})
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_POST
def chat_view(request):
    try:
        data = json.loads(request.body)
        message = data.get('message')
        card_id = data.get('card_id')
        username = data.get('username')
        
        # 获取卡片
        try:
            card = Card.objects.get(id=card_id)
        except Card.DoesNotExist:
            # return JsonResponse({'error': 'Card not found'}, status=404)
            print("Card not found")
            card = Card.objects.create(id=card_id, content="")
        
        # 获取用户（根据你的用户系统调整）
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if not user:
            # return JsonResponse({'error': 'User not found'}, status=401)
            print("User not found")
            user = User.objects.create(username=username)
        
        # 调用OpenAI API
        try:
            reply = ask_ai(card.content, message)
        except Exception as e:
            # return JsonResponse({'error': str(e)}, status=500)
            print("Error: ", e)
        
        # 保存记录
        ChatRecord.objects.create(
            user=user,
            card=card,
            message=message,
            reply=reply
        )
        
        # return JsonResponse({'reply': reply})
        return JsonResponse({'reply': reply})
    
    except Exception as e:
        # return JsonResponse({'error': str(e)}, status=400)
        print("Error: ", e)
        return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def card_navigation(request):
    try:
        data = json.loads(request.body)
        card_id = data.get('card_id')
        nav_type = data.get('type')
        username = data.get('username', 'default_user')

        # 验证必需参数
        if not nav_type:
            return JsonResponse({'error': '缺少type参数'}, status=400)

        # 获取或创建用户
        User = get_user_model()
        user, created = User.objects.get_or_create(username=username)

        # 处理不同导航类型
        if nav_type == 'first':
            # 对于first类型，完全忽略card_id参数，直接返回调度器应该调度的第一张卡片
            # 调度器会找到：1) 前置条件已满足 2) 用户尚未学习过的第一张卡片
            card = get_next_available_card(user)
        elif nav_type == 'next':
            if not card_id:
                return JsonResponse({'error': '缺少card_id参数'}, status=400)
            try:
                current_card = Card.objects.get(id=card_id)
                # 标记当前卡片为已学习
                mark_card_as_learned(user, current_card)
                # 获取下一张可用卡片
                card = get_next_available_card(user, exclude_card=current_card)
            except Card.DoesNotExist:
                return JsonResponse({'error': '卡片不存在'}, status=404)
        elif nav_type == 'prev':
            if not card_id:
                return JsonResponse({'error': '缺少card_id参数'}, status=400)
            try:
                current_card = Card.objects.get(id=card_id)
                # 获取上一张已学习的卡片
                card = get_previous_learned_card(user, current_card)
            except Card.DoesNotExist:
                return JsonResponse({'error': '卡片不存在'}, status=404)
        else:
            return JsonResponse({'error': '无效的导航类型'}, status=400)

        if not card:
            if nav_type == 'next':
                return JsonResponse({'message': '恭喜！你已经完成了所有可学习的卡片'}, status=404)
            else:
                return JsonResponse({'message': '没有更多卡片了'}, status=404)

        return JsonResponse({
            'id': str(card.id),
            'title': card.title,
            'content': card.content,
            'prerequisites': [str(prereq.id) for prereq in card.prerequisites.all()],
            'created_at': card.created_at.isoformat()
        })
    
    except json.JSONDecodeError:
        return JsonResponse({'error': '无效的JSON格式'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def get_next_available_card(user, exclude_card=None):
    """获取下一张可用的卡片（前置条件已满足）"""
    all_cards = Card.objects.all().order_by('created_at')
    if exclude_card:
        all_cards = all_cards.exclude(id=exclude_card.id)
    
    for card in all_cards:
        # 检查是否已经学过
        if LearningRecord.objects.filter(user=user, card=card, completed=True).exists():
            continue
            
        # 检查前置条件是否满足
        if card.is_unlocked_for_user(user):
            return card
    
    return None

def get_previous_learned_card(user, current_card):
    """获取上一张已学习的卡片"""
    learned_records = LearningRecord.objects.filter(
        user=user, 
        completed=True,
        card__created_at__lt=current_card.created_at
    ).order_by('-card__created_at')
    
    if learned_records.exists():
        return learned_records.first().card
    return None

def mark_card_as_learned(user, card):
    """标记卡片为已学习"""
    record, created = LearningRecord.objects.get_or_create(
        user=user,
        card=card,
        defaults={'completed': True, 'attempts': 1}
    )
    if not created and not record.completed:
        record.completed = True
        record.attempts += 1
        record.save()

from utils.chat import analyze_with_ai

@csrf_exempt
@require_http_methods(["POST"])
def question_navigation(request):
    try:
        data = json.loads(request.body)
        nav_type = data.get('type')
        username = data.get('username')
        card_id = data.get('card_id')
        question_id = data.get('question_id')

        # 验证必需参数
        if not nav_type:
            return JsonResponse({'error': '缺少type参数'}, status=400)
        if not username:
            return JsonResponse({'error': '缺少username参数'}, status=400)

        # 获取或创建用户
        User = get_user_model()
        user, created = User.objects.get_or_create(username=username)

        # 处理不同导航类型
        if nav_type == 'first':
            # 对于first类型，必须提供有效的card_id
            if not card_id or card_id == 'undefined' or card_id == '0':
                return JsonResponse({'error': '缺少有效的card_id参数'}, status=400)
            
            try:
                card = Card.objects.get(id=card_id)
            except (Card.DoesNotExist, ValueError):
                return JsonResponse({'error': '卡片不存在'}, status=404)
            
            # 总是返回问题队列的队首（第一个问题）
            question = card.questions.order_by('order').first()
        else:
            # 对于next/prev类型，需要验证card_id和question_id
            if not card_id or card_id == 'undefined':
                return JsonResponse({'error': '缺少有效的card_id参数'}, status=400)
            if not question_id:
                return JsonResponse({'error': '缺少question_id参数'}, status=400)
                
            try:
                card = Card.objects.get(id=card_id)
            except (Card.DoesNotExist, ValueError):
                return JsonResponse({'error': '卡片不存在'}, status=404)
            
            try:
                current = Question.objects.get(id=question_id, card=card)
                if nav_type == 'next':
                    question = card.questions.filter(order__gt=current.order).order_by('order').first()
                elif nav_type == 'prev':
                    question = card.questions.filter(order__lt=current.order).order_by('-order').first()
                else:
                    return JsonResponse({'error': '无效的导航类型'}, status=400)
            except Question.DoesNotExist:
                return JsonResponse({'error': '问题不存在'}, status=404)

        if not question:
            return JsonResponse({'message': '没有更多问题了'}, status=404)

        # 映射问题类型到前端期望的字符串格式
        type_mapping = {1: 'choice', 2: 'short_answer', 3: 'coding'}
        
        return JsonResponse({
            'id': question.id,
            'content': question.content,
            'type': type_mapping.get(question.question_type, 'choice'),
            'options': question.options if question.question_type == 1 else [],
            'isLast': not card.questions.filter(order__gt=question.order).exists()
        })
    
    except json.JSONDecodeError:
        return JsonResponse({'error': '无效的JSON格式'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# Create your views here.

@csrf_exempt
@require_POST
def submit_answer(request):
    try:
        data = json.loads(request.body)
        question_id = data['question_id']
        username = data['username']
        answer = data['answer']
        answer_type = data['type']

        # 验证用户和问题
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if not user:
            return JsonResponse({'error': 'Invalid user'}, status=404)
        
        try:
            question = Question.objects.get(id=question_id)
        except Question.DoesNotExist:
            return JsonResponse({'error': 'Invalid question'}, status=404)

        # 初始化响应数据
        response_data = {'is_correct': False}
        code_output = None

        # 根据题型处理答案
        if question.question_type == 1:  # choice 选择题
            is_correct = answer.strip().lower() == question.correct_answer.strip().lower()
            prompt = f"""
            分析选择题：
            问题：{question.content}
            选项：{question.options}
            正确答案：{question.options[int(question.correct_answer)]}
            用户答案：{question.options[int(answer)]}
            请根据用户的回答分析用户对相关知识点的理解"""
            
        elif question.question_type == 2:  # short_answer 简答题
            prompt = f"""
            分析简答题：
            问题：{question.content}
            参考答案：{question.correct_answer}
            用户答案：{answer}
            请根据用户的回答分析用户对相关知识点的理解"""

        elif question.question_type == 3:  # code 代码题
            # 安全执行代码
            try:
                process = subprocess.run(
                    ['python', '-c', answer],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    check=True
                )
                code_output = process.stdout
            except subprocess.TimeoutExpired:
                code_output = "代码执行超时"
            except Exception as e:
                code_output = str(e)

            prompt = f"""
            分析代码题：
            问题：{question.content}
            参考答案：{question.correct_answer}
            用户代码：{answer}
            执行结果：{code_output}
            请根据代码和执行结果分析用户对相关知识的理解"""
            is_correct = code_output == question.correct_answer

            response_data['output'] = code_output
        
        else:
            # 默认情况，防止 prompt 未定义
            prompt = f"""
            分析题目：
            问题：{question.content}
            用户答案：{answer}
            请根据用户的回答分析用户对相关知识点的理解"""

        print(prompt)
        prompt += """\n尽可能简短的回答，只需要分析用户的掌握情况，不要超过100字。
        如果用户回答正确，则在回答末尾添加<correct>，如果用户回答错误，则在回答末尾添加<wrong>
        """
        # 调用GPT分析
        analysis = analyze_with_ai(prompt)
        print(analysis)

        if analysis.endswith('<correct>'):
            is_correct = True
        elif analysis.endswith('<wrong>'):
            is_correct = False
        else:
            is_correct = False
        
        # 保存记录
        AnswerRecord.objects.create(
            user=user,
            question=question,
            user_answer=answer,
            is_correct=is_correct,
            ai_analysis=analysis,
            code_output=code_output if question.question_type == 3 else None
        )

        response_data.update({
            'is_correct': is_correct,
            'analysis': analysis
        })

        return JsonResponse(response_data)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# 卡片管理API端点
@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_cards_list(request):
    """卡片管理API - 获取所有卡片或创建新卡片"""
    if request.method == 'GET':
        # 获取所有卡片列表
        try:
            cards = Card.objects.all().order_by('-created_at')
            cards_data = []
            
            for card in cards:
                question_count = card.questions.count()  # 获取问题数量
                cards_data.append({
                    'id': str(card.id),
                    'title': card.title,
                    'content': card.content,
                    'prerequisites': [str(prereq.id) for prereq in card.prerequisites.all()],
                    'question_count': question_count,  # 添加问题数量
                    'created_at': card.created_at.isoformat()
                })
            
            return JsonResponse(cards_data, safe=False)
        
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == 'POST':
        # 创建新卡片
        try:
            data = json.loads(request.body)
            title = data.get('title', '').strip()
            content = data.get('content', '').strip()
            prerequisites = data.get('prerequisites', [])
            
            if not content:
                return JsonResponse({'error': '卡片内容不能为空'}, status=400)
            
            # 生成新的UUID
            card_id = str(uuid.uuid4())
            
            # 创建新卡片
            card = Card.objects.create(
                id=card_id,
                title=title,
                content=content
            )
            
            # 设置前置卡片
            if prerequisites:
                prerequisite_cards = Card.objects.filter(id__in=prerequisites)
                card.prerequisites.set(prerequisite_cards)
            
            return JsonResponse({
                'id': str(card.id),
                'title': card.title,
                'content': card.content,
                'prerequisites': [str(prereq.id) for prereq in card.prerequisites.all()],
                'created_at': card.created_at.isoformat()
            })
        
        except json.JSONDecodeError:
            return JsonResponse({'error': '无效的JSON格式'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def admin_cards_detail(request, card_id):
    """卡片管理API - 更新或删除指定卡片"""
    if request.method == 'PUT':
        # 更新卡片
        try:
            data = json.loads(request.body)
            title = data.get('title', '').strip()
            content = data.get('content', '').strip()
            prerequisites = data.get('prerequisites', [])
            
            if not content:
                return JsonResponse({'error': '卡片内容不能为空'}, status=400)
            
            try:
                card = Card.objects.get(id=card_id)
            except Card.DoesNotExist:
                return JsonResponse({'error': '卡片不存在'}, status=404)
            
            card.title = title
            card.content = content
            card.save()
            
            # 更新前置卡片
            prerequisite_cards = Card.objects.filter(id__in=prerequisites)
            card.prerequisites.set(prerequisite_cards)
            
            return JsonResponse({
                'id': str(card.id),
                'title': card.title,
                'content': card.content,
                'prerequisites': [str(prereq.id) for prereq in card.prerequisites.all()],
                'created_at': card.created_at.isoformat()
            })
        
        except json.JSONDecodeError:
            return JsonResponse({'error': '无效的JSON格式'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == 'DELETE':
        # 删除卡片
        try:
            try:
                card = Card.objects.get(id=card_id)
            except Card.DoesNotExist:
                return JsonResponse({'error': '卡片不存在'}, status=404)
            
            card.delete()
            return JsonResponse({'message': '卡片已删除'})
        
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

# 问题管理API端点

@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_questions_list(request, card_id):
    """问题管理API - 获取指定卡片的所有问题或创建新问题"""
    try:
        # 验证卡片存在
        card = Card.objects.get(id=card_id)
    except Card.DoesNotExist:
        return JsonResponse({'error': '卡片不存在'}, status=404)
    
    if request.method == 'GET':
        # 获取指定卡片的所有问题
        try:
            questions = Question.objects.filter(card=card).order_by('order')
            questions_data = []
            
            for question in questions:
                questions_data.append({
                    'id': question.id,
                    'content': question.content,
                    'question_type': question.question_type,
                    'options': question.options,
                    'correct_answer': question.correct_answer,
                    'order': question.order,
                    'created_at': question.created_at.isoformat()
                })
            
            return JsonResponse(questions_data, safe=False)
        
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == 'POST':
        # 创建新问题
        try:
            data = json.loads(request.body)
            content = data.get('content', '').strip()
            question_type = data.get('question_type')
            options = data.get('options', [])
            correct_answer = data.get('correct_answer', '').strip()
            order = data.get('order', 0)
            
            # 验证必需字段
            if not content:
                return JsonResponse({'error': '问题内容不能为空'}, status=400)
            if not question_type or question_type not in [1, 2, 3]:
                return JsonResponse({'error': '问题类型无效'}, status=400)
            if not correct_answer:
                return JsonResponse({'error': '正确答案不能为空'}, status=400)
            
            # 如果是选择题，验证选项
            if question_type == 1 and (not options or len(options) < 2):
                return JsonResponse({'error': '选择题至少需要2个选项'}, status=400)
            
            # 创建新问题
            question = Question.objects.create(
                card=card,
                content=content,
                question_type=question_type,
                options=options,
                correct_answer=correct_answer,
                order=order
            )
            
            return JsonResponse({
                'id': question.id,
                'content': question.content,
                'question_type': question.question_type,
                'options': question.options,
                'correct_answer': question.correct_answer,
                'order': question.order,
                'created_at': question.created_at.isoformat()
            })
        
        except json.JSONDecodeError:
            return JsonResponse({'error': '无效的JSON格式'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def admin_questions_detail(request, card_id, question_id):
    """问题管理API - 更新或删除指定问题"""
    try:
        # 验证卡片和问题存在
        card = Card.objects.get(id=card_id)
        question = Question.objects.get(id=question_id, card=card)
    except Card.DoesNotExist:
        return JsonResponse({'error': '卡片不存在'}, status=404)
    except Question.DoesNotExist:
        return JsonResponse({'error': '问题不存在'}, status=404)
    
    if request.method == 'PUT':
        # 更新问题
        try:
            data = json.loads(request.body)
            content = data.get('content', '').strip()
            question_type = data.get('question_type')
            options = data.get('options', [])
            correct_answer = data.get('correct_answer', '').strip()
            order = data.get('order', question.order)
            
            # 验证必需字段
            if not content:
                return JsonResponse({'error': '问题内容不能为空'}, status=400)
            if not question_type or question_type not in [1, 2, 3]:
                return JsonResponse({'error': '问题类型无效'}, status=400)
            if not correct_answer:
                return JsonResponse({'error': '正确答案不能为空'}, status=400)
            
            # 如果是选择题，验证选项
            if question_type == 1 and (not options or len(options) < 2):
                return JsonResponse({'error': '选择题至少需要2个选项'}, status=400)
            
            # 更新问题
            question.content = content
            question.question_type = question_type
            question.options = options
            question.correct_answer = correct_answer
            question.order = order
            question.save()
            
            return JsonResponse({
                'id': question.id,
                'content': question.content,
                'question_type': question.question_type,
                'options': question.options,
                'correct_answer': question.correct_answer,
                'order': question.order,
                'created_at': question.created_at.isoformat()
            })
        
        except json.JSONDecodeError:
            return JsonResponse({'error': '无效的JSON格式'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == 'DELETE':
        # 删除问题
        try:
            question.delete()
            return JsonResponse({'message': '问题已删除'})
        
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def admin_cards_dependencies(request):
    """获取卡片依赖关系图数据"""
    try:
        cards = Card.objects.all()
        nodes = []
        edges = []
        
        for card in cards:
            nodes.append({
                'id': str(card.id),
                'title': card.title or f"Card {card.id}",
                'questionCount': card.questions.count()
            })
            
            # 添加依赖关系边
            for prereq in card.prerequisites.all():
                edges.append({
                    'from': str(prereq.id),
                    'to': str(card.id)
                })
        
        return JsonResponse({
            'nodes': nodes,
            'edges': edges
        })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def admin_ai_generate_questions(request):
    """AI生成题目API"""
    try:
        data = json.loads(request.body)
        card_id = data.get('card_id')
        requirements = data.get('requirements', '')
        
        if not card_id:
            return JsonResponse({'error': '缺少card_id参数'}, status=400)
        
        if not requirements:
            return JsonResponse({'error': '缺少requirements参数'}, status=400)
        
        # 验证卡片存在
        try:
            card = Card.objects.get(id=card_id)
        except Card.DoesNotExist:
            return JsonResponse({'error': '卡片不存在'}, status=404)
        
        # 调用AI生成题目
        try:
            ai_response = generate_questions_with_ai(card.content, requirements)
            
            # 尝试解析AI响应中的JSON
            try:
                # 提取JSON部分（去掉可能的额外文本）
                json_start = ai_response.find('{')
                json_end = ai_response.rfind('}') + 1
                if json_start != -1 and json_end != -1:
                    json_str = ai_response[json_start:json_end]
                    questions_data = json.loads(json_str)
                else:
                    raise ValueError("无法找到有效的JSON格式")
            except (json.JSONDecodeError, ValueError) as e:
                return JsonResponse({
                    'error': 'AI响应格式错误',
                    'raw_response': ai_response,
                    'parse_error': str(e)
                }, status=500)
            
            # 验证生成的题目格式
            if 'questions' not in questions_data:
                return JsonResponse({
                    'error': 'AI响应中缺少questions字段',
                    'raw_response': ai_response
                }, status=500)
            
            # 处理每个生成的题目
            processed_questions = []
            for question in questions_data['questions']:
                # 验证必需字段
                if not all(key in question for key in ['content', 'type', 'correct_answer']):
                    continue
                
                # 映射题目类型
                type_mapping = {
                    'choice': 1,
                    'short_answer': 2,
                    'code': 3
                }
                
                question_type = type_mapping.get(question['type'], 1)
                
                # 处理选择题选项
                options = question.get('options', []) if question_type == 1 else []
                
                processed_questions.append({
                    'content': question['content'],
                    'question_type': question_type,
                    'options': options,
                    'correct_answer': question['correct_answer'],
                    'type_display': question['type']
                })
            
            return JsonResponse({
                'success': True,
                'questions': processed_questions,
                'card_title': card.title,
                'card_id': str(card.id),
                'generated_count': len(processed_questions)
            })
            
        except Exception as e:
            return JsonResponse({
                'error': f'AI生成题目失败: {str(e)}',
                'card_id': str(card_id)
            }, status=500)
    
    except json.JSONDecodeError:
        return JsonResponse({'error': '无效的JSON格式'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def admin_ai_batch_create_questions(request):
    """AI批量创建题目API - 将生成的题目保存到数据库"""
    try:
        data = json.loads(request.body)
        card_id = data.get('card_id')
        questions = data.get('questions', [])
        
        if not card_id:
            return JsonResponse({'error': '缺少card_id参数'}, status=400)
        
        if not questions:
            return JsonResponse({'error': '缺少questions参数'}, status=400)
        
        # 验证卡片存在
        try:
            card = Card.objects.get(id=card_id)
        except Card.DoesNotExist:
            return JsonResponse({'error': '卡片不存在'}, status=404)
        
        # 获取当前最大的order值
        max_order = card.questions.aggregate(max_order=models.Max('order'))['max_order'] or 0
        
        created_questions = []
        
        for i, question_data in enumerate(questions):
            # 验证必需字段
            if not all(key in question_data for key in ['content', 'question_type', 'correct_answer']):
                continue
            
            # 创建问题
            question = Question.objects.create(
                card=card,
                content=question_data['content'],
                question_type=question_data['question_type'],
                options=question_data.get('options', []),
                correct_answer=question_data['correct_answer'],
                order=max_order + i + 1
            )
            
            created_questions.append({
                'id': question.id,
                'content': question.content,
                'question_type': question.question_type,
                'options': question.options,
                'correct_answer': question.correct_answer,
                'order': question.order
            })
        
        return JsonResponse({
            'success': True,
            'created_count': len(created_questions),
            'questions': created_questions,
            'card_title': card.title,
            'card_id': str(card.id)
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': '无效的JSON格式'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# 移除REST Framework导入
# from rest_framework.decorators import api_view
# from rest_framework.response import Response

# 使用Django原生的JsonResponse替代REST Framework
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

@csrf_exempt
@require_http_methods(["POST"])
def smart_scheduler_next_card(request):
    """智能调度器：获取下一张卡片"""
    try:
        import json
        data = json.loads(request.body)
        username = data.get('username')
        card_type = data.get('type')  # 'learning', 'practice', 'review'
        
        if not username or not card_type:
            return JsonResponse({'error': 'Missing username or type'}, status=400)
        
        # 获取或创建用户
        User = get_user_model()
        user, created = User.objects.get_or_create(username=username)
        
        # 获取或创建智能调度器
        scheduler, created = SmartScheduler.objects.get_or_create(user=user)
        
        card = None
        
        if card_type == 'learning':
            card = scheduler.get_next_learning_card()
        elif card_type == 'practice':
            card = scheduler.get_next_practice_card()
        elif card_type == 'review':
            card = scheduler.get_next_review_card()
        
        if card:
            # 获取学习记录
            learning_record, created = LearningRecord.objects.get_or_create(
                user=user,
                card=card,
                defaults={
                    'status': LearningRecord.NOT_LEARNED,
                    'queue': LearningRecord.LEARNING_QUEUE
                }
            )
            
            return JsonResponse({
                'id': str(card.id),
                'content': card.content,
                'title': card.title,
                'status': learning_record.status,
                'queue': learning_record.queue,
                'total_questions': card.get_total_questions_count(),
                'correct_answers': card.get_user_correct_answers_count(user),
                'prerequisites': [str(prereq.id) for prereq in card.prerequisites.all()]
            })
        else:
            return JsonResponse({'error': 'No cards available'}, status=404)
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def smart_scheduler_complete_learning(request):
    """智能调度器：完成学习"""
    try:
        import json
        data = json.loads(request.body)
        username = data.get('username')
        card_id = data.get('card_id')
        
        if not username or not card_id:
            return JsonResponse({'error': 'Missing username or card_id'}, status=400)
        
        # 使用 filter().first() 避免重复用户记录问题
        DjangoUser = get_user_model()
        user = DjangoUser.objects.filter(username=username).first()
        if not user:
            return JsonResponse({'error': 'User not found'}, status=404)
        
        card = Card.objects.get(id=card_id)
        scheduler = SmartScheduler.objects.get(user=user)
        
        # 更新学习进度
        scheduler.update_progress_after_learning(card)
        
        return JsonResponse({
            'message': 'Learning completed successfully',
            'next_action': 'practice',
            'total_learned_cards': scheduler.total_learned_cards
        })
        
    except (Card.DoesNotExist, SmartScheduler.DoesNotExist) as e:
        return JsonResponse({'error': str(e)}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def smart_scheduler_complete_practice(request):
    """智能调度器：完成练习"""
    try:
        import json
        data = json.loads(request.body)
        username = data.get('username')
        card_id = data.get('card_id')
        
        if not username or not card_id:
            return JsonResponse({'error': 'Missing username or card_id'}, status=400)
        
        # 使用Django标准User模型
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if not user:
            return JsonResponse({'error': 'User not found'}, status=404)
        
        card = Card.objects.get(id=card_id)
        scheduler = SmartScheduler.objects.get(user=user)
        
        # 更新练习进度
        scheduler.update_progress_after_practice(card)
        
        return JsonResponse({
            'message': 'Practice completed successfully',
            'next_action': 'review' if scheduler.current_practice_card is None else 'practice',
            'total_mastered_cards': scheduler.total_mastered_cards
        })
        
    except (User.DoesNotExist, Card.DoesNotExist, SmartScheduler.DoesNotExist) as e:
        return JsonResponse({'error': str(e)}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def smart_scheduler_complete_review(request):
    """智能调度器：完成复习"""
    try:
        import json
        data = json.loads(request.body)
        username = data.get('username')
        card_id = data.get('card_id')
        is_correct = data.get('is_correct', True)
        
        if not username or not card_id:
            return JsonResponse({'error': 'Missing username or card_id'}, status=400)
        
        # 使用 filter().first() 避免重复用户记录问题
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if not user:
            return JsonResponse({'error': 'User not found'}, status=404)
        
        card = Card.objects.get(id=card_id)
        scheduler = SmartScheduler.objects.get(user=user)
        
        # 更新复习进度
        scheduler.update_progress_after_review(card, is_correct)
        
        return JsonResponse({
            'message': 'Review completed successfully',
            'is_correct': is_correct,
            'next_action': 'learning' if not is_correct else 'review'
        })
        
    except (User.DoesNotExist, Card.DoesNotExist, SmartScheduler.DoesNotExist) as e:
        return JsonResponse({'error': str(e)}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def smart_scheduler_dashboard(request):
    """智能调度器：获取学习仪表板"""
    try:
        username = request.GET.get('username')
        
        if not username:
            return JsonResponse({'error': 'Missing username parameter'}, status=400)
        
        # 使用Django标准User模型
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if not user:
            return JsonResponse({'error': 'User not found'}, status=404)
        
        scheduler, created = SmartScheduler.objects.get_or_create(user=user)
        
        # 获取队列统计
        learning_queue_count = LearningRecord.objects.filter(
            user=user, 
            queue=LearningRecord.LEARNING_QUEUE
        ).count()
        
        practice_queue_count = LearningRecord.objects.filter(
            user=user, 
            queue=LearningRecord.PRACTICE_QUEUE
        ).count()
        
        review_queue_count = LearningRecord.objects.filter(
            user=user, 
            queue=LearningRecord.REVIEW_QUEUE
        ).count()
        
        from django.utils import timezone
        due_review_count = LearningRecord.objects.filter(
            user=user, 
            queue=LearningRecord.REVIEW_QUEUE,
            next_review_date__lte=timezone.now()
        ).count()
        
        # 获取状态统计
        not_learned_count = LearningRecord.objects.filter(
            user=user, 
            status=LearningRecord.NOT_LEARNED
        ).count()
        
        learning_count = LearningRecord.objects.filter(
            user=user, 
            status=LearningRecord.LEARNING
        ).count()
        
        mastered_count = LearningRecord.objects.filter(
            user=user, 
            status=LearningRecord.MASTERED
        ).count()
        
        return JsonResponse({
            'user_stats': {
                'total_learned_cards': scheduler.total_learned_cards,
                'total_mastered_cards': scheduler.total_mastered_cards,
                'daily_goal': scheduler.daily_goal,
            },
            'queue_stats': {
                'learning_queue': learning_queue_count,
                'practice_queue': practice_queue_count,
                'review_queue': review_queue_count,
                'due_review': due_review_count,
            },
            'status_stats': {
                'not_learned': not_learned_count,
                'learning': learning_count,
                'mastered': mastered_count,
            }
        })
        
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def smart_scheduler_set_daily_goal(request):
    """智能调度器：设置每日目标"""
    try:
        import json
        data = json.loads(request.body)
        username = data.get('username')
        daily_goal = data.get('daily_goal')
        
        if not username or not daily_goal:
            return JsonResponse({'error': 'Missing username or daily_goal'}, status=400)
        
        # 使用Django标准User模型
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if not user:
            return JsonResponse({'error': 'User not found'}, status=404)
        
        scheduler = SmartScheduler.objects.get(user=user)
        
        scheduler.daily_goal = daily_goal
        scheduler.save()
        
        return JsonResponse({
            'message': 'Daily goal updated successfully',
            'daily_goal': daily_goal
        })
        
    except (User.DoesNotExist, SmartScheduler.DoesNotExist) as e:
        return JsonResponse({'error': str(e)}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# 学习记录管理API端点

@csrf_exempt
@require_http_methods(["GET", "POST"])
def admin_learning_records(request):
    """学习记录管理API - 获取所有学习记录或创建新记录"""
    if request.method == 'GET':
        try:
            username = request.GET.get('username')
            
            if username:
                # 获取特定用户的学习记录
                User = get_user_model()
                user = User.objects.filter(username=username).first()
                if not user:
                    return JsonResponse({'error': '用户不存在'}, status=404)
                
                records = LearningRecord.objects.filter(user=user).select_related('card', 'user')
            else:
                # 获取所有学习记录
                records = LearningRecord.objects.all().select_related('card', 'user')
            
            records_data = []
            for record in records:
                records_data.append({
                    'id': record.id,
                    'username': record.user.username,
                    'card_id': str(record.card.id),
                    'card_title': record.card.title or '无标题',
                    'card_content': record.card.content[:100] + '...' if len(record.card.content) > 100 else record.card.content,
                    'status': record.status,
                    'status_display': record.get_status_display(),
                    'queue': record.queue,
                    'queue_display': record.get_queue_display(),
                    'first_learned': record.first_learned.isoformat() if record.first_learned else None,
                    'last_accessed': record.last_accessed.isoformat() if record.last_accessed else None,
                    'mastered_time': record.mastered_time.isoformat() if record.mastered_time else None,
                    'review_count': record.review_count,
                    'next_review_date': record.next_review_date.isoformat() if record.next_review_date else None,
                    'practice_attempts': record.practice_attempts,
                    'practice_correct_count': record.practice_correct_count,
                    'total_attempts': record.total_attempts,
                    'total_questions': record.card.get_total_questions_count(),
                    'correct_answers': record.card.get_user_correct_answers_count(record.user)
                })
            
            return JsonResponse(records_data, safe=False)
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == 'POST':
        # 创建新的学习记录
        try:
            data = json.loads(request.body)
            username = data.get('username')
            card_id = data.get('card_id')
            status = data.get('status', LearningRecord.NOT_LEARNED)
            queue = data.get('queue', LearningRecord.LEARNING_QUEUE)
            
            if not username or not card_id:
                return JsonResponse({'error': '缺少必要参数'}, status=400)
            
            # 获取用户和卡片
            User = get_user_model()
            user = User.objects.filter(username=username).first()
            if not user:
                return JsonResponse({'error': '用户不存在'}, status=404)
            
            card = Card.objects.get(id=card_id)
            
            # 创建学习记录
            record, created = LearningRecord.objects.get_or_create(
                user=user,
                card=card,
                defaults={
                    'status': status,
                    'queue': queue
                }
            )
            
            if not created:
                return JsonResponse({'error': '学习记录已存在'}, status=400)
            
            return JsonResponse({
                'id': record.id,
                'username': record.user.username,
                'card_id': str(record.card.id),
                'card_title': record.card.title,
                'status': record.status,
                'queue': record.queue,
                'created': True
            })
            
        except (User.DoesNotExist, Card.DoesNotExist) as e:
            return JsonResponse({'error': str(e)}, status=404)
        except json.JSONDecodeError:
            return JsonResponse({'error': '无效的JSON格式'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["PUT", "DELETE"])
def admin_learning_records_detail(request, record_id):
    """学习记录管理API - 更新或删除指定学习记录"""
    try:
        record = LearningRecord.objects.get(id=record_id)
    except LearningRecord.DoesNotExist:
        return JsonResponse({'error': '学习记录不存在'}, status=404)
    
    if request.method == 'PUT':
        # 更新学习记录
        try:
            data = json.loads(request.body)
            
            # 更新状态
            if 'status' in data:
                new_status = data['status']
                if new_status not in [LearningRecord.NOT_LEARNED, LearningRecord.LEARNING, LearningRecord.MASTERED]:
                    return JsonResponse({'error': '无效的状态值'}, status=400)
                record.status = new_status
                
                # 根据状态更新相关字段
                if new_status == LearningRecord.MASTERED and not record.mastered_time:
                    record.mastered_time = timezone.now()
                elif new_status != LearningRecord.MASTERED:
                    record.mastered_time = None
            
            # 更新队列
            if 'queue' in data:
                new_queue = data['queue']
                if new_queue not in [LearningRecord.LEARNING_QUEUE, LearningRecord.PRACTICE_QUEUE, LearningRecord.REVIEW_QUEUE]:
                    return JsonResponse({'error': '无效的队列值'}, status=400)
                record.queue = new_queue
            
            # 更新复习相关字段
            if 'review_count' in data:
                record.review_count = data['review_count']
            if 'practice_attempts' in data:
                record.practice_attempts = data['practice_attempts']
            if 'practice_correct_count' in data:
                record.practice_correct_count = data['practice_correct_count']
            
            record.save()
            
            return JsonResponse({
                'id': record.id,
                'username': record.user.username,
                'card_id': str(record.card.id),
                'card_title': record.card.title,
                'status': record.status,
                'status_display': record.get_status_display(),
                'queue': record.queue,
                'queue_display': record.get_queue_display(),
                'first_learned': record.first_learned.isoformat() if record.first_learned else None,
                'last_accessed': record.last_accessed.isoformat() if record.last_accessed else None,
                'mastered_time': record.mastered_time.isoformat() if record.mastered_time else None,
                'review_count': record.review_count,
                'next_review_date': record.next_review_date.isoformat() if record.next_review_date else None,
                'practice_attempts': record.practice_attempts,
                'practice_correct_count': record.practice_correct_count,
                'total_attempts': record.total_attempts,
                'updated': True
            })
            
        except json.JSONDecodeError:
            return JsonResponse({'error': '无效的JSON格式'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    elif request.method == 'DELETE':
        # 删除学习记录
        try:
            record.delete()
            return JsonResponse({'message': '学习记录已删除'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def admin_users_list(request):
    """获取所有用户列表"""
    try:
        User = get_user_model()
        users = User.objects.all().order_by('username')
        users_data = []
        
        for user in users:
            # 获取用户的学习统计
            total_records = LearningRecord.objects.filter(user=user).count()
            mastered_count = LearningRecord.objects.filter(user=user, status=LearningRecord.MASTERED).count()
            learning_count = LearningRecord.objects.filter(user=user, status=LearningRecord.LEARNING).count()
            
            users_data.append({
                'id': user.id,
                'username': user.username,
                'date_joined': user.date_joined.isoformat() if hasattr(user, 'date_joined') else None,
                'total_records': total_records,
                'mastered_count': mastered_count,
                'learning_count': learning_count,
                'not_learned_count': total_records - mastered_count - learning_count
            })
        
        return JsonResponse(users_data, safe=False)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# 复习相关接口

@csrf_exempt
@require_http_methods(["POST"])
def get_random_question_for_review(request):
    """随机获取卡片的一个问题用于复习"""
    try:
        data = json.loads(request.body)
        card_id = data.get('card_id')
        username = data.get('username')
        
        if not card_id or not username:
            return JsonResponse({'error': '缺少必要参数'}, status=400)
        
        # 获取用户
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if not user:
            return JsonResponse({'error': '用户不存在'}, status=404)
        
        # 获取卡片
        try:
            card = Card.objects.get(id=card_id)
        except Card.DoesNotExist:
            return JsonResponse({'error': '卡片不存在'}, status=404)
        
        # 获取该卡片的所有问题
        questions = list(card.questions.all())
        
        # 如果没有问题，自动生成问题
        if not questions:
            # 自动生成3个问题
            ai_requirements = "生成3道题目，包括1道选择题、1道简答题、1道代码题，难度中等，用于复习巩固"
            
            try:
                ai_response = generate_questions_with_ai(card.content, ai_requirements)
                
                # 解析AI响应
                json_start = ai_response.find('{')
                json_end = ai_response.rfind('}') + 1
                if json_start != -1 and json_end != -1:
                    json_str = ai_response[json_start:json_end]
                    questions_data = json.loads(json_str)
                    
                    if 'questions' in questions_data:
                        # 获取当前最大order值
                        max_order = card.questions.aggregate(max_order=models.Max('order'))['max_order'] or 0
                        
                        # 创建问题
                        created_questions = []
                        for i, question_data in enumerate(questions_data['questions']):
                            if not all(key in question_data for key in ['content', 'type', 'correct_answer']):
                                continue
                            
                            # 映射题目类型
                            type_mapping = {'choice': 1, 'short_answer': 2, 'code': 3}
                            question_type = type_mapping.get(question_data['type'], 1)
                            
                            # 处理选择题选项
                            options = question_data.get('options', []) if question_type == 1 else []
                            
                            question = Question.objects.create(
                                card=card,
                                content=question_data['content'],
                                question_type=question_type,
                                options=options,
                                correct_answer=question_data['correct_answer'],
                                order=max_order + i + 1
                            )
                            created_questions.append(question)
                        
                        questions = created_questions
                        
            except Exception as e:
                # 如果生成失败，返回错误
                return JsonResponse({'error': f'自动生成问题失败: {str(e)}'}, status=500)
        
        # 从问题中随机选择一个
        if questions:
            import random
            selected_question = random.choice(questions)
            
            # 映射问题类型到前端期望的字符串格式
            type_mapping = {1: 'choice', 2: 'short_answer', 3: 'code'}
            
            return JsonResponse({
                'id': selected_question.id,
                'content': selected_question.content,
                'type': type_mapping.get(selected_question.question_type, 'choice'),
                'options': selected_question.options if selected_question.question_type == 1 else [],
                'card_id': str(card.id),
                'card_title': card.title,
                'card_content': card.content,
                'total_questions': len(questions),
                'auto_generated': not bool(card.questions.count())
            })
        else:
            return JsonResponse({'error': '无法获取或生成问题'}, status=404)
            
    except json.JSONDecodeError:
        return JsonResponse({'error': '无效的JSON格式'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def submit_review_answer(request):
    """提交复习答案"""
    try:
        data = json.loads(request.body)
        question_id = data.get('question_id')
        username = data.get('username')
        answer = data.get('answer')
        card_id = data.get('card_id')
        
        if not all([question_id, username, answer, card_id]):
            return JsonResponse({'error': '缺少必要参数'}, status=400)
        
        # 获取用户和问题
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if not user:
            return JsonResponse({'error': '用户不存在'}, status=404)
        
        try:
            question = Question.objects.get(id=question_id)
            card = Card.objects.get(id=card_id)
        except (Question.DoesNotExist, Card.DoesNotExist):
            return JsonResponse({'error': '问题或卡片不存在'}, status=404)
        
        # 判断答案是否正确
        is_correct = False
        code_output = None
        
        if question.question_type == 1:  # 选择题
            try:
                # 答案可能是索引或者选项内容
                if answer.isdigit():
                    # 如果是数字，直接比较索引
                    is_correct = str(answer) == str(question.correct_answer)
                else:
                    # 如果是文本，查找对应的索引
                    try:
                        answer_index = question.options.index(answer)
                        is_correct = str(answer_index) == str(question.correct_answer)
                    except ValueError:
                        is_correct = False
            except Exception:
                is_correct = False
                
        elif question.question_type == 2:  # 简答题
            # 对于简答题，我们需要AI来判断
            prompt = f"""
            分析简答题：
            问题：{question.content}
            参考答案：{question.correct_answer}
            用户答案：{answer}
            请判断用户的回答是否正确。如果正确，在回答末尾添加<correct>，如果错误，在回答末尾添加<wrong>
            """
            
            try:
                from utils.chat import analyze_with_ai
                analysis = analyze_with_ai(prompt)
                is_correct = analysis and analysis.endswith('<correct>')
            except Exception:
                is_correct = False
                
        elif question.question_type == 3:  # 代码题
            # 执行代码并比较输出
            try:
                process = subprocess.run(
                    ['python', '-c', answer],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    check=True
                )
                code_output = process.stdout.strip()
                is_correct = code_output == question.correct_answer.strip()
            except subprocess.TimeoutExpired:
                code_output = "代码执行超时"
                is_correct = False
            except Exception as e:
                code_output = str(e)
                is_correct = False
        
        # 保存答题记录
        AnswerRecord.objects.create(
            user=user,
            question=question,
            user_answer=answer,
            is_correct=is_correct,
            ai_analysis=f"复习答题，结果：{'正确' if is_correct else '错误'}",
            code_output=code_output if question.question_type == 3 else None
        )
        
        # 获取该卡片的其他问题（如果当前答案错误）
        other_questions = []
        if not is_correct:
            other_questions_queryset = card.questions.exclude(id=question_id)
            other_questions = [
                {
                    'id': q.id,
                    'content': q.content,
                    'type': {1: 'choice', 2: 'short_answer', 3: 'code'}[q.question_type],
                    'options': q.options if q.question_type == 1 else []
                }
                for q in other_questions_queryset
            ]
        
        return JsonResponse({
            'is_correct': is_correct,
            'correct_answer': question.correct_answer,
            'explanation': f"{'恭喜答对了！' if is_correct else '答案错误，正确答案是：' + str(question.correct_answer)}",
            'code_output': code_output,
            'other_questions': other_questions,
            'can_try_other': len(other_questions) > 0
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': '无效的JSON格式'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def get_next_review_question(request):
    """获取下一道复习问题（同一卡片的其他问题）"""
    try:
        data = json.loads(request.body)
        card_id = data.get('card_id')
        username = data.get('username')
        exclude_question_ids = data.get('exclude_question_ids', [])
        
        if not card_id or not username:
            return JsonResponse({'error': '缺少必要参数'}, status=400)
        
        # 获取用户和卡片
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if not user:
            return JsonResponse({'error': '用户不存在'}, status=404)
        
        try:
            card = Card.objects.get(id=card_id)
        except Card.DoesNotExist:
            return JsonResponse({'error': '卡片不存在'}, status=404)
        
        # 获取该卡片的其他问题
        questions = card.questions.exclude(id__in=exclude_question_ids)
        
        if not questions.exists():
            return JsonResponse({'error': '没有更多问题了'}, status=404)
        
        # 随机选择一个问题
        import random
        selected_question = random.choice(list(questions))
        
        # 映射问题类型到前端期望的字符串格式
        type_mapping = {1: 'choice', 2: 'short_answer', 3: 'code'}
        
        return JsonResponse({
            'id': selected_question.id,
            'content': selected_question.content,
            'type': type_mapping.get(selected_question.question_type, 'choice'),
            'options': selected_question.options if selected_question.question_type == 1 else [],
            'card_id': str(card.id),
            'card_title': card.title,
            'remaining_questions': questions.count() - 1
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': '无效的JSON格式'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def export_cards(request):
    """
    导出所有卡片和问题到JSON
    """
    try:
        from .import_export import export_cards_to_json
        import tempfile
        import os
        from django.http import FileResponse
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as temp_file:
            temp_path = temp_file.name
        
        # 导出数据
        export_cards_to_json(temp_path)
        
        # 返回文件响应
        response = FileResponse(
            open(temp_path, 'rb'),
            content_type='application/json',
            as_attachment=True,
            filename=f'cards_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        )
        
        # 在响应后删除临时文件
        def cleanup():
            try:
                os.unlink(temp_path)
            except:
                pass
        
        # 使用Django的信号在响应发送后清理文件
        from django.core.signals import request_finished
        request_finished.connect(lambda **kwargs: cleanup(), weak=False)
        
        return response
        
    except Exception as e:
        return JsonResponse({'error': f'导出失败: {str(e)}'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def import_cards(request):
    """
    从JSON文件导入卡片和问题
    """
    try:
        from .import_export import import_cards_from_json, validate_import_file
        import tempfile
        import os
        
        # 检查是否有文件上传
        if 'file' not in request.FILES:
            return JsonResponse({'error': '请选择要导入的文件'}, status=400)
        
        uploaded_file = request.FILES['file']
        
        # 检查文件类型
        if not uploaded_file.name.endswith('.json'):
            return JsonResponse({'error': '请上传JSON文件'}, status=400)
        
        # 获取是否覆盖现有数据的参数
        overwrite = request.POST.get('overwrite', 'false').lower() == 'true'
        
        # 保存上传的文件到临时位置
        with tempfile.NamedTemporaryFile(mode='w+b', suffix='.json', delete=False) as temp_file:
            for chunk in uploaded_file.chunks():
                temp_file.write(chunk)
            temp_path = temp_file.name
        
        try:
            # 验证文件格式
            is_valid, error_message = validate_import_file(temp_path)
            if not is_valid:
                return JsonResponse({'error': f'文件格式错误: {error_message}'}, status=400)
            
            # 导入数据
            result = import_cards_from_json(temp_path, overwrite=overwrite)
            
            return JsonResponse({
                'success': True,
                'message': '导入成功',
                'imported_cards': result['imported_cards'],
                'imported_questions': result['imported_questions'],
                'skipped_cards': result['skipped_cards']
            })
            
        finally:
            # 清理临时文件
            try:
                os.unlink(temp_path)
            except:
                pass
                
    except Exception as e:
        return JsonResponse({'error': f'导入失败: {str(e)}'}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def export_single_card(request, card_id):
    """
    导出单个卡片到JSON
    """
    try:
        from .import_export import export_single_card
        import tempfile
        import os
        from django.http import FileResponse
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as temp_file:
            temp_path = temp_file.name
        
        # 导出单个卡片
        export_single_card(card_id, temp_path)
        
        # 获取卡片标题用于文件名
        try:
            card = Card.objects.get(id=card_id)
            filename = f'card_{card.title}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        except Card.DoesNotExist:
            filename = f'card_{card_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        
        # 返回文件响应
        response = FileResponse(
            open(temp_path, 'rb'),
            content_type='application/json',
            as_attachment=True,
            filename=filename
        )
        
        # 在响应后删除临时文件
        def cleanup():
            try:
                os.unlink(temp_path)
            except:
                pass
        
        # 使用Django的信号在响应发送后清理文件
        from django.core.signals import request_finished
        request_finished.connect(lambda **kwargs: cleanup(), weak=False)
        
        return response
        
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=404)
    except Exception as e:
        return JsonResponse({'error': f'导出失败: {str(e)}'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def validate_import_file_api(request):
    """
    验证导入文件的格式
    """
    try:
        from .import_export import validate_import_file
        import tempfile
        import os
        
        # 检查是否有文件上传
        if 'file' not in request.FILES:
            return JsonResponse({'error': '请选择要验证的文件'}, status=400)
        
        uploaded_file = request.FILES['file']
        
        # 检查文件类型
        if not uploaded_file.name.endswith('.json'):
            return JsonResponse({'error': '请上传JSON文件'}, status=400)
        
        # 保存上传的文件到临时位置
        with tempfile.NamedTemporaryFile(mode='w+b', suffix='.json', delete=False) as temp_file:
            for chunk in uploaded_file.chunks():
                temp_file.write(chunk)
            temp_path = temp_file.name
        
        try:
            # 验证文件格式
            is_valid, message = validate_import_file(temp_path)
            
            if is_valid:
                # 如果验证通过，返回文件信息
                import json
                with open(temp_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                cards_count = len(data.get('cards', []))
                questions_count = sum(len(card.get('questions', [])) for card in data.get('cards', []))
                
                return JsonResponse({
                    'valid': True,
                    'message': message,
                    'cards_count': cards_count,
                    'questions_count': questions_count,
                    'export_info': data.get('export_info', {})
                })
            else:
                return JsonResponse({
                    'valid': False,
                    'message': message
                })
                
        finally:
            # 清理临时文件
            try:
                os.unlink(temp_path)
            except:
                pass
                
    except Exception as e:
        return JsonResponse({'error': f'验证失败: {str(e)}'}, status=500)