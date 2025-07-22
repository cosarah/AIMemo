from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

# Create your models here.
class Card(models.Model):
    id = models.UUIDField(primary_key=True)  # 根据前端card.id格式确定
    content = models.TextField()
    title = models.CharField(max_length=200, default="", blank=True)  # 卡片标题
    # 前置卡片依赖关系
    prerequisites = models.ManyToManyField(
        'self', 
        blank=True, 
        symmetrical=False,
        related_name='dependent_cards',
        help_text="学习此卡片前需要先学习的卡片"
    )
    # 可以添加其他字段如owner等
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.title or f"Card {self.id}"
        
    def is_unlocked_for_user(self, user):
        """检查对于指定用户，此卡片是否已解锁（前置条件已满足）"""
        # 获取所有前置卡片
        prerequisites = self.prerequisites.all()
        if not prerequisites.exists():
            return True  # 没有前置要求，直接解锁
            
        # 检查所有前置卡片是否都已学习
        for prereq in prerequisites:
            if not LearningRecord.objects.filter(
                user=user, 
                card=prereq,
                status=LearningRecord.MASTERED
            ).exists():
                return False
        return True

    def get_total_questions_count(self):
        """获取卡片的总问题数"""
        return self.questions.count()

    def get_user_correct_answers_count(self, user):
        """获取用户对此卡片正确回答的问题数"""
        return AnswerRecord.objects.filter(
            user=user,
            question__card=self,
            is_correct=True
        ).values('question').distinct().count()

