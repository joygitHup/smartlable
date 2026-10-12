from django.urls import path
from . import views

urlpatterns = [
    path("tasks/<int:tid>/quality", views.quality_report),
    path("tasks/<int:tid>/gold-check", views.gold_check),
]