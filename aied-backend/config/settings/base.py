# settings/base.py
# 通用配置
INSTALLED_APPS = [
    'apps.cards',
    'apps.questions',
    'framework',
]

# 安全配置
CODE_EXECUTION = {
    'TIMEOUT': 5,
    'MEMORY_LIMIT': 256  # MB
}

# settings/local.py
# 开发环境配置
DEBUG = True
DATABASES = {...}

# settings/production.py
# 生产环境配置
DEBUG = False
CORS_ALLOWED_ORIGINS = [...]
