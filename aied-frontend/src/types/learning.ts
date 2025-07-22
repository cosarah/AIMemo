export interface Card {
    id: string;
    content: string;
    title: string;
    prerequisites: string[];  // 前置卡片ID数组
    question_count: number;   // 问题数量
    created_at: string;
}

export interface LearningRecord {
    id: number;
    username: string;
    card_id: string;
    card_title: string;
    card_content: string;
    status: string;
    status_display: string;
    queue: string;
    queue_display: string;
    first_learned: string | null;
    last_accessed: string | null;
    mastered_time: string | null;
    review_count: number;
    next_review_date: string | null;
    practice_attempts: number;
    practice_correct_count: number;
    total_attempts: number;
    total_questions: number;
    correct_answers: number;
}

export interface User {
    id: number;
    username: string;
    date_joined: string | null;
    total_records: number;
    mastered_count: number;
    learning_count: number;
    not_learned_count: number;
}

export interface CardFormData {
    title: string;
    content: string;
    prerequisites: string[];
}

export interface Question {
    id: number;
    content: string;
    question_type: number;  // 1: 选择题, 2: 问答题, 3: 代码题
    options: string[];
    correct_answer: string;
    order: number;
    created_at: string;
}

export interface QuestionFormData {
    content: string;
    question_type: number;
    options: string[];
    correct_answer: string;
    order: number;
}

export interface DependencyGraph {
    nodes: Array<{
        id: string;
        title: string;
        questionCount: number;
    }>;
    edges: Array<{
        from: string;
        to: string;
    }>;
}

export interface AIGeneratedQuestion {
    content: string;
    question_type: number;
    options: string[];
    correct_answer: string;
    type_display: string;
    selected?: boolean;
}

export interface AIGenerateResponse {
    success: boolean;
    questions: AIGeneratedQuestion[];
    card_title: string;
    card_id: string;
    generated_count: number;
    error?: string;
}

// 复习相关类型定义
export interface ReviewQuestion {
    id: number;
    content: string;
    type: 'choice' | 'short_answer' | 'code';
    options: string[];
    card_id: string;
    card_title: string;
    card_content?: string;
    total_questions?: number;
    auto_generated?: boolean;
    remaining_questions?: number;
}

export interface ReviewAnswerResponse {
    is_correct: boolean;
    correct_answer: string;
    explanation: string;
    code_output?: string;
    other_questions: ReviewQuestion[];
    can_try_other: boolean;
}