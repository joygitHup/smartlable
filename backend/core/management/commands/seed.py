import os
from django.core.management.base import BaseCommand
from django.conf import settings

from core.models import User, Role
from tasks.models import Task, Unit, UnitStatus, TaskType, Priority, Modality


DEFAULT_PASSWORD = os.environ.get("SEED_PASSWORD", "annotate123")


class Command(BaseCommand):
    help = "初始化演示账号与示例标注任务"

    def handle(self, *args, **opts):
        # ---- 多角色账号 ----
        accounts = {
            "admin": dict(role=Role.ADMIN, display_name="系统管理员", skills=["all"], max_load=0),
            "operator": dict(role=Role.OPERATOR, display_name="标注运营", skills=["task:manage"], max_load=50),
            "annotator": dict(role=Role.ANNOTATOR, display_name="标注员小李", skills=["sentiment", "classification"], max_load=200),
            "annotator2": dict(role=Role.ANNOTATOR, display_name="标注员小张", skills=["entity"], max_load=150),
            "engineer": dict(role=Role.ENGINEER, display_name="算法工程师", skills=["ml"], max_load=0),
            "pm": dict(role=Role.PM, display_name="项目经理", skills=["view"], max_load=0),
        }
        for username, cfg in accounts.items():
            user, created = User.objects.get_or_create(username=username)
            user.role = cfg["role"]
            user.display_name = cfg["display_name"]
            user.skills = cfg["skills"]
            user.max_load = cfg["max_load"]
            user.is_staff = cfg["role"] == Role.ADMIN
            user.is_superuser = cfg["role"] == Role.ADMIN
            user.set_password(DEFAULT_PASSWORD)
            user.save()
            if created:
                self.stdout.write(f"  创建账号: {username} / {DEFAULT_PASSWORD}")
            else:
                self.stdout.write(f"  已存在: {username} (密码已重置为 {DEFAULT_PASSWORD})")

        # ---- 示例任务：电商评论情感分析 ----
        task, _ = Task.objects.get_or_create(
            name="电商评论情感分析（示例）",
            defaults=dict(
                description="对电商平台用户评论进行正向/负面/中性三分类，用于商品运营分析。",
                task_type=TaskType.SENTIMENT,
                modality=Modality.TEXT,
                ai_enabled=True,
                confidence_threshold=0.8,
                manual_review_ratio=0.3,
                priority=Priority.HIGH,
                status="created",
                created_by=User.objects.get(username="operator"),
                spec={
                    "labels": ["正向", "负面", "中性"],
                    "instructions": "按整体语气判断。明显夸奖=正向；明显不满=负面；平淡说明=中性。",
                },
            ),
        )
        if Unit.objects.filter(task=task).count() == 0:
            samples = [
                "物流太快了，昨晚下单今早就到了，包装也很严实，非常满意！",
                "这衣服质量太差了，洗一次就起球掉色，客服态度还很差，差评。",
                "颜色和实物基本一致，穿上去版型还可以，就是尺码稍微偏小。",
                "用了两星期，续航还行，屏幕很清晰，性价比高，值得推荐。",
                "东西收到了，功能正常，没什么特别的感受。",
                "客服回复超级慢，配件还发错了，真让人无语。",
                "款式很新颖，朋友都说好看，准备再买一件别的颜色。",
                "和描述的有出入，尺寸不准，勉强能穿，不推荐购买。",
                "包装简陋，好在商品完好，用起来中规中矩吧。",
                "一键退货特别方便，售后处理很快，服务态度很好。",
            ]
            Unit.objects.bulk_create(
                [Unit(task=task, content=s, status=UnitStatus.CREATED, split="none") for s in samples]
            )
            self.stdout.write(f"  示例任务已创建，导入 {len(samples)} 条样本 (任务ID={task.id})")
        else:
            self.stdout.write(f"  示例任务已存在 (任务ID={task.id})")

        self.stdout.write(self.style.SUCCESS("种子数据初始化完成。"))