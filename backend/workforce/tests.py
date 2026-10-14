"""workforce(F9) 最小测试：模型、序列化器与路由。"""
from django.test import TestCase
from django.urls import resolve
from rest_framework.test import APIClient

from core.models import User
from tasks.models import Task

from .constants import WorkforceErrorCode
from .models import Assignment, AssignmentStatus, TaskQueueEntry
from .serializers import AssignmentSerializer, TaskQueueEntrySerializer


class WorkforceModelTest(TestCase):
    def test_queue_entry_serializer(self):
        task = Task.objects.create(name="T1")
        entry = TaskQueueEntry.objects.create(task=task, priority="high")
        self.assertEqual(entry.status, "queued")
        data = TaskQueueEntrySerializer(entry).data
        self.assertEqual(data["task_name"], "T1")
        self.assertEqual(data["priority_label"], "高")

    def test_assignment_serializer(self):
        user = User.objects.create_user(username="ann", password="x", role="annotator")
        task = Task.objects.create(name="T2")
        assignment = Assignment.objects.create(
            task=task, assignee=user, status=AssignmentStatus.ASSIGNED, matched_skills=["情感"]
        )
        data = AssignmentSerializer(assignment).data
        self.assertEqual(data["assignee"], "ann")
        self.assertEqual(data["matched_skills"], ["情感"])


class WorkforceRoutesTest(TestCase):
    def test_routes_resolve(self):
        self.assertEqual(resolve("/api/v1/workforce/queue").view_name, "wf-queue-list")
        self.assertEqual(resolve("/api/v1/workforce/assign").view_name, "wf-assign")
        self.assertEqual(resolve("/api/v1/workforce/estimate").view_name, "wf-estimate")


class WorkforceActionDispatchTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="ops", password="x", role="operator")
        self.client.force_authenticate(user=self.user)

    def test_assign_without_task_rejected(self):
        resp = self.client.post("/api/v1/workforce/assign", {}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], WorkforceErrorCode.TASK_REQUIRED)

    def test_estimate_without_task_rejected(self):
        resp = self.client.post("/api/v1/workforce/estimate", {}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], WorkforceErrorCode.TASK_REQUIRED)

    def test_assign_no_candidate(self):
        task = Task.objects.create(name="T3", spec={"skills": ["情感"]})
        resp = self.client.post("/api/v1/workforce/assign", {"task": task.id}, format="json")
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.json()["code"], WorkforceErrorCode.NO_CANDIDATE)
