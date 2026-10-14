from django.urls import path

from . import views

urlpatterns = [
    path("health/ready", views.ready),
    path("health/live", views.live),
]
