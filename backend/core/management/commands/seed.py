import os
import secrets
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone

from core.models import User, Role
from tasks.models import Task, Unit, UnitStatus, TaskType, Priority, Modality

# ---- F8–F15 新模块模型（示例演示数据用） ----
from specs.models import (
    SpecDocument,
    SpecVersion,
    SpecStatus,
    SpecVersionStatus,
    DisputeSample,
    Difficulty,
    TrainingSet,
)
from workforce.models import (
    TaskQueueEntry,
    Assignment,
    SkillTag,
    Worklog,
    PayScheme,
    Shift,
    WorkEstimate,
    VendorTeam,
    QueueStatus,
    AssignmentStatus,
    PayMode,
)
from prelabel.models import (
    ClassThreshold,
    PrelabelRule,
    LongTailPolicy,
    ABExperiment,
    RuleType,
    LongTailStrategy,
    ExperimentStatus,
)
from qc.models import (
    GoldSample,
    GoldInjection,
    AnnotatorProfile,
    QualityTrend,
    ReworkTask,
    ReworkStatus,
)
from compliance.models import (
    DataClassification,
    DataClassPolicy,
    SecureEnvironment,
    DataLifecyclePolicy,
    ComplianceChecklist,
    Watermark,
    DataLevel,
    LifecycleAction,
    ComplianceFramework,
)
from integration.models import (
    APIClient,
    Webhook,
    DataSource,
    TrainingPlatform,
    SSOConfig,
    SourceType,
    Provider,
)
from ops.models import (
    Announcement,
    Notification,
    Comment,
    Report,
    AnnouncementLevel,
    ReportType,
    ReportStatus,
)
from llmops.models import (
    PromptTemplate,
    PromptVersion,
    LLMCostRecord,
    DistillationJob,
    DistillStatus,
    MultiRoundSession,
    SessionStatus,
    PromptStatus,
)


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

        # ============================================================
        # F8–F15 新模块演示数据（幂等：get_or_create / exists 判断）
        # ============================================================
        now = timezone.now()
        operator = User.objects.get(username="operator")
        annotator = User.objects.get(username="annotator")
        engineer = User.objects.get(username="engineer")
        first_unit = task.units.order_by("id").first()

        # ---- F8 冷启动与规范管理 ----
        spec, _ = SpecDocument.objects.get_or_create(
            title="电商评论情感分析标注规范（示例）",
            defaults=dict(
                task_type=TaskType.SENTIMENT,
                task=task,
                content="1. 正向：整体为夸奖/满意，如「非常满意、值得推荐」。\n"
                "2. 负面：整体为不满/批评，如「质量差、差评」。\n"
                "3. 中性：仅陈述事实或褒贬相当，如「功能正常，没什么特别感受」。\n"
                "4. 存在明显矛盾表述时，按主导语气判定，并提交争议池。",
                status=SpecStatus.PUBLISHED,
                current_version=1,
                created_by=operator,
            ),
        )
        SpecVersion.objects.get_or_create(
            spec=spec,
            version=1,
            defaults=dict(
                content=spec.content,
                change_note="初始版本发布",
                status=SpecVersionStatus.PUBLISHED,
                created_by=operator,
            ),
        )
        TrainingSet.objects.get_or_create(
            title="情感标注培训题-正向识别",
            defaults=dict(
                task_type=TaskType.SENTIMENT,
                question="「物流很快，包装严实，非常满意」应标注为？",
                options=["正向", "负面", "中性"],
                answer="正向",
                difficulty=Difficulty.EASY,
                reference="明显夸奖归为正向",
                created_by=operator,
            ),
        )
        if first_unit:
            DisputeSample.objects.get_or_create(
                task=task,
                unit=first_unit,
                defaults=dict(
                    raised_by=annotator,
                    reason="该评论同时包含褒义与贬义表述，标注员之间存在分歧，请专家裁决。",
                ),
            )

        # ---- F9 调度与人力管理 ----
        for nm, cat, tt in [
            ("情感分析", "自然语言", TaskType.SENTIMENT),
            ("实体抽取", "自然语言", TaskType.ENTITY),
        ]:
            SkillTag.objects.get_or_create(name=nm, defaults=dict(category=cat, task_type=tt))
        TaskQueueEntry.objects.get_or_create(
            task=task,
            defaults=dict(priority=Priority.HIGH, order=0, status=QueueStatus.QUEUED, created_by=operator),
        )
        Assignment.objects.get_or_create(
            task=task,
            assignee=annotator,
            unit=None,
            defaults=dict(
                assigned_by=operator,
                status=AssignmentStatus.ASSIGNED,
                matched_skills=["情感分析"],
                score=1.0,
            ),
        )
        Worklog.objects.get_or_create(
            assignee=annotator,
            task=task,
            effective_minutes=45,
            defaults=dict(work_date=now.date(), note="完成 30 条情感标注"),
        )
        PayScheme.objects.get_or_create(
            name="情感标注计件",
            defaults=dict(
                mode=PayMode.PIECE,
                rate=0.8,
                currency="CNY",
                task_type=TaskType.SENTIMENT,
                description="按标注条数计费",
            ),
        )
        Shift.objects.get_or_create(
            name="白班(9:00-18:00)",
            defaults=dict(
                assignee=annotator,
                start_at=now,
                end_at=now + timedelta(hours=9),
                capacity=10,
                note="正常工作班次",
            ),
        )
        VendorTeam.objects.get_or_create(
            name="外包标注团队A",
            defaults=dict(
                vendor="XX数据服务",
                isolation_key="vendor-a",
                is_isolated=True,
                contact="contact@vendor-a.com",
                capacity=5000,
            ),
        )
        if not WorkEstimate.objects.filter(task=task).exists():
            WorkEstimate.objects.create(
                task=task,
                estimated_minutes=120,
                method="history_mean",
                sample_size=task.units.count(),
                basis={"avg_seconds_per_unit": 4.0},
                created_by=operator,
            )

        # ---- F10 预标注现实增强 ----
        for label, thr in [("正向", 0.85), ("负面", 0.80), ("中性", 0.70)]:
            ClassThreshold.objects.get_or_create(
                task=None,
                task_type=TaskType.SENTIMENT,
                label=label,
                defaults=dict(threshold=thr, created_by=operator),
            )
        PrelabelRule.objects.get_or_create(
            task_type=TaskType.SENTIMENT,
            name="差评关键词兜底",
            defaults=dict(
                rule_type=RuleType.KEYWORD,
                pattern="差评,退货,无语",
                label="负面",
                priority=10,
                enabled=True,
                created_by=operator,
            ),
        )
        LongTailPolicy.objects.get_or_create(
            task_type=TaskType.SENTIMENT,
            label="中性",
            defaults=dict(
                strategy=LongTailStrategy.EXTRA_REVIEW,
                min_confidence=0.75,
                notes="中性样本易混淆，统一加严复核",
                created_by=operator,
            ),
        )
        ABExperiment.objects.get_or_create(
            task=task,
            name="glm-4 vs 基线模型对比",
            defaults=dict(
                model_a="glm-4-7-251222",
                model_b="baseline-rules",
                status=ExperimentStatus.DRAFT,
                split_ratio=0.5,
                created_by=operator,
            ),
        )

        # ---- F11 质量深水区 ----
        gold, _ = GoldSample.objects.get_or_create(
            task=task,
            content="物流很快，包装严实，非常满意，值得推荐",
            defaults=dict(expected_label={"label": "正向"}, active=True, created_by=operator),
        )
        if not GoldInjection.objects.filter(sample=gold).exists():
            GoldInjection.objects.create(
                task=task, sample=gold, batch="batch-001", assigned_to=annotator, injected_at=now
            )
        AnnotatorProfile.objects.get_or_create(
            annotator=annotator,
            task_type=TaskType.SENTIMENT,
            defaults=dict(
                accuracy=0.94,
                category_metrics={"正向": 0.96, "负面": 0.92, "中性": 0.90},
                total_reviewed=120,
            ),
        )
        QualityTrend.objects.get_or_create(
            annotator=annotator,
            task=task,
            date=now.date(),
            defaults=dict(accuracy=0.94, sample_size=120),
        )
        if first_unit:
            ReworkTask.objects.get_or_create(
                task=task,
                unit=first_unit,
                source="质检",
                defaults=dict(
                    reason="与金标不一致，需重新标注",
                    status=ReworkStatus.PENDING,
                    assigned_to=annotator,
                ),
            )

        # ---- F12 安全合规 ----
        DataClassification.objects.get_or_create(
            name="用户评论（内部）",
            defaults=dict(level=DataLevel.INTERNAL, description="电商评论文本数据", created_by=operator),
        )
        DataClassPolicy.objects.get_or_create(
            task_type=TaskType.SENTIMENT,
            level=DataLevel.INTERNAL,
            defaults=dict(
                allowed_roles=["admin", "operator", "annotator"],
                require_secure_env=False,
                created_by=operator,
            ),
        )
        SecureEnvironment.objects.get_or_create(
            name="内网安全标注环境",
            defaults=dict(
                level=DataLevel.CONFIDENTIAL,
                allow_screenshot=False,
                allow_copy=False,
                require_approval=True,
                enabled=True,
                created_by=operator,
            ),
        )
        DataLifecyclePolicy.objects.get_or_create(
            level=DataLevel.INTERNAL,
            applies_to_task_type="",
            defaults=dict(
                retention_days=365,
                action=LifecycleAction.ARCHIVE,
                enabled=True,
                created_by=operator,
            ),
        )
        ComplianceChecklist.objects.get_or_create(
            framework=ComplianceFramework.GDPR,
            item="数据处理目的告知",
            defaults=dict(description="需向数据主体告知处理目的与范围", required=True, created_by=operator),
        )
        if not Watermark.objects.filter(target_type="task", target_id=str(task.id)).exists():
            Watermark.objects.create(
                target_type="task",
                target_id=str(task.id),
                text="内部导出-禁止外传",
                token="wm-demo-0001",
                hash="demo-content-hash",
                created_by=operator,
            )

        # ---- F13 系统集成 ----
        if not APIClient.objects.filter(name="上游数据平台").exists():
            APIClient.objects.create(
                name="上游数据平台",
                key=f"ak_{secrets.token_hex(8)}",
                secret=secrets.token_hex(16),
                scopes=["tasks:read", "tasks:write"],
                enabled=True,
                created_by=engineer,
            )
        Webhook.objects.get_or_create(
            name="训练平台回调",
            defaults=dict(
                url="https://example.com/hooks/annotate",
                events=["task.completed", "reflow.done"],
                secret="whsec_demo",
                enabled=True,
                created_by=engineer,
            ),
        )
        DataSource.objects.get_or_create(
            name="订单库（只读）",
            defaults=dict(
                source_type=SourceType.DATABASE,
                config={"host": "10.0.0.10", "port": 3306, "database": "orders"},
                enabled=True,
                created_by=engineer,
            ),
        )
        TrainingPlatform.objects.get_or_create(
            name="内部训练平台",
            defaults=dict(
                platform_type="mlflow",
                endpoint="https://mlflow.internal/api",
                config={"experiment": "sentiment-v2"},
                enabled=True,
                created_by=engineer,
            ),
        )
        SSOConfig.objects.get_or_create(
            name="企业SSO",
            defaults=dict(
                provider=Provider.OAUTH2,
                config={"issuer": "https://sso.example.com"},
                enabled=True,
                created_by=engineer,
            ),
        )

        # ---- F14 运营协作 ----
        Announcement.objects.get_or_create(
            title="标注规范 v1 已发布",
            defaults=dict(
                content="情感分析标注规范已更新，请各位标注员及时查看并按新版执行。",
                level=AnnouncementLevel.INFO,
                target_roles=["annotator", "operator"],
                published=True,
                published_at=now,
                created_by=operator,
            ),
        )
        Notification.objects.get_or_create(
            recipient=annotator,
            title="您有新的争议裁决",
            defaults=dict(
                content="一条争议样本已完成裁决，请前往争议池查看。",
                category="dispute",
                is_read=False,
                ref_type="dispute",
                ref_id="1",
            ),
        )
        Comment.objects.get_or_create(
            task=task,
            author=operator,
            content="请重点关注中性样本的判定边界。",
            defaults=dict(mentions=["annotator"]),
        )
        if not Report.objects.filter(report_type=ReportType.DAILY, period_start=now.date()).exists():
            Report.objects.create(
                report_type=ReportType.DAILY,
                period_start=now.date(),
                period_end=now.date(),
                metrics={"reviewed": 120, "modified": 18, "ai_pass_rate": 0.82, "llm_cost": 12.5},
                status=ReportStatus.GENERATED,
                generated_by=operator,
            )

        # ---- F15 LLM 新范式 ----
        tpl, _ = PromptTemplate.objects.get_or_create(
            name="情感三分类提示词",
            defaults=dict(
                task_type=TaskType.SENTIMENT,
                description="对评论做情感极性标注",
                status=PromptStatus.ACTIVE,
                current_version=1,
            ),
        )
        PromptVersion.objects.get_or_create(
            template=tpl,
            version=1,
            defaults=dict(
                content="你是情感分析专家，请判断以下评论的情感极性（正向/负面/中性）：\n{text}",
                change_note="初始版本",
                status=PromptStatus.ACTIVE,
                created_by=engineer,
            ),
        )
        if not LLMCostRecord.objects.filter(task=task, model="glm-4-7-251222").exists():
            LLMCostRecord.objects.create(
                task=task,
                model="glm-4-7-251222",
                prompt_tokens=1200,
                completion_tokens=300,
                total_tokens=1500,
                cost=0.45,
            )
        DistillationJob.objects.get_or_create(
            name="情感分类小模型蒸馏",
            defaults=dict(
                teacher_model="glm-4-7-251222",
                student_model="bert-base-chinese",
                task_type=TaskType.SENTIMENT,
                dataset_size=5000,
                status=DistillStatus.PENDING,
                notes="用 LLM 标注数据蒸馏轻量模型以降低成本",
            ),
        )
        if first_unit:
            MultiRoundSession.objects.get_or_create(
                task=task,
                unit=first_unit,
                defaults=dict(current_round=1, max_round=3, status=SessionStatus.OPEN),
            )

        self.stdout.write(self.style.SUCCESS("种子数据初始化完成（含 F8–F15 新模块演示数据）。"))