class LearningRecord(models.Model):
    """用户学习记录和状态管理"""
    
    # 卡片状态
    NOT_LEARNED = 'not_learned'
    LEARNING = 'learning'
    MASTERED = 'mastered'
    
    STATUS_CHOICES = [
        (NOT_LEARNED, '未学过'),
        (LEARNING, '学过但未完全掌握'),
        (MASTERED, '完全掌握'),
    ]
    
    # 队列类型
    LEARNING_QUEUE = 'learning'
    PRACTICE_QUEUE = 'practice'
    REVIEW_QUEUE = 'review'
    
    QUEUE_CHOICES = [
        (LEARNING_QUEUE, '学习队列'),
        (PRACTICE_QUEUE, '练习队列'),
        (REVIEW_QUEUE, '复习队列'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    card = models.ForeignKey(Card, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=NOT_LEARNED)
    queue = models.CharField(max_length=20, choices=QUEUE_CHOICES, default=LEARNING_QUEUE)
    
    # 学习相关时间
    first_learned = models.DateTimeField(null=True, blank=True)  # 首次学习时间
    last_accessed = models.DateTimeField(auto_now=True)  # 最后访问时间
    mastered_time = models.DateTimeField(null=True, blank=True)  # 完全掌握时间
    
    # 复习相关
    review_count = models.PositiveIntegerField(default=0)  # 复习次数
    next_review_date = models.DateTimeField(null=True, blank=True)  # 下次复习时间
    review_interval = models.PositiveIntegerField(default=1)  # 复习间隔（天）
    
    # 练习相关
    practice_attempts = models.PositiveIntegerField(default=0)  # 练习次数
    practice_correct_count = models.PositiveIntegerField(default=0)  # 练习正确次数
    
    # 统计信息
    total_attempts = models.PositiveIntegerField(default=0)  # 总尝试次数
    
    class Meta:
        unique_together = ['user', 'card']
        indexes = [
            models.Index(fields=['user', 'queue']),
            models.Index(fields=['next_review_date']),
            models.Index(fields=['status']),
        ]
        
    def __str__(self):
        return f"{self.user.username} - {self.card} ({self.get_status_display()})"

    def update_status_after_learning(self):
        """学习后更新状态"""
        if self.status == self.NOT_LEARNED:
            self.first_learned = timezone.now()
            
            # 检查卡片是否有对应的问题
            total_questions = self.card.get_total_questions_count()
            
            if total_questions == 0:
                # 没有对应问题的卡片，学习后直接置为mastered
                self.status = self.MASTERED
                self.queue = self.REVIEW_QUEUE
                self.mastered_time = timezone.now()
                self.next_review_date = timezone.now() + timedelta(days=self.review_interval)
            else:
                # 有问题的卡片，按原逻辑处理
                self.status = self.LEARNING
                self.queue = self.PRACTICE_QUEUE
        self.save()

    def update_status_after_practice(self):
        """练习后更新状态"""
        total_questions = self.card.get_total_questions_count()
        correct_answers = self.card.get_user_correct_answers_count(self.user)
        
        if correct_answers >= total_questions and total_questions > 0:
            # 完全掌握，移到复习队列
            self.status = self.MASTERED
            self.queue = self.REVIEW_QUEUE
            self.mastered_time = timezone.now()
            self.next_review_date = timezone.now() + timedelta(days=self.review_interval)
        
        self.save()

    def update_status_after_review(self, is_correct):
        """复习后更新状态"""
        self.review_count += 1
        
        if is_correct:
            # 正确回答，增加复习间隔
            self.review_interval = min(self.review_interval * 2, 180)  # 最大间隔180天
            self.next_review_date = timezone.now() + timedelta(days=self.review_interval)
        else:
            # 错误回答，回到学习队列
            self.status = self.LEARNING
            self.queue = self.LEARNING_QUEUE
            self.next_review_date = None
            self.review_interval = 1  # 重置间隔
        
        self.save()

class SmartScheduler(models.Model):
    """智能调度器"""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    
    # 当前学习进度
    current_learning_card = models.ForeignKey(
        Card, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='current_learning_users'
    )
    current_practice_card = models.ForeignKey(
        Card, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='current_practice_users'
    )
    
    # 统计信息
    total_learned_cards = models.PositiveIntegerField(default=0)
    total_mastered_cards = models.PositiveIntegerField(default=0)
    daily_goal = models.PositiveIntegerField(default=5)  # 每日学习目标
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"智能调度器 - {self.user.username}"

    def get_next_learning_card(self):
        """获取下一张学习卡片"""
        # 检查当前正在学习的卡片是否还需要学习
        if self.current_learning_card and self.current_learning_card.is_unlocked_for_user(self.user):
            try:
                current_record = LearningRecord.objects.get(
                    user=self.user, 
                    card=self.current_learning_card
                )
                # 如果当前卡片已经掌握，清空当前学习卡片并继续寻找
                if current_record.status == LearningRecord.MASTERED:
                    self.current_learning_card = None
                    self.save()
                else:
                    # 如果还需要学习，返回这张卡片
                    return self.current_learning_card
            except LearningRecord.DoesNotExist:
                # 如果没有学习记录，清空当前学习卡片
                self.current_learning_card = None
                self.save()
        
        # 获取学习队列中的下一张卡片
        learning_records = LearningRecord.objects.filter(
            user=self.user,
            queue=LearningRecord.LEARNING_QUEUE,
            status__in=[LearningRecord.NOT_LEARNED, LearningRecord.LEARNING]
        ).select_related('card')
        
        for record in learning_records:
            if record.card.is_unlocked_for_user(self.user):
                self.current_learning_card = record.card
                self.save()
                return record.card
        
        # 如果没有学习队列中的卡片，创建新的学习记录
        available_cards = Card.objects.exclude(
            id__in=LearningRecord.objects.filter(user=self.user).values('card_id')
        )
        
        for card in available_cards:
            if card.is_unlocked_for_user(self.user):
                # 创建新的学习记录
                LearningRecord.objects.create(
                    user=self.user,
                    card=card,
                    status=LearningRecord.NOT_LEARNED,
                    queue=LearningRecord.LEARNING_QUEUE
                )
                self.current_learning_card = card
                self.save()
                return card
        
        return None

    def get_next_practice_card(self):
        """获取下一张练习卡片"""
        # 优先获取当前正在练习的卡片
        if self.current_practice_card:
            return self.current_practice_card
        
        # 获取练习队列中的卡片
        practice_records = LearningRecord.objects.filter(
            user=self.user,
            queue=LearningRecord.PRACTICE_QUEUE,
            status=LearningRecord.LEARNING
        ).select_related('card')
        
        for record in practice_records:
            self.current_practice_card = record.card
            self.save()
            return record.card
        
        return None

    def get_next_review_card(self):
        """获取下一张复习卡片"""
        # 获取到期的复习卡片
        review_records = LearningRecord.objects.filter(
            user=self.user,
            queue=LearningRecord.REVIEW_QUEUE,
            status=LearningRecord.MASTERED,
            next_review_date__lte=timezone.now()
        ).select_related('card').order_by('next_review_date')
        
        if review_records.exists():
            return review_records.first().card
        
        return None

    def update_progress_after_learning(self, card):
        """学习后更新进度"""
        try:
            record = LearningRecord.objects.get(user=self.user, card=card)
            record.update_status_after_learning()
            
            if record.status == LearningRecord.LEARNING:
                self.total_learned_cards += 1
                self.current_practice_card = card
                self.current_learning_card = None
                self.save()
                
        except LearningRecord.DoesNotExist:
            pass

    def update_progress_after_practice(self, card):
        """练习后更新进度"""
        try:
            record = LearningRecord.objects.get(user=self.user, card=card)
            record.update_status_after_practice()
            
            if record.status == LearningRecord.MASTERED:
                self.total_mastered_cards += 1
                self.current_practice_card = None
                # 如果当前学习卡片也是这张卡片，清空它
                if self.current_learning_card == card:
                    self.current_learning_card = None
                self.save()
                
        except LearningRecord.DoesNotExist:
            pass

    def update_progress_after_review(self, card, is_correct):
        """复习后更新进度"""
        try:
            record = LearningRecord.objects.get(user=self.user, card=card)
            record.update_status_after_review(is_correct)
            
            if record.status == LearningRecord.LEARNING:
                # 从复习队列回到学习队列
                self.current_learning_card = card
                self.save()
                
        except LearningRecord.DoesNotExist:
            pass

class CardRecord(models.Model):
    id = models.UUIDField(primary_key=True)
    content = models.TextField()
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    last_access = models.DateTimeField()
    last_score = models.FloatField()

class ChatRecord(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    card = models.ForeignKey(Card, on_delete=models.CASCADE)
    message = models.TextField()
    reply = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class Question(models.Model):
    QUESTION_TYPES = (
        (1, 'choice'),
        (2, 'short_answer'),
        (3, 'code')
    )
    
    card = models.ForeignKey('Card', on_delete=models.CASCADE, related_name='questions')
    content = models.TextField()
    question_type = models.PositiveIntegerField(choices=QUESTION_TYPES)
    options = models.JSONField(default=list, blank=True)  # 存储选择题的选项
    correct_answer = models.TextField()
    order = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        indexes = [
            models.Index(fields=['card', 'order'])
        ]
        
    def __str__(self):
        return f"Question {self.id} - {self.content[:50]}..."

class AnswerRecord(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    user_answer = models.TextField()
    is_correct = models.BooleanField()
    ai_analysis = models.TextField()
    code_output = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'question']),
            models.Index(fields=['is_correct']),
        ]

class User(models.Model):
    username = models.TextField()
    password = models.TextField(default='')  # 添加默认值
    created_at = models.DateTimeField(auto_now_add=True)
    current_card_id = models.PositiveIntegerField(default=0)
    current_question_id = models.PositiveIntegerField(default=0)
    review_card_id = models.PositiveIntegerField(default=0)