"""aied URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from cards.views import (
    card_navigation, question_navigation, chat_view, submit_answer, login, register, check_username,
    admin_cards_list, admin_cards_detail, admin_questions_list, admin_questions_detail,
    admin_cards_dependencies, admin_ai_generate_questions, admin_ai_batch_create_questions,
    smart_scheduler_next_card, smart_scheduler_complete_learning,
    smart_scheduler_complete_practice, smart_scheduler_complete_review,
    smart_scheduler_dashboard, smart_scheduler_set_daily_goal, admin_learning_records,
    admin_learning_records_detail, admin_users_list,
    get_random_question_for_review, submit_review_answer, get_next_review_question,
    export_cards, import_cards, export_single_card, validate_import_file_api
)


urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('chat/', chat_view),
    path('card/', card_navigation),
    path('question/', question_navigation),
    path('submit/', submit_answer),
    path('login/', login),
    path('register/', register),  # 注册API
    path('check-username/', check_username),  # 用户名检查API
    
    # 卡片管理API端点
    path('admin/cards/', admin_cards_list),  # GET: 获取所有卡片, POST: 创建新卡片
    path('admin/cards/dependencies/', admin_cards_dependencies),  # GET: 获取卡片依赖关系图数据
    path('admin/cards/<str:card_id>/', admin_cards_detail),  # PUT: 更新卡片, DELETE: 删除卡片
    
    # 问题管理API端点
    path('admin/cards/<str:card_id>/questions/', admin_questions_list),  # GET: 获取问题列表, POST: 创建新问题
    path('admin/cards/<str:card_id>/questions/<int:question_id>/', admin_questions_detail),  # PUT: 更新问题, DELETE: 删除问题
    
    # AI出题功能API端点
    path('admin/ai/generate-questions/', admin_ai_generate_questions),  # POST: AI生成题目
    path('admin/ai/batch-create-questions/', admin_ai_batch_create_questions),  # POST: AI批量创建题目
    
    # 智能调度器API端点
    path('scheduler/next-card/', smart_scheduler_next_card),  # POST: 获取下一张卡片
    path('scheduler/complete-learning/', smart_scheduler_complete_learning),  # POST: 完成学习
    path('scheduler/complete-practice/', smart_scheduler_complete_practice),  # POST: 完成练习
    path('scheduler/complete-review/', smart_scheduler_complete_review),  # POST: 完成复习
    path('scheduler/dashboard/', smart_scheduler_dashboard),  # GET: 获取学习仪表板
    path('scheduler/set-daily-goal/', smart_scheduler_set_daily_goal),  # POST: 设置每日目标
    
    # 学习记录管理API端点
    path('admin/learning-records/', admin_learning_records),  # GET: 获取学习记录, POST: 创建新记录
    path('admin/learning-records/<int:record_id>/', admin_learning_records_detail),  # PUT: 更新记录, DELETE: 删除记录
    path('admin/users/', admin_users_list),  # GET: 获取用户列表
    
    # 复习相关API端点
    path('review/random-question/', get_random_question_for_review),  # POST: 随机获取卡片问题
    path('review/submit-answer/', submit_review_answer),  # POST: 提交复习答案
    path('review/next-question/', get_next_review_question),  # POST: 获取下一道复习问题
    
    # 导入导出API端点
    path('admin/export/cards/', export_cards),  # GET: 导出所有卡片和问题
    path('admin/import/cards/', import_cards),  # POST: 导入卡片和问题
    path('admin/export/cards/<str:card_id>/', export_single_card),  # GET: 导出单个卡片
    path('admin/import/validate/', validate_import_file_api),  # POST: 验证导入文件格式
]
