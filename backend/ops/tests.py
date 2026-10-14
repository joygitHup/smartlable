"""ops(F14) 最小测试：模型、序列化器、工具与路由。"""
from django.test import TestCase
from django.urls import resolve

from core.models import User
from tasks.models import Task, Unit

from .models import Announcement, Comment, Feedback, Notification
from .serializers import CommentListSerializer
from .utils import as_list, mask_name


class OpsUnitTest(TestCase):
    def test_utils(self):
        self.assertEqual(as_list("a,b, c"), ["a", "b", "c"])
        self.assertEqual(as_list(None), [])
        self.assertEqual(mask_name("annotator"), "a*******r")
        self.assertEqual(mask_name("ab"), "a*")

    def test_comment_serializer(self):
        user = User.objects.create_user(username="op", password="x", role="operator")
        task = Task.objects.create(name="t1", created_by=user)
        comment = Comment.objects.create(task=task, author=user, content="hi", mentions=[1, 2])
        data = CommentListSerializer(comment).data
        self.assertEqual(data["content"], "hi")
        self.assertEqual(data["author"], "op")

    def test_misc_models(self):
        user = User.objects.create_user(username="ann", password="x", role="annotator")
        task = Task.objects.create(name="t2", created_by=user)
        unit = Unit.objects.create(task=task, content="c")
        announcement = Announcement.objects.create(title="公告", created_by=user)
        self.assertFalse(announcement.published)
        notification = Notification.objects.create(recipient=user, title="n")
        self.assertFalse(notification.is_read)
        feedback = Feedback.objects.create(user=user, content="f")
        self.assertEqual(feedback.status, "open")
        self.assertEqual(unit.task_id, task.id)


class OpsRoutesTest(TestCase):
    def test_routes_resolve(self):
        self.assertEqual(resolve("/api/v1/ops/comments").view_name, "ops-comment-list")
        self.assertEqual(resolve("/api/v1/ops/announcements").view_name, "ops-announcement-list")
        self.assertEqual(resolve("/api/v1/ops/notifications").view_name, "ops-notification-list")
        self.assertEqual(resolve("/api/v1/ops/reports").view_name, "ops-report-list")
        self.assertEqual(resolve("/api/v1/ops/feedbacks").view_name, "ops-feedback-list")
        self.assertEqual(resolve("/api/v1/ops/dashboard").view_name, "ops-dashboard")
        self.assertEqual(resolve("/api/v1/ops/leaderboard").view_name, "ops-leaderboard")
