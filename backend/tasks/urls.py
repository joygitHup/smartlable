from django.urls import path
from . import views

urlpatterns = [
    path("tasks", views.tasks),
    path("tasks/<int:tid>", views.task_detail),
    path("tasks/<int:tid>/import", views.import_data),
    path("tasks/<int:tid>/units", views.units),
    path("tasks/<int:tid>/queue", views.queue_next),
    path("tasks/<int:tid>/progress", views.progress),
    path("tasks/<int:tid>/export", views.export),
    path("tasks/<int:tid>/to-review", views.to_review),
    path("units/<int:uid>/review", views.review_unit),
]