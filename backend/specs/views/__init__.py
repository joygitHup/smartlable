"""specs 视图统一导出。"""
from .dispute import DisputeSampleViewSet
from .spec import SpecDocumentViewSet
from .training import TrainingAttemptViewSet, TrainingSetViewSet

__all__ = [
    "SpecDocumentViewSet",
    "DisputeSampleViewSet",
    "TrainingSetViewSet",
    "TrainingAttemptViewSet",
]
