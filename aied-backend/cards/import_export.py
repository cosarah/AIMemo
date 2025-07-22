import json
import os
from datetime import datetime
from django.core.serializers import serialize
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from .models import Card, Question, AnswerRecord, LearningRecord


def export_cards_to_json(export_path=None):
    """
    导出所有卡片和问题到JSON文件
    """
    if export_path is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_path = f"export_cards_{timestamp}.json"
    
    # 获取所有卡片
    cards = Card.objects.all()
    
    export_data = {
        "export_info": {
            "export_time": datetime.now().isoformat(),
            "total_cards": cards.count(),
            "total_questions": Question.objects.count()
        },
        "cards": []
    }
    
    for card in cards:
        # 构建卡片数据
        card_data = {
            "id": str(card.id),
            "content": card.content,
            "title": card.title,
            "created_at": card.created_at.isoformat(),
            "prerequisites": [str(prereq.id) for prereq in card.prerequisites.all()],
            "questions": []
        }
        
        # 获取卡片的所有问题
        questions = Question.objects.filter(card=card).order_by('order')
        for question in questions:
            question_data = {
                "id": question.id,
                "content": question.content,
                "question_type": question.question_type,
                "options": question.options,
                "correct_answer": question.correct_answer,
                "order": question.order,
                "created_at": question.created_at.isoformat()
            }
            card_data["questions"].append(question_data)
        
        export_data["cards"].append(card_data)
    
    # 写入JSON文件
    with open(export_path, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2, cls=DjangoJSONEncoder)
    
    print(f"导出完成: {export_path}")
    print(f"导出了 {len(export_data['cards'])} 张卡片和 {export_data['export_info']['total_questions']} 个问题")
    
    return export_path


def import_cards_from_json(import_path, overwrite=False):
    """
    从JSON文件导入卡片和问题
    
    Args:
        import_path: 导入文件路径
        overwrite: 是否覆盖已存在的卡片
    """
    if not os.path.exists(import_path):
        raise FileNotFoundError(f"导入文件不存在: {import_path}")
    
    with open(import_path, 'r', encoding='utf-8') as f:
        import_data = json.load(f)
    
    if "cards" not in import_data:
        raise ValueError("无效的导入文件格式")
    
    imported_cards = 0
    imported_questions = 0
    skipped_cards = 0
    
    # 使用事务确保数据一致性
    with transaction.atomic():
        # 第一遍：创建所有卡片（不处理前置条件）
        card_mapping = {}  # 用于映射导入的卡片ID到实际卡片对象
        
        for card_data in import_data["cards"]:
            card_id = card_data["id"]
            
            # 检查卡片是否已存在
            existing_card = Card.objects.filter(id=card_id).first()
            
            if existing_card and not overwrite:
                print(f"跳过已存在的卡片: {card_data['title']} ({card_id})")
                card_mapping[card_id] = existing_card
                skipped_cards += 1
                continue
            
            # 创建或更新卡片
            if existing_card and overwrite:
                card = existing_card
                card.content = card_data["content"]
                card.title = card_data["title"]
                card.save()
                
                # 删除现有问题
                Question.objects.filter(card=card).delete()
                print(f"更新卡片: {card.title} ({card_id})")
            else:
                # 创建新卡片
                card = Card.objects.create(
                    id=card_id,
                    content=card_data["content"],
                    title=card_data["title"]
                )
                imported_cards += 1
                print(f"创建新卡片: {card.title} ({card_id})")
            
            card_mapping[card_id] = card
            
            # 创建问题
            for question_data in card_data.get("questions", []):
                Question.objects.create(
                    card=card,
                    content=question_data["content"],
                    question_type=question_data["question_type"],
                    options=question_data.get("options", []),
                    correct_answer=question_data["correct_answer"],
                    order=question_data["order"]
                )
                imported_questions += 1
        
        # 第二遍：处理前置条件
        for card_data in import_data["cards"]:
            card_id = card_data["id"]
            card = card_mapping.get(card_id)
            
            if card and card_data.get("prerequisites"):
                # 清除现有前置条件
                card.prerequisites.clear()
                
                # 添加新的前置条件
                for prereq_id in card_data["prerequisites"]:
                    prereq_card = card_mapping.get(prereq_id)
                    if prereq_card:
                        card.prerequisites.add(prereq_card)
                    else:
                        print(f"警告: 找不到前置卡片 {prereq_id} 对于卡片 {card.title}")
    
    print(f"\n导入完成:")
    print(f"导入了 {imported_cards} 张新卡片")
    print(f"导入了 {imported_questions} 个问题")
    print(f"跳过了 {skipped_cards} 张已存在的卡片")
    
    return {
        "imported_cards": imported_cards,
        "imported_questions": imported_questions,
        "skipped_cards": skipped_cards
    }


def export_single_card(card_id, export_path=None):
    """
    导出单个卡片到JSON文件
    """
    try:
        card = Card.objects.get(id=card_id)
    except Card.DoesNotExist:
        raise ValueError(f"卡片不存在: {card_id}")
    
    if export_path is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_path = f"export_card_{card.title}_{timestamp}.json"
    
    # 构建卡片数据
    card_data = {
        "id": str(card.id),
        "content": card.content,
        "title": card.title,
        "created_at": card.created_at.isoformat(),
        "prerequisites": [str(prereq.id) for prereq in card.prerequisites.all()],
        "questions": []
    }
    
    # 获取卡片的所有问题
    questions = Question.objects.filter(card=card).order_by('order')
    for question in questions:
        question_data = {
            "id": question.id,
            "content": question.content,
            "question_type": question.question_type,
            "options": question.options,
            "correct_answer": question.correct_answer,
            "order": question.order,
            "created_at": question.created_at.isoformat()
        }
        card_data["questions"].append(question_data)
    
    export_data = {
        "export_info": {
            "export_time": datetime.now().isoformat(),
            "export_type": "single_card",
            "total_cards": 1,
            "total_questions": len(card_data["questions"])
        },
        "cards": [card_data]
    }
    
    # 写入JSON文件
    with open(export_path, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2, cls=DjangoJSONEncoder)
    
    print(f"单个卡片导出完成: {export_path}")
    print(f"导出了卡片 '{card.title}' 和 {len(card_data['questions'])} 个问题")
    
    return export_path


def validate_import_file(import_path):
    """
    验证导入文件的格式和内容
    """
    if not os.path.exists(import_path):
        return False, "导入文件不存在"
    
    try:
        with open(import_path, 'r', encoding='utf-8') as f:
            import_data = json.load(f)
    except json.JSONDecodeError as e:
        return False, f"JSON格式错误: {str(e)}"
    
    # 验证基本结构
    if "cards" not in import_data:
        return False, "文件中缺少'cards'字段"
    
    if not isinstance(import_data["cards"], list):
        return False, "'cards'字段必须是列表"
    
    # 验证每个卡片的结构
    required_fields = ["id", "content", "title"]
    for i, card_data in enumerate(import_data["cards"]):
        for field in required_fields:
            if field not in card_data:
                return False, f"第{i+1}个卡片缺少必需字段: {field}"
        
        # 验证问题结构
        if "questions" in card_data:
            question_required_fields = ["content", "question_type", "correct_answer", "order"]
            for j, question_data in enumerate(card_data["questions"]):
                for field in question_required_fields:
                    if field not in question_data:
                        return False, f"第{i+1}个卡片的第{j+1}个问题缺少必需字段: {field}"
    
    return True, "文件格式验证通过"