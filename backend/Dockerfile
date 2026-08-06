FROM python:3.11-slim

WORKDIR /app

# bust cache 2026-08-06
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

ENV PYTHONUNBUFFERED=1

CMD ["python", "start.py"]
