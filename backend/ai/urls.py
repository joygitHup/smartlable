from django.urls import path
from . import views

urlpatterns = [
    path("tasks/<int:tid>/run-ai", views.run_ai),
    path("tasks/<int:tid>/reflow", views.reflow),
    path("ml/models", views.models),
    path("ml/models/<int:mid>", views.model_detail),
    path("ml/compare", views.compare),
